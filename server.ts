import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import axios from "axios";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Global process-level safety guards to prevent unhandled crashes in container environments
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL SAFETY] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL SAFETY] Uncaught Exception:', err);
});

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function handleGeminiError(error: any, res: any) {
  console.error("Erro na API do Gemini:", error);
  const errMsg = error.message || String(error);
  
  if (errMsg.includes("leaked") || errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("API key")) {
    return res.status(403).json({
      error: "Sua chave de API do Gemini (GEMINI_API_KEY) foi detectada pelo Google como vazada (leaked) ou inválida. Por favor, acesse o menu 'Settings > Secrets' no AI Studio e insira uma nova chave de API válida para habilitar as funções de Inteligência Artificial."
    });
  }
  
  return res.status(500).json({ error: errMsg });
}

const app = express();
const apiRouter = express.Router();
const PORT = 3000;

// Prevent browser/proxy caching for all API responses
apiRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-spreadsheet-id', 'Accept', 'Origin']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const isCodeAsset = req.path.startsWith('/src/') || 
                      req.path.startsWith('/@') || 
                      req.path.startsWith('/node_modules/') ||
                      req.path.endsWith('.ts') || 
                      req.path.endsWith('.tsx') || 
                      req.path.endsWith('.css') || 
                      req.path.endsWith('.js') || 
                      req.path.endsWith('.map');

  if (!isCodeAsset) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - (Path: ${req.path})`);
  }
  next();
});

const getInitialSpreadsheetId = () => {
  const envSheetId = (process.env.GOOGLE_SHEET_ID || "").trim();
  const envIdDaPlanilha = (process.env.ID_da_planilha || "").trim();
  
  if (envSheetId && !envSheetId.startsWith("AIza")) {
    return cleanSpreadsheetId(envSheetId);
  }
  if (envIdDaPlanilha) {
    return cleanSpreadsheetId(envIdDaPlanilha);
  }
  return "1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs";
};

const DEFAULT_SPREADSHEET_ID = getInitialSpreadsheetId();

const getRequestSpreadsheetId = (req: express.Request) => {
  const headerId = req.headers['x-spreadsheet-id'] as string || req.query.spreadsheetId as string;
  
  const defaultTimon = '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs';
  const defaultThe = '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs';
  const defaultImp = '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs';

  const envSheetId = (process.env.GOOGLE_SHEET_ID || "").trim();
  const envIdDaPlanilha = (process.env.ID_da_planilha || "").trim();
  const activeMainSheet = envSheetId || envIdDaPlanilha;

  const envTimon = (process.env.GOOGLE_SHEET_ID_TIMON || "").trim();
  const envThe = (process.env.GOOGLE_SHEET_ID_THE || "").trim();
  const envImp = (process.env.GOOGLE_SHEET_ID_IMP || "").trim();

  if (headerId) {
    const trimmedHeader = headerId.trim();
    if (trimmedHeader === defaultTimon) {
      if (envTimon) return cleanSpreadsheetId(envTimon);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    } else if (trimmedHeader === defaultThe) {
      if (envThe) return cleanSpreadsheetId(envThe);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    } else if (trimmedHeader === defaultImp) {
      if (envImp) return cleanSpreadsheetId(envImp);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    }
    return trimmedHeader;
  }
  return DEFAULT_SPREADSHEET_ID;
};

function normalizeEAN(ean: any): string {
  if (ean === null || ean === undefined) return '';
  let s = String(ean).trim().replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.length > 0 && s.length < 13) {
    s = s.padStart(13, '0');
  }
  return s;
}

// Admin check helper
const isAdmin = (email: string) => {
  const admins = ["leonelamorimm@gmail.com"];
  return admins.includes(email);
};

// Template de planilha HBN1 para download
apiRouter.get("/download-template", (req, res) => {
  const filePath = path.join(process.cwd(), "public", "templates", "planilha_modelo_hbn1.xlsx");
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="planilha_modelo_hbn1_distribuicao.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.sendFile(filePath);
  }
  return res.status(404).json({ error: "Arquivo modelo não encontrado." });
});

// API Routes on apiRouter
apiRouter.post("/gemini/scan-order", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Imagem base64 não fornecida." });
    }

    const ai = getGeminiClient();

    let base64Data = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    console.log(`[Gemini OCR] Escaneando imagem de pedido. MIME: ${mimeType}, Tamanho base64: ${base64Data.length}`);

    const prompt = `Você é um sistema especialista, analítico e ultra-criterioso de OCR e extração de dados para relatórios e pedidos de compra farmacêuticos e distribuidoras no Brasil (ex: Nazaria Distribuidora, Drogaria Ferreira, A7 Pharma / Alpha7, Inovafarma, Sta Vitória, etc.).

Sua missão é analisar o documento/imagem/PDF fornecido e extrair COM TOTAL PRECISÃO E SEM OMITIR NENHUM ITEM E NENHUM CNPJ todos os blocos de pedidos presentes.

REGRAS OBRIGATÓRIAS E CRITÉRIOS DE EXTRAÇÃO:
1. MÚLTIPLOS CNPJS / FILIAIS / UNIDADES (SEPARAÇÃO OBRIGATÓRIA):
   - Um relatório frequentemente possui múltiplos pedidos para LOJAS / FILIAIS DIFERENTES.
   - Exemplo clássico no cabeçalho: "Filial: 001 07176442/0001-32 DROGARIA FERREIRA - MATRIZ Forma de Pagamento: 70/80/90", "Numero Pedido: 017367".
   - Cada filial possui seu próprio CNPJ (ex: "07176442/0001-32" -> "07176442000132", "04603682/0001-88", "33724158/0001-63", "40306819/0001-04", "45592059/0001-54", "50338007/0001-96", "07176442/0002-13").
   - REGRA DE OURO: NUNCA misture itens de CNPJs ou filiais diferentes em um único pedido! Cada CNPJ/filial DEVE ser um objeto separado na lista de resposta.
   - Se o documento tiver 7 filiais/CNPJs, você DEVE gerar exatamente 7 blocos separados, cada um contendo apenas os itens daquela filial correspondente.
   - Extraia o CNPJ limpo (14 dígitos numéricos) ou com formato.
   - Extraia a filial (ex: "001", "002", etc.) e o número do pedido (ex: "017367", "015794").

2. ITENS E QUANTIDADES (EAN & QTD) - PRECISÃO MATEMÁTICA:
   - ean: Código de barras EAN (8 a 14 dígitos, ex: "7896007542864", "7896007550890", "7896018700710").
   - quantity: A QUANTIDADE pedida DEVE SER LIDA EXATAMENTE DA COLUNA 'Qtd' ou 'Qtd.'!
     * ATENÇÃO COM A COLUNA 'Embalagem' (ex: "1 X 1", "1 X 12", "1 X 6"): Os números "1" dentro da coluna Embalagem NÃO são a quantidade pedida! Ignore os valores de Embalagem.
     * Exemplo de linha do relatório Nazaria: "7896007542864 ABS INTERNO INTIMUS M KIMBERLY-CLA UN 1 X 1 4" -> Código/EAN: "7896007542864", Descrição: "ABS INTERNO INTIMUS M", Fabricante: "KIMBERLY-CLA", Und: "UN", Embalagem: "1 X 1", QUANTIDADE (quantity): 4! (Note que o preço após a quantidade pode estar vazio ou em branco, coloque price: 0).
     * Exemplo de linha com fabricante composto: "7896018700710 SH HUGGIES 200ML J R UN 1 X 1 4" -> Código/EAN: "7896018700710", Descrição: "SH HUGGIES 200ML", Fabricante: "J R", QUANTIDADE (quantity): 4!
     * Exemplo de linha com preço: "7891025120025 APTAMIL ACTIVE 800G DANONE UN 1 X 1 3 121,19" -> QUANTIDADE: 3, Preço: 121.19!
     * CONFERÊNCIA MATEMÁTICA OBRIGATÓRIA: Em cada bloco do relatório há a linha de rodapé com 'Tot. Itens: [X] Tot. Unidade: [Y]'. A SOMA das quantidades ('quantity') de todos os itens extraídos do bloco DEVE SER RIGOROSAMENTE IGUAL ao valor de 'Tot. Unidade' (ex: 189 unidades na Filial 1, 34 unidades na Filial 2, etc.). Confira a soma antes de responder!
   - description: Nome/descrição do produto.
   - price: Preço unitário (se informado; caso esteja em branco, assuma 0).
   - manufacturer: Fabricante/indústria (ex: "KIMBERLY-CLA", "J R", "DANONE", "UNILEVER", etc.).

3. CABEÇALHO DO PEDIDO (headerInfo):
   - fornecedor: Nome do fornecedor/distribuidora (ex: "NAZARIA DIST PROD FARMACEUTICOS LTDA").
   - condPgto: Condição de pagamento se informada (ex: "70/80/90").
   - status: Status (ex: "Pendente").
   - dataEntrega: Data de emissão ou entrega (ex: "16/09/2026").
   - cotacao: Número do Pedido e Filial (ex: "Filial 001 - Pedido #017367").

Seja 100% analítico e criterioso, garanta a separação precisa de cada CNPJ e a extração exata das quantidades de cada filial.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              clientName: {
                type: Type.STRING,
                description: "Name of the client store/unidade"
              },
              cnpj: {
                type: Type.STRING,
                description: "CNPJ of the client store/unidade"
              },
              headerInfo: {
                type: Type.OBJECT,
                properties: {
                  fornecedor: { type: Type.STRING, description: "Supplier/Manufacturer/Distributor" },
                  condPgto: { type: Type.STRING, description: "Payment condition" },
                  status: { type: Type.STRING, description: "Status" },
                  dataEntrega: { type: Type.STRING, description: "Delivery date" },
                  cotacao: { type: Type.STRING, description: "Order code / cotacao number" }
                }
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ean: { type: Type.STRING, description: "EAN / Barcode" },
                    quantity: { type: Type.INTEGER, description: "Quantity" },
                    description: { type: Type.STRING, description: "Product description" },
                    price: { type: Type.NUMBER, description: "Unit or purchase price" },
                    manufacturer: { type: Type.STRING, description: "Manufacturer/Fabricante" }
                  },
                  required: ["ean", "quantity"]
                }
              }
            },
            required: ["clientName", "items"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      return res.status(500).json({ error: "O Gemini não retornou nenhum resultado para a imagem fornecida." });
    }

    let parsedData;
    try {
      const cleanJson = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw parseErr;
      }
    }
    res.json(parsedData);
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

apiRouter.options("/proxy-image", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  return res.sendStatus(204);
});

apiRouter.get("/proxy-image", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  const rawUrl = (req.query.url as string) || "";
  const ean = (req.query.ean as string) || "";
  const desc = (req.query.desc as string) || "";
  const mfg = (req.query.mfg as string) || "";

  const cleanEan = ean.replace(/\D/g, "");
  const normWords = desc.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 2);

  // Helper to search cached catalog data for alternative working photo
  const findAlternativePhoto = (): string | null => {
    for (const cacheItem of Object.values(dataCache)) {
      const list = cacheItem?.data;
      if (!Array.isArray(list)) continue;

      // 1. By EAN
      if (cleanEan && cleanEan.length >= 7) {
        for (const row of list) {
          const rowEan = String(row.EAN || row['Código Barras'] || row.ean || '').replace(/\D/g, '');
          const rowPhoto = String(row.Foto || row.foto || row.Imagem || row.photo || '').trim();
          if (rowEan === cleanEan && rowPhoto && rowPhoto !== rawUrl && rowPhoto.startsWith('http') && !rowPhoto.includes('sem foto')) {
            return rowPhoto;
          }
        }
      }

      // 2. By description keyword match
      if (normWords.length >= 2) {
        for (const row of list) {
          const rowPhoto = String(row.Foto || row.foto || row.Imagem || row.photo || '').trim();
          if (!rowPhoto || rowPhoto === rawUrl || !rowPhoto.startsWith('http') || rowPhoto.includes('sem foto')) {
            continue;
          }

          const rowDesc = String(row['Descrição Produto'] || row.Descricao || row.desc || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
          const rowWords = rowDesc.split(/\s+/);
          const matches = normWords.filter(w => rowWords.some(rw => rw === w || (w.length >= 4 && rw.startsWith(w)) || (rw.length >= 4 && w.startsWith(rw))));
          if (matches.length === normWords.length || (normWords.length >= 4 && matches.length >= normWords.length - 1)) {
            return rowPhoto;
          }
        }
      }
    }
    return null;
  };

  const fetchAndSendImage = async (imgUrl: string): Promise<boolean> => {
    let target = imgUrl.trim();
    if (target.startsWith('data:image/')) {
      const parts = target.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      const buffer = Buffer.from(parts[1], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
      return true;
    }

    // Unpack Next.js or Google wrappers
    if (target.includes('_next/image') || target.includes('/_ipx/')) {
      const match = target.match(/[?&](?:url|src)=([^&]+)/i);
      if (match && match[1]) {
        target = decodeURIComponent(match[1]);
      }
    }
    if (target.includes('google.') && (target.includes('imgres') || target.includes('/url?'))) {
      const match = target.match(/[?&](?:imgurl|url|q)=(https?%3A%2F%2F[^&]+|https?:\/\/[^&]+)/i);
      if (match && match[1]) {
        target = decodeURIComponent(match[1]);
      }
    }

    // Salsify Cloudinary-like transformation repair:
    // Strip /s--...--/c_limit.../ to directly load original high-res asset without 400 Bad Request
    if (target.includes('images.salsify.com')) {
      target = target.replace(/\/s--[^\/]+--\/c_limit[^/]+\//, '/');
      target = target.replace(/\/c_limit[^/]+\//, '/');
    }

    // Google Drive
    const driveMatch = target.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/uc\?(?:export=download&)?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      target = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    // Dropbox
    if (target.includes('dropbox.com') && !target.includes('dl.dropboxusercontent.com')) {
      target = target.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '?dl=1');
    }

    let origin = "https://www.google.com";
    try {
      origin = new URL(target.startsWith("http") ? target : `https://${target}`).origin;
    } catch {}

    try {
      const response = await axios.get(target, {
        responseType: "arraybuffer",
        timeout: 9000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": `${origin}/`
        }
      });

      if (response.status === 200 && response.data && response.data.length > 100) {
        const contentType = response.headers["content-type"] || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        res.send(Buffer.from(response.data));
        return true;
      }
    } catch (fetchErr: any) {
      // Failed to fetch this candidate, return false to trigger next fallback
      return false;
    }
    return false;
  };

  try {
    // 1. Try rawUrl first
    if (rawUrl) {
      const ok = await fetchAndSendImage(rawUrl);
      if (ok) return;
    }

    // 2. Try alternative photo found in catalog for this EAN or product description
    const altPhoto = findAlternativePhoto();
    if (altPhoto && altPhoto !== rawUrl) {
      const ok = await fetchAndSendImage(altPhoto);
      if (ok) return;
    }

    // 3. Try Open Food Facts by EAN if available
    if (cleanEan && cleanEan.length >= 7) {
      const offUrl = `https://images.openfoodfacts.org/images/products/${cleanEan}/1.jpg`;
      try {
        const ok = await fetchAndSendImage(offUrl);
        if (ok) return;
      } catch {}
    }

    // 4. Return SVG fallback badge rather than 502 error so browser/canvas renders gracefully
    const titleText = (desc || mfg || 'PRODUTO').slice(0, 32).toUpperCase();
    const subText = (mfg || 'VENDAS HBN1').slice(0, 24).toUpperCase();
    const cleanEanText = cleanEan ? `EAN: ${cleanEan}` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f8fafc"/>
      <rect x="24" y="24" width="352" height="352" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
      <circle cx="200" cy="150" r="48" fill="#f1f5f9"/>
      <path d="M184 166 L216 166 L208 140 L198 152 L192 144 Z" fill="#94a3b8"/>
      <circle cx="214" cy="136" r="6" fill="#cbd5e1"/>
      <text x="200" y="240" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700" fill="#1e293b" text-anchor="middle">${titleText}</text>
      <text x="200" y="268" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" font-weight="600" fill="#f97316" text-anchor="middle">${subText}</text>
      ${cleanEanText ? `<text x="200" y="292" font-family="monospace" font-size="10" fill="#94a3b8" text-anchor="middle">${cleanEanText}</text>` : ''}
    </svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(svg));
  } catch (err: any) {
    console.warn("Proxy image error:", err.message);
    // Even on catastrophic error, return clean SVG instead of breaking UI
    const titleText = (desc || 'PRODUTO').slice(0, 30);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#f8fafc"/><text x="150" y="150" font-family="sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">${titleText}</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(Buffer.from(svg));
  }
});

apiRouter.post("/gemini/search-image", async (req, res) => {
  try {
    const { description, manufacturer } = req.body;
    if (!description) {
      return res.status(400).json({ error: "Descrição do produto não fornecida." });
    }

    const ai = getGeminiClient();
    const prompt = `Encontre URLs de imagens diretas e de alta qualidade para o produto: ${description} ${manufacturer || ''}. 
    Retorne uma lista JSON com exatamente 5 URLs de imagens funcionais que apontem diretamente para arquivos de imagem comuns (como jpg ou png). 
    Seja preciso e evite sites que bloqueiam acesso direto. 
    Apenas o JSON, nada mais. Formato: ["url1", "url2", ...]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text;
    if (text) {
      let urls: string[] = [];
      try {
        const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        urls = JSON.parse(clean);
      } catch (parseErr) {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          urls = JSON.parse(jsonMatch[0]);
        } else {
          throw parseErr;
        }
      }
      res.json(urls);
    } else {
      res.status(500).json({ error: "O Gemini não retornou nenhum resultado." });
    }
  } catch (error: any) {
    handleGeminiError(error, res);
  }
});

apiRouter.post("/product/update-image", async (req, res) => {
  try {
    const { id, imageUrl, sheetName, ean, description } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    
    if (!id && !ean && !description) {
      return res.status(400).json({ error: "Identificador do produto ausente (id, ean ou description)." });
    }

    let cleanUrl = String(imageUrl || "").trim();
    if (cleanUrl) {
      cleanUrl = cleanUrl.replace(/^(https?:\/\/)+https?:\/\//i, 'https://');
      if (cleanUrl.includes('_next/image') || cleanUrl.includes('/_ipx/')) {
        const match = cleanUrl.match(/[?&](?:url|src)=([^&]+)/i);
        if (match && match[1]) {
          cleanUrl = decodeURIComponent(match[1]);
        }
      }
      if (cleanUrl.includes('google.') && (cleanUrl.includes('imgres') || cleanUrl.includes('/url?'))) {
        const match = cleanUrl.match(/[?&](?:imgurl|url|q)=(https?%3A%2F%2F[^&]+|https?:\/\/[^&]+)/i);
        if (match && match[1]) {
          cleanUrl = decodeURIComponent(match[1]);
        }
      }
    }
    const sheets = await getSheetsClient();

    const normalizeStr = (str: string) => 
      String(str || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const cleanNum = (s: any) => String(s || "").trim().replace(/\D/g, '').replace(/^0+/, '');
    const cleanId = String(id || "").trim();
    const cleanTargetNum = cleanNum(id);
    const cleanTargetEan = cleanNum(ean);
    const cleanTargetDesc = normalizeStr(description);

    // Prepare candidate sheet list prioritizing the one sent from client
    const candidateSheets: string[] = [];
    if (sheetName) {
      candidateSheets.push(sheetName);
    }
    ['Produtos', 'Ofertas', 'Lancamentos'].forEach(s => {
      if (!candidateSheets.some(c => normalizeStr(c) === normalizeStr(s))) {
        candidateSheets.push(s);
      }
    });

    const getColumnLetter = (colIndex: number) => {
      let temp = colIndex;
      let letter = "";
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    let updatedSheetsCount = 0;
    const updatedDetails: any[] = [];

    for (const currentSheet of candidateSheets) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: currentSheet,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) continue;

        const headers = rows[0];
        const idIdx = headers.findIndex((h: string) => {
          const normalizedH = normalizeStr(h);
          return ["idproduto", "id", "codigo", "cod"].includes(normalizedH) || normalizedH.includes("id");
        });

        const eanIdx = headers.findIndex((h: string) => {
          const normalizedH = normalizeStr(h);
          return ["ean", "barras", "gtin", "codigobarras"].includes(normalizedH) || normalizedH.includes("ean") || normalizedH.includes("barras");
        });

        const descIdx = headers.findIndex((h: string) => {
          const normalizedH = normalizeStr(h);
          return ["descricao", "desc", "nome", "produto"].includes(normalizedH) || normalizedH.includes("desc");
        });

        const photoIdx = headers.findIndex((h: string) => {
          const normalizedH = normalizeStr(h);
          return ["foto", "imagem", "url", "photo", "link", "img"].includes(normalizedH) || normalizedH.includes("foto");
        });

        // Find all rows matching ID, EAN, or Description
        const matchingRowIndices: number[] = [];
        rows.forEach((row: any[], idx: number) => {
          if (idx === 0) return;
          const rowId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
          const rowIdNum = cleanNum(rowId);

          if (cleanId && rowId && (rowId === cleanId || (cleanTargetNum && rowIdNum && cleanTargetNum === rowIdNum))) {
            matchingRowIndices.push(idx);
            return;
          }

          if (cleanTargetEan && eanIdx !== -1) {
            const rowEan = cleanNum(row[eanIdx]);
            if (rowEan && rowEan === cleanTargetEan) {
              matchingRowIndices.push(idx);
              return;
            }
          }

          if (cleanTargetDesc && descIdx !== -1 && cleanTargetDesc.length > 5) {
            const rowDesc = normalizeStr(row[descIdx]);
            if (rowDesc === cleanTargetDesc) {
              matchingRowIndices.push(idx);
              return;
            }
          }
        });

        if (matchingRowIndices.length > 0) {
          let targetPhotoIdx = photoIdx;
          if (targetPhotoIdx === -1) {
            // Photo column doesn't exist, create it at the end of headers
            targetPhotoIdx = headers.length;
            const colLetter = getColumnLetter(targetPhotoIdx);
            
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${currentSheet}!${colLetter}1`,
              valueInputOption: "RAW",
              requestBody: {
                values: [["Foto"]],
              },
            });
          }

          const colLetter = getColumnLetter(targetPhotoIdx);

          // Update each matching row
          for (const rowIdx of matchingRowIndices) {
            const sheetRowNumber = rowIdx + 1;
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${currentSheet}!${colLetter}${sheetRowNumber}`,
              valueInputOption: "RAW",
              requestBody: {
                values: [[cleanUrl]],
              },
            });
            updatedDetails.push({ sheet: currentSheet, row: sheetRowNumber });
          }
          updatedSheetsCount++;
        }
      } catch (sheetErr: any) {
        console.warn(`[update-image] Aba "${currentSheet}" não acessível ou com erro:`, sheetErr.message);
      }
    }

    // Invalidate data caches for this spreadsheet so UI gets immediate fresh data
    Object.keys(dataCache).forEach(k => {
      if (k.startsWith(spreadsheetId)) {
        delete dataCache[k];
      }
    });

    console.log(`[update-image] Imagem atualizada para o produto ${id || ean || description} em ${updatedDetails.length} linha(s) das abas.`);
    res.json({ success: true, updatedCount: updatedDetails.length, details: updatedDetails });
  } catch (error: any) {
    console.error("Error updating image in Sheets:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Google Sheets Client Lazy Initialization
let sheetsClient: any = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  let authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!authJson) {
    throw new Error(
      "A variável de ambiente GOOGLE_SERVICE_ACCOUNT_JSON não está configurada. " +
      "Se você estiver no Netlify, adicione esta variável em 'Site Configuration' -> 'Environment variables' " +
      "com o conteúdo completo do seu arquivo JSON de Conta de Serviço Google Cloud. " +
      "Dica: Para evitar erros de formatação com quebras de linha no Netlify, você pode codificar o JSON em Base64 e salvar a string única gerada!"
    );
  }

  // Handle Base64-encoded JSON strings (very common in automated deployments like Netlify/Vercel)
  if (authJson && !authJson.startsWith('{') && !authJson.startsWith('[') && !authJson.includes(' ')) {
    try {
      const decoded = Buffer.from(authJson, 'base64').toString('utf8');
      if (decoded.startsWith('{')) {
        console.log("Successfully decoded GOOGLE_SERVICE_ACCOUNT_JSON from Base64 representation");
        authJson = decoded;
      }
    } catch (b64Err) {
      console.warn("Attempted to decode GOOGLE_SERVICE_ACCOUNT_JSON as Base64, but failed. Proceeding with raw string.", b64Err);
    }
  }

  // Handle cases where the secret might be wrapped in quotes (common copy-paste issue)
  if ((authJson.startsWith('"') && authJson.endsWith('"')) || 
      (authJson.startsWith("'") && authJson.endsWith("'"))) {
    authJson = authJson.slice(1, -1).trim();
  }

  // Handle common escaping issues
  let credentials;
  try {
    credentials = JSON.parse(authJson);
  } catch (e) {
    try {
      // Try to unescape if it looks like a stringified JSON
      credentials = JSON.parse(JSON.parse(`"${authJson}"`));
    } catch (e2) {
      const preview = authJson.substring(0, 30) + "...";
      let message = `Erro ao analisar GOOGLE_SERVICE_ACCOUNT_JSON. O valor começa com "${preview}".`;
      
      if (authJson.includes('@') && !authJson.startsWith('{')) {
        message += " Parece que você colou apenas o EMAIL da conta de serviço. Você deve copiar o conteúdo JSON COMPLETO do arquivo de chave.";
      } else {
        message += " Verifique se colou o conteúdo JSON COMPLETO do arquivo de chave da sua conta de serviço (incluindo as chaves {}).";
      }
      
      throw new Error(message);
    }
  }

  // Normalize private key escapes (extremely common on Netlify, Vercel, and Cloud environments)
  if (credentials && credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  // Lightweight REST client instead of heavy googleapis package
  // This fully prevents Netlify/Vercel/serverless bundle size and dynamic require issue!
  let cachedToken: string | null = null;
  let tokenExpiryTime = 0;

  const toBase64Url = (str: string | Buffer): string => {
    const buf = typeof str === 'string' ? Buffer.from(str) : str;
    return buf.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < tokenExpiryTime - 60) {
      return cachedToken;
    }

    try {
      const header = { alg: 'RS256', typ: 'JWT' };
      const claim = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const base64Header = toBase64Url(JSON.stringify(header));
      const base64Claim = toBase64Url(JSON.stringify(claim));
      const signatureInput = `${base64Header}.${base64Claim}`;

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signatureInput);
      const signature = toBase64Url(sign.sign(credentials.private_key));

      const jwt = `${signatureInput}.${signature}`;

      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      });

      cachedToken = tokenResponse.data.access_token;
      tokenExpiryTime = now + (tokenResponse.data.expires_in || 3600);
      return cachedToken;
    } catch (tokenErr: any) {
      console.error("Error generating Google Auth Access Token:", tokenErr?.response?.data || tokenErr.message);
      throw new Error(`Google Auth error: ${tokenErr?.response?.data?.error_description || tokenErr.message}`);
    }
  }

  const axiosInstance = axios.create({
    timeout: 30000,
  });

  // Automatic retry with exponential backoff for rate-limiting (429) and transient errors (500/502/503/504)
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config;
      if (!config) return Promise.reject(error);

      const status = error.response?.status;
      const shouldRetry = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
      const retryCount = config.__retryCount || 0;

      if (shouldRetry && retryCount < 4) {
        config.__retryCount = retryCount + 1;
        const delay = Math.pow(2, config.__retryCount) * 1000 + Math.floor(Math.random() * 500);
        console.warn(`[Google Sheets API] Status ${status} detectado. Tentando novamente em ${delay}ms (Tentativa ${config.__retryCount}/4)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return axiosInstance(config);
      }
      return Promise.reject(error);
    }
  );

  sheetsClient = {
    spreadsheets: {
      get: async ({ spreadsheetId }: { spreadsheetId: string }) => {
        const token = await getAccessToken();
        return axiosInstance.get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      },
      values: {
        get: async ({ spreadsheetId, range }: { spreadsheetId: string, range: string }) => {
          const token = await getAccessToken();
          return axiosInstance.get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        update: async ({ spreadsheetId, range, valueInputOption, requestBody }: { spreadsheetId: string, range: string, valueInputOption: string, requestBody: any }) => {
          const token = await getAccessToken();
          return axiosInstance.put(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`, requestBody, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        append: async ({ spreadsheetId, range, valueInputOption, requestBody }: { spreadsheetId: string, range: string, valueInputOption: string, requestBody: any }) => {
          const token = await getAccessToken();
          return axiosInstance.post(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`, requestBody, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        clear: async ({ spreadsheetId, range }: { spreadsheetId: string, range: string }) => {
          const token = await getAccessToken();
          return axiosInstance.post(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    }
  };

  return sheetsClient;
}

function cleanSpreadsheetId(id: string) {
  if (!id) return "";
  
  // If the ID starts with 'AIza', it's likely an API Key and NOT a Spreadsheet ID.
  // In this case, we'll ignore it and use the default ID.
  if (id.trim().startsWith("AIza")) {
    console.warn("WARNING: GOOGLE_SHEET_ID secret starts with 'AIza' (API Key). Ignoring it to use the correct Spreadsheet ID.");
    return "1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs";
  }

  // If user pasted the full URL, extract the ID
  const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const extractedId = match ? match[1] : id.trim();
  
  return extractedId;
}

// API Routes Metadata & Sheet Names Cache
let cachedSpreadsheetInfo: Record<string, any> = {};
let cachedMetadataFetchTime: Record<string, number> = {};
const METADATA_CACHE_DURATION = 300000; // 5 minutes cache for spreadsheet metadata

async function getSpreadsheetSheetNames(sheets: any, spreadsheetId: string): Promise<string[]> {
  const now = Date.now();
  if (cachedSpreadsheetInfo[spreadsheetId]?.sheets && (now - (cachedMetadataFetchTime[spreadsheetId] || 0) < METADATA_CACHE_DURATION)) {
    return cachedSpreadsheetInfo[spreadsheetId].sheets;
  }
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitles = response.data.sheets?.map((s: any) => s.properties.title) || [];
    cachedSpreadsheetInfo[spreadsheetId] = {
      ...(cachedSpreadsheetInfo[spreadsheetId] || {}),
      title: response.data.properties?.title,
      sheets: sheetTitles,
    };
    cachedMetadataFetchTime[spreadsheetId] = now;
    return sheetTitles;
  } catch (err: any) {
    if (cachedSpreadsheetInfo[spreadsheetId]?.sheets?.length > 0) {
      return cachedSpreadsheetInfo[spreadsheetId].sheets;
    }
    throw err;
  }
}

apiRouter.get("/status", async (req, res) => {
  const spreadsheetId = getRequestSpreadsheetId(req);
  console.log(`[Status] Check requested for: ${spreadsheetId}`);
  try {
    let authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    if (!authJson) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is missing from Secrets." 
      });
    }

    // Handle Base64-encoded JSON strings
    if (authJson && !authJson.startsWith('{') && !authJson.startsWith('[') && !authJson.includes(' ')) {
      try {
        const decoded = Buffer.from(authJson, 'base64').toString('utf8');
        if (decoded.startsWith('{')) {
          authJson = decoded;
        }
      } catch (b64Err) {
        console.warn("Attempted to decode GOOGLE_SERVICE_ACCOUNT_JSON as Base64, but failed.", b64Err);
      }
    }

    let credentials;
    try {
      let cleanedJson = authJson;
      if ((cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) || 
          (cleanedJson.startsWith("'") && cleanedJson.endsWith("'"))) {
        cleanedJson = cleanedJson.slice(1, -1).trim();
      }
      try {
        credentials = JSON.parse(cleanedJson);
      } catch (innerErr) {
        credentials = JSON.parse(JSON.parse(`"${cleanedJson}"`));
      }
      if (credentials && credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." 
      });
    }

    const serviceAccountEmail = credentials?.client_email || "";
    let isApiKey = spreadsheetId.startsWith("AIza");
    let spreadsheetError = null;

    try {
      const sheets = await getSheetsClient();
      const sheetTitles = await getSpreadsheetSheetNames(sheets, spreadsheetId);
      cachedSpreadsheetInfo[spreadsheetId] = {
        title: cachedSpreadsheetInfo[spreadsheetId]?.title,
        sheets: sheetTitles,
        headers: {}
      };
    } catch (err: any) {
      spreadsheetError = err.message;
      if (err.code === 404 && isApiKey) {
        spreadsheetError = `ERRO CRÍTICO: O ID "${spreadsheetId}" não foi encontrado. Este valor parece ser uma CHAVE DE API (começa com 'AIza'). Você deve usar o ID da Planilha que fica na URL do navegador. Exemplo: 1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs`;
      } else if (err.code === 404) {
        spreadsheetError = `Planilha não encontrada (ID: ${spreadsheetId}). Verifique se o ID está correto e se você compartilhou a planilha com o e-mail: ${serviceAccountEmail}`;
      }
    }

    res.json({
      ok: !spreadsheetError,
      serviceAccountEmail,
      spreadsheetId,
      isApiKey,
      spreadsheetInfo: cachedSpreadsheetInfo[spreadsheetId],
      spreadsheetError,
      instructions: [
        `1. Open your Google Sheet in your browser.`,
        `2. Copy the ID from the URL (the long string between '/d/' and '/edit').`,
        `3. Update the GOOGLE_SHEET_ID secret in AI Studio.`,
        `4. Share the sheet with: ${serviceAccountEmail}`
      ]
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const dataCache: Record<string, { data: any, timestamp: number }> = {};
const DATA_CACHE_DURATION = 10000; // 10 seconds cache to prevent Google API rate limits & fast responses

export function invalidateSheetCache(spreadsheetId: string, sheetName?: string) {
  if (sheetName) {
    delete dataCache[`${spreadsheetId}_${sheetName}`];
  } else {
    Object.keys(dataCache).forEach(k => {
      if (k.startsWith(`${spreadsheetId}_`)) {
        delete dataCache[k];
      }
    });
  }
}

apiRouter.get("/data/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const fetchNow = Date.now();

    const cacheKey = `${spreadsheetId}_${sheetName}`;

    // Check cache
    if (req.query.nocache !== '1' && dataCache[cacheKey] && (fetchNow - dataCache[cacheKey].timestamp < DATA_CACHE_DURATION)) {
      return res.json(dataCache[cacheKey].data);
    }

    const sheets = await getSheetsClient();
    
    let rows: any[][] | null = null;

    // Fast path: fetch directly by range name to save metadata quota
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });
      rows = response.data.values || [];
    } catch (err: any) {
      // If direct fetch fails (case difference, etc.), resolve tab name from cached metadata
      console.warn(`Direct fetch for sheet "${sheetName}" failed, resolving sheet name:`, err.message);
      let availableSheets: string[] = [];
      try {
        availableSheets = await getSpreadsheetSheetNames(sheets, spreadsheetId);
      } catch (metaErr: any) {
        if (err.code === 404) {
          return res.status(404).json({
            error: `Spreadsheet ID "${spreadsheetId}" not found.`,
            details: "Check your GOOGLE_SHEET_ID secret. Ensure the ID is correct and the Service Account has access."
          });
        }
        throw err;
      }

      const targetSheet = availableSheets.find(s => s.trim().toLowerCase() === sheetName.trim().toLowerCase());
      if (!targetSheet) {
        return res.status(404).json({
          error: `Sheet "${sheetName}" not found in spreadsheet.`,
          availableSheets,
          details: `Available tabs are: ${availableSheets.join(", ")}. Please ensure your Google Sheet has a tab named exactly "${sheetName}".`
        });
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: targetSheet,
      });
      rows = response.data.values || [];
    }

    if (!rows || rows.length === 0) {
      const emptyData: any[] = [];
      dataCache[cacheKey] = { data: emptyData, timestamp: fetchNow };
      return res.json(emptyData);
    }

    const headers = (rows[0] || []).map((h: any) => String(h || '').trim());
    const data = rows.slice(1).map((row: any) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index];
      });
      return obj;
    });

    // Update cache
    dataCache[cacheKey] = { data, timestamp: fetchNow };

    res.json(data);
  } catch (error: any) {
    console.error(`Error fetching sheet ${req.params.sheetName}:`, error);
    res.status(500).json({ 
      error: "Error fetching data from Sheets", 
      message: error.message,
      stack: error.stack,
      details: error.details || error,
      sheet: req.params.sheetName 
    });
  }
});

apiRouter.post("/order", async (req, res) => {
  try {
    const order = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const sheets = await getSheetsClient();

    // 1. Save to Pedidos sheet
    // IDPedido, Data, IDCliente, Nome Cliente, Email, Vendedor, Celular, Total, Status, Itens, Observacao, PdfUrl
    const orderRow = [
      order.id,
      order.date,
      order.clientId,
      order.clientName,
      order.email,
      order.seller,
      order.phone,
      order.total,
      order.status,
      `${order.items.length} itens`,
      order.observation,
      order.pdfUrl || ""
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Pedidos!A:L",
      valueInputOption: "RAW",
      requestBody: {
        values: [orderRow],
      },
    });

    // 2. Read and filter out CARRINHO_${order.clientId} from ItensPedido, then append new order items
    const range = "ItensPedido!A:I";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    let headers = ["IDItem", "IDPedido", "IDProduto", "Codigo de Barras", "Descricao", "Fabricante", "Qtd", "Preco", "Subtotal"];
    if (rows.length > 0) {
      headers = rows[0];
    }

    const cartId = `CARRINHO_${order.clientId}`;
    const rawClientId = String(order.clientId || "").trim().toLowerCase();
    const cleanClientId = rawClientId.replace(/\D/g, '');

    const nonCartRows = rows.slice(1).filter((row: any[]) => {
      const rowCartId = String(row[1] || "").trim().toLowerCase();
      if (rowCartId === `carrinho_${rawClientId}`) return false;
      if (rawClientId && rowCartId.includes(rawClientId)) return false;
      if (cleanClientId.length >= 6 && rowCartId.includes(cleanClientId)) return false;
      return true;
    });

    // Finalized order items
    const itemRows = order.items.map((item: any, index: number) => [
      `${order.id}-${index + 1}`,
      order.id,
      item.id,
      item.ean || "",
      item.description,
      item.manufacturer || "",
      item.quantity,
      item.finalPrice,
      item.quantity * item.finalPrice
    ]);

    const finalRows = [headers, ...nonCartRows, ...itemRows];

    // Clear and write back to ItensPedido
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "ItensPedido!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: finalRows,
      },
    });

    invalidateSheetCache(spreadsheetId, 'Pedidos');
    invalidateSheetCache(spreadsheetId, 'ItensPedido');

    res.json({ sucesso: true, idPedido: order.id });
  } catch (error: any) {
    console.error("Error saving order to Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/cart/save", async (req, res) => {
  try {
    const { clientId, items } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    
    if (!clientId) {
      return res.status(400).json({ error: "Missing clientId" });
    }

    const sheets = await getSheetsClient();
    const range = "ItensPedido!A:I";

    // Read existing rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    let headers = ["IDItem", "IDPedido", "IDProduto", "Codigo de Barras", "Descricao", "Fabricante", "Qtd", "Preco", "Subtotal"];
    if (rows.length > 0) {
      headers = rows[0];
    }

    const cartId = `CARRINHO_${clientId}`;
    const rawClientId = String(clientId || "").trim().toLowerCase();
    const cleanClientId = rawClientId.replace(/\D/g, '');

    // Filter out previous cart rows for this client
    const nonCartRows = rows.slice(1).filter((row: any[]) => {
      const rowCartId = String(row[1] || "").trim().toLowerCase();
      if (rowCartId === `carrinho_${rawClientId}`) return false;
      if (rawClientId && rowCartId.includes(rawClientId)) return false;
      if (cleanClientId.length >= 6 && rowCartId.includes(cleanClientId)) return false;
      return true;
    });

    // Create new cart rows
    const newCartRows = (items || []).map((item: any, idx: number) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.finalPrice) || 0;
      return [
        `${cartId}_${item.id}`,       // IDItem
        cartId,                       // IDPedido
        String(item.id),              // IDProduto
        String(item.ean || ""),       // Codigo de Barras
        String(item.description || ""), // Descricao
        String(item.manufacturer || ""), // Fabricante
        quantity,                     // Qtd
        price,                        // Preco
        quantity * price              // Subtotal
      ];
    });

    const finalRows = [headers, ...nonCartRows, ...newCartRows];

    // Clear and write back
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "ItensPedido!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: finalRows,
      },
    });

    // Dynamic handling of Carrinhos sheet overview
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetNames = (meta.data.sheets || []).map(s => s.properties?.title || "");
      let targetSheetName = sheetNames.find(name => 
        ['carrinhos', 'carrinho'].includes(name.toLowerCase())
      );

      if (!targetSheetName) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: "Carrinhos"
                    }
                  }
                }
              ]
            }
          });
          targetSheetName = "Carrinhos";
          // Initialize headers for new sheet
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: "Carrinhos!A1",
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [["IDCliente", "Cliente", "Data", "Itens", "Total"]]
            }
          });
        } catch (sheetErr) {
          console.error("Could not create Carrinhos sheet dynamically:", sheetErr);
        }
      }

      if (targetSheetName) {
        // Resolve client name
        let clientName = `Cliente ${clientId}`;
        try {
          const clientesRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Clientes!A:C",
          });
          const clientesRows = clientesRes.data.values || [];
          for (let k = 1; k < clientesRows.length; k++) {
            if (String(clientesRows[k][0] || "").trim() === String(clientId).trim()) {
              clientName = String(clientesRows[k][1] || clientesRows[k][2] || clientName).trim();
              break;
            }
          }
        } catch (err) {
          console.warn("Could not fetch client name from Clientes sheet:", err);
        }

        const carrinhosRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${targetSheetName}!A:E`,
        });
        const carrinhosRows = carrinhosRes.data.values || [];
        let carrinhosHeaders = ["IDCliente", "Cliente", "Data", "Itens", "Total"];
        if (carrinhosRows.length > 0) {
          carrinhosHeaders = carrinhosRows[0];
        }

        const nonClientCarrinhoRows = carrinhosRows.slice(1).filter((row: any[]) => {
          const rowId = String(row[0] || "").trim().toLowerCase();
          const rowClientName = String(row[1] || "").trim().toLowerCase();
          if (rowId === rawClientId) return false;
          if (rawClientId && rowId.includes(rawClientId)) return false;
          if (cleanClientId.length >= 6 && (rowId.includes(cleanClientId) || rowId.replace(/\D/g, '').includes(cleanClientId))) return false;
          if (rawClientId.length >= 4 && rowClientName.includes(rawClientId)) return false;
          return true;
        });

        const total = (items || []).reduce((acc: number, item: any) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.finalPrice) || 0;
          return acc + (qty * price);
        }, 0);

        const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

        if (items && items.length > 0) {
          const newRow = [
            String(clientId),
            clientName,
            nowStr,
            items.length,
            total
          ];
          const finalCarrinhosRows = [carrinhosHeaders, ...nonClientCarrinhoRows, newRow];

          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${targetSheetName}!A:E`,
          });

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${targetSheetName}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: finalCarrinhosRows,
            },
          });
        } else {
          // Empty items, remove from overview
          const finalCarrinhosRows = [carrinhosHeaders, ...nonClientCarrinhoRows];

          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${targetSheetName}!A:E`,
          });

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${targetSheetName}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: finalCarrinhosRows,
            },
          });
        }
      }
    } catch (carrinhoErr) {
      console.error("Error managing Carrinhos overview sheet:", carrinhoErr);
    }

    invalidateSheetCache(spreadsheetId, 'ItensPedido');
    invalidateSheetCache(spreadsheetId, 'Carrinhos');

    res.json({ sucesso: true });
  } catch (error: any) {
    console.error("Error saving cart to Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get("/cart/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const sheets = await getSheetsClient();

    const range = "ItensPedido!A:I";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json([]);
    }

    const cartId = `CARRINHO_${clientId}`;

    // Columns: IDItem, IDPedido, IDProduto, Codigo de Barras, Descricao, Fabricante, Qtd, Preco, Subtotal
    const cartRows = rows.slice(1).filter((row: any[]) => {
      return String(row[1] || "").trim() === cartId;
    });

    const items = cartRows.map((row: any[]) => {
      const quantity = Number(row[6]) || 0;
      const finalPrice = Number(row[7]) || 0;
      return {
        id: String(row[2] || ""),
        ean: String(row[3] || ""),
        description: String(row[4] || ""),
        manufacturer: String(row[5] || ""),
        quantity,
        finalPrice,
        stock: 999, // placeholder, client-side will merge
        salePrice: finalPrice,
        discount: 0,
        category: "",
        photo: "",
        type: "normal" as const
      };
    });

    res.json(items);
  } catch (error: any) {
    console.error("Error getting cart from Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/catalog/update", async (req, res) => {
  try {
    const { industria, dados, defaultExpiryDate } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const data = dados;
    const industry = industria;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Dados inválidos ou vazios (dados/data)." });
    }

    const sheets = await getSheetsClient();

    // Industry-specific column mappings (0-indexed)
    // Based on the provided mapping table image
    const INDUSTRY_MAPPINGS: Record<string, any> = {
      'DANONE': { id: 1, ean: 0, desc: 3, stock: 9, price: 5, discount: 4, final: 7 },
      'UNILEVER': { id: 1, ean: 2, desc: 3, stock: 7, price: 8, discount: 11, final: 12 }, 
      'KIMBERLY': { id: 1, ean: 1, desc: 2, stock: 3, price: 4, discount: 5, final: 6 },
      'KENVUE': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
      'OMRON': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
    };

    // 1. Get current data from all 3 sheets
    const sheetsToSync = ["Produtos", "Ofertas", "Lancamentos"];
    console.log(`Updating catalog for industry: ${industria} on spreadsheet ${spreadsheetId} across all sheets: ${sheetsToSync.join(", ")}`);

    const sheetData: Record<string, { rows: any[][], headers: any[] }> = {};
    const existingProductsMap = new Map<string, { row: any[], sheetName: string }[]>();

    // Sequential fetch to avoid issues, or Promise.all for speed
    await Promise.all(sheetsToSync.map(async (sheetName) => {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: sheetName,
        });
        
        const allRows = response.data.values || [];
        if (allRows.length > 0) {
          const headers = allRows[0];
          sheetData[sheetName] = { rows: allRows, headers };

          // A: ID, B: EAN
          const idIdx = 0;
          const eanIdx = 1;

          allRows.slice(1).forEach(row => {
            const id = String(row[idIdx] || "").trim();
            const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
            const ean = normalizeEAN(rawEan);
            
            const entry = { row, sheetName };
            if (id && id.length >= 2) {
              if (!existingProductsMap.has(id)) existingProductsMap.set(id, []);
              existingProductsMap.get(id)!.push(entry);
            }
            if (ean) {
              if (!existingProductsMap.has(ean)) existingProductsMap.set(ean, []);
              existingProductsMap.get(ean)!.push(entry);
            }
          });
        }
      } catch (e) {
        console.warn(`Sheet ${sheetName} not found or inaccessible on ${spreadsheetId}, skipping.`);
      }
    }));

    if (Object.keys(sheetData).length === 0) {
      return res.status(404).json({ error: "Nenhuma das planilhas de produtos (Produtos/Ofertas/Lancamentos) foi encontrada." });
    }

    // Common indices for all sheets (A to G)
    const idIdx = 0;
    const eanIdx = 1;
    const descIdx = 2;
    const stockIdx = 3;
    const priceIdx = 4;
    const discIdx = 5;
    const finalIdx = 6;
    const validIdx = 7;
    
    // Process the uploaded data
    const mapping = INDUSTRY_MAPPINGS[industria.toUpperCase()] || INDUSTRY_MAPPINGS['UNILEVER'];
    
    // Try to find the header row in the source data (first 10 rows)
    let sourceHeaders: string[] = [];
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (Array.isArray(row) && row.some(cell => {
        const s = String(cell || "").toLowerCase();
        return s.includes("ean") || s.includes("codigo") || s.includes("descri") || s.includes("produto");
      })) {
        sourceHeaders = row.map(h => String(h || "").trim());
        headerRowIdx = i;
        break;
      }
    }

    const headerNormalized = sourceHeaders.map(h => 
      String(h || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );

    const getSourceIndex = (names: string[], excludeSubstrings: string[] = []) => {
      const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const normalizedExcludes = excludeSubstrings.map(x => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      const isExcluded = (h: string) => normalizedExcludes.some(ex => h.includes(ex));

      // Pass 1: Exact equality
      for (const name of normalizedNames) {
        const idx = headerNormalized.findIndex(h => h === name && !isExcluded(h));
        if (idx !== -1) return idx;
      }
      
      // Pass 2: Exact word boundary match or prefix match with space
      for (const name of normalizedNames) {
        if (name.length < 3) continue;
        const idx = headerNormalized.findIndex(h => (h === name || h.startsWith(name + " ") || h.endsWith(" " + name)) && !isExcluded(h));
        if (idx !== -1) return idx;
      }

      // Pass 3: General startsWith
      for (const name of normalizedNames) {
        if (name.length < 3) continue;
        const idx = headerNormalized.findIndex(h => h.startsWith(name) && !isExcluded(h));
        if (idx !== -1) return idx;
      }

      // Pass 4: Includes
      for (const name of normalizedNames) {
        if (name.length < 4) continue;
        const idx = headerNormalized.findIndex(h => h.includes(name) && !isExcluded(h));
        if (idx !== -1) return idx;
      }

      return -1;
    };

    const mappedIndices = {
      id: getSourceIndex(["IDProduto", "ID_Produto", "Codigo", "Cod", "Código", "CÓD", "CODIGO", "ID"], ["ean", "desc"]),
      ean: getSourceIndex(["EAN", "Codigo Barras", "Código de Barras", "EAN13", "GTIN", "BARRAS"]),
      desc: getSourceIndex(["Descrição", "Descricao", "Nome", "Produto", "Descricao Produto", "PRODUTO", "NOME"], ["desc tot", "%desc", "desconto", "validade"]),
      stock: getSourceIndex(["Estoque", "Sald", "Saldo", "QTDE", "Qtde", "Quant", "Quantidade", "STOCK", "DISPONIVEL", "QTD DISP", "ESTOQ", "ESTOQUE", "UNIDADES", "UNID"]),
      price: getSourceIndex(["PREÇO FABRIC", "PRECO FABRIC", "PREÇO FABRICA", "PRECO FABRICA", "PREÇO TABELA", "PRECO TABELA", "PREÇO VENDA", "PRECO VENDA", "PV", "PREÇO", "PRECO", "VALOR", "TABELA", "UNITARIO", "UNITÁRIO", "PREÇO UNITARIO", "VALOR UNITARIO"], ["desc", "fin", "liquido", "c/ desc"]),
      discount: getSourceIndex(["%DESC TOT", "% DESC TOT", "DESC TOT", "DESCONTO TOT", "DESCONTO TOTAL", "%DESC", "% DESC", "%DESCONTO", "% DESCONTO", "PERC DESCONTO", "DESCONTO %", "DESC TOTAL", "DESC. TOT.", "DESCONTO", "PERCENTUAL", "BONUS", "DESC"], ["descricao", "description", "nome", "produto", "marca", "fabricante", "validade"]),
      final: getSourceIndex(["PREÇO FIN", "PRECO FIN", "PREÇO FINAL", "PRECO FINAL", "PREÇO C/ DESC", "PRECO C/ DESC", "PRECO C DESC", "PF", "Preço Final", "Preco Final", "VALOR FINAL", "PRECO LIQUIDO", "PRECO LÍQUIDO", "VALOR LIQUIDO", "LIQUIDO"]),
      valid: getSourceIndex(["VALOR VALIDADE", "VALIDADE", "VENCIMENTO", "DATA FIM", "EXPIRA", "VALIDADE DESCONTO"])
    };

    const hasSourceHeaders = sourceHeaders.length > 0;
    const isKimberlyInput = industria.toUpperCase().includes('KIMBERLY');
    console.log(`[Catalog Update] Industry: ${industria}, HasHeaders: ${hasSourceHeaders}, Kimberly: ${isKimberlyInput}`);
    if (hasSourceHeaders) {
      console.log(`[Catalog Update] Mapped Indices:`, mappedIndices);
    }

    const rowsToProcess = headerRowIdx !== -1 ? data.slice(headerRowIdx + 1) : data;
    
    let updatedCount = 0;
    let newCount = 0;
    const newProductsRows: any[][] = [];
    const log: string[] = [];
    const updatedProductsLog: string[] = [];
    const newProductsLog: string[] = [];

    log.push(`Iniciando atualização do catálogo ${industria}...`);
    log.push(`Planilha detectada com ${rowsToProcess.length} linhas de dados.`);
    if (hasSourceHeaders) {
      log.push(`Colunas encontradas: EAN(${mappedIndices.ean}), Preço(${mappedIndices.price}), Final(${mappedIndices.final}), Descrição(${mappedIndices.desc})`);
    }

    // --- LÓGICA DE DETECÇÃO E APAGAR COLUNAS (Estoque, Preco Venda, Desconto, Preco Final) ---
    const targetIndustry = industria.split(' ')[0].trim().toUpperCase();
    const targetIndustryIdsAndEans = new Set<string>();
    const clearedProductIdsAndEans = new Set<string>();

    const prodSheet = sheetData["Produtos"];
    if (prodSheet) {
      const prodHeaders = prodSheet.headers || [];
      const prodFabColIdx = prodHeaders.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
      
      if (prodFabColIdx !== -1) {
        prodSheet.rows.slice(1).forEach(row => {
          const rowFab = String(row[prodFabColIdx] || "").trim().toUpperCase();
          const matchesFab = rowFab === targetIndustry || rowFab.startsWith(targetIndustry) || targetIndustry.startsWith(rowFab);
          
          if (matchesFab) {
            const id = String(row[idIdx] || "").trim();
            const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
            const ean = normalizeEAN(rawEan);
            
            if (id) targetIndustryIdsAndEans.add(id);
            if (ean) targetIndustryIdsAndEans.add(ean);
          }
        });
      }
    }

    let clearedCountTotal = 0;
    
    Object.keys(sheetData).forEach(sheetName => {
      const sheet = sheetData[sheetName];
      const headers = sheet.headers || [];
      const sheetFabColIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
      
      sheet.rows.slice(1).forEach(row => {
        let belongsToIndustry = false;
        
        if (sheetFabColIdx !== -1 && row[sheetFabColIdx]) {
          const rowFab = String(row[sheetFabColIdx] || "").trim().toUpperCase();
          belongsToIndustry = rowFab === targetIndustry || rowFab.startsWith(targetIndustry) || targetIndustry.startsWith(rowFab);
        }
        
        if (!belongsToIndustry) {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          
          if ((id && targetIndustryIdsAndEans.has(id)) || (ean && targetIndustryIdsAndEans.has(ean))) {
            belongsToIndustry = true;
          }
        }
        
        if (belongsToIndustry) {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          const desc = String(row[descIdx] || "").trim();
          
          const label = [
            desc ? `"${desc}"` : "",
            id ? `ID: ${id}` : "",
            ean ? `EAN: ${ean}` : ""
          ].filter(Boolean).join(" | ");

          if (label) {
            clearedProductIdsAndEans.add(label);
          }

          while (row.length <= Math.max(stockIdx, priceIdx, discIdx, finalIdx)) {
            row.push("");
          }
          
          row[stockIdx] = "";
          row[priceIdx] = "";
          row[discIdx] = "";
          row[finalIdx] = "";
          clearedCountTotal++;
        }
      });
    });
    
    log.push(`Varredura concluída: Limpos valores de [Estoque, Preco Venda, Desconto, Preco Final] de ${clearedCountTotal} linhas de produto da indústria ${targetIndustry} antes da atualização.`);

    const applyCustomRounding = (val: number): number => {
      if (isNaN(val) || !isFinite(val)) return 0;
      const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
      if (rounded === 0.99) return 1.00;
      return rounded;
    };

    const cleanNumericString = (val: any): string => {
      if (val === null || val === undefined) return "0";
      if (typeof val === 'number') return isNaN(val) ? "0" : String(val);
      
      let s = String(val).trim();
      if (!s) return "0";

      // Remove currency signs (R$, $, €, BRL), %, quotes, spaces, non-breaking spaces
      s = s.replace(/R\$/gi, '')
           .replace(/\$/g, '')
           .replace(/€/g, '')
           .replace(/BRL/gi, '')
           .replace(/%/g, '')
           .replace(/["']/g, '')
           .replace(/\u00A0/g, ' ')
           .trim();

      if (!s) return "0";

      const hasComma = s.includes(',');
      const hasDot = s.includes('.');

      if (hasComma && hasDot) {
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
          // e.g. 1.234,56 (BR format)
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          // e.g. 1,234.56 (US format)
          s = s.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Only comma present. In Portuguese / BRL, comma is ALWAYS the decimal separator.
        s = s.replace(/\s+/g, '').replace(',', '.');
      } else if (hasDot) {
        // Only dot present.
        const dotCount = (s.match(/\./g) || []).length;
        if (dotCount > 1) {
          // e.g. 1.234.567 (multiple dots)
          s = s.replace(/\./g, '');
        }
        // Single dot is standard decimal format
      }

      // Keep digits, minus sign, and dot
      s = s.replace(/[^\d.-]/g, '');

      return s || "0";
    };

    const formatBrazilian = (num: any, isPercent = false) => {
      const cleaned = cleanNumericString(num);
      const val = parseFloat(cleaned);
      if (isNaN(val)) return num;
      // Use dot as decimal separator for spreadsheet storage as requested
      const s = val.toFixed(2);
      return isPercent ? `${s}%` : s;
    };

    const idsToRemoveFromOfertas = new Set<string>();
    const eansToRemoveFromOfertas = new Set<string>();
    let promotedOffersCount = 0;
    let updatedOffersCount = 0;

    rowsToProcess.forEach((item: any) => {
      let newId = "";
      let newEan = "";
      let newDesc = "";
      let newStock = "";
      let newPrice: any = "";
      let newDiscount: any = "";
      let newFinal: any = "";
      let newValid = "";

      if (Array.isArray(item)) {
        if (hasSourceHeaders) {
          newId = String(item[mappedIndices.id !== -1 ? mappedIndices.id : mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mappedIndices.ean !== -1 ? mappedIndices.ean : mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mappedIndices.desc !== -1 ? mappedIndices.desc : mapping.desc] || "").trim();
          newStock = String(item[mappedIndices.stock !== -1 ? mappedIndices.stock : mapping.stock] || "").trim();
          newPrice = String(item[mappedIndices.price !== -1 ? mappedIndices.price : mapping.price] || "").trim();
          newDiscount = String(item[mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount] || "").trim();
          newFinal = String(item[mappedIndices.final !== -1 ? mappedIndices.final : mapping.final] || "").trim();
          newValid = String(item[mappedIndices.valid !== -1 ? mappedIndices.valid : -1] || "").trim() || defaultExpiryDate || "";

          // Logical Check for prices and discounts
          let pVal = parseFloat(cleanNumericString(newPrice));
          let fVal = parseFloat(cleanNumericString(newFinal));
          let dVal = parseFloat(cleanNumericString(newDiscount));

          // Normalize percentage if read as decimal e.g. 0.10 -> 10, 0.02 -> 2
          if (dVal > 0 && dVal < 1) {
            dVal = Math.round((dVal * 100 + Number.EPSILON) * 100) / 100;
          }

          // HEURISTIC: If pVal looks like it's missing decimal (e.g. 8738 instead of 87.38)
          if (isKimberlyInput) {
            if (pVal > 1000 && pVal % 1 === 0) pVal /= 100;
            if (fVal > 1000 && fVal % 1 === 0) fVal /= 100;
            
            // Special User request: "ao inves de 1.00% é 10%"
            // If the user says "Desconto" is 1.00% but intends 10.00%
            if (dVal === 1) dVal = 10;
          }

          if (dVal > 0 && !isNaN(dVal)) {
            // Keep explicit discount
          }

          if (!isNaN(pVal) && pVal > 0) {
            newPrice = applyCustomRounding(pVal);
            
            // Priority 1: If explicit discount column is present and > 0, trust the discount column!
            if (!isNaN(dVal) && dVal > 0) {
              newDiscount = applyCustomRounding(dVal);
              newFinal = (!isNaN(fVal) && fVal > 0 && Math.abs(fVal - pVal) > 0.01)
                ? applyCustomRounding(fVal)
                : applyCustomRounding(pVal * (1 - newDiscount / 100));
            }
            // Priority 2: Use Final Price to calculate discount if explicit discount is not provided
            else if (!isNaN(fVal) && fVal > 0 && Math.abs(fVal - pVal) > 0.01) {
              newFinal = applyCustomRounding(fVal);
              const calculatedDisc = ((pVal - fVal) / pVal) * 100;
              newDiscount = calculatedDisc > 0 ? applyCustomRounding(calculatedDisc) : 0;
            } 
            // Fallback: No discount
            else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dVal);
            newFinal = applyCustomRounding(fVal);
          }
        } else {
          newId = String(item[mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mapping.desc] || "").trim();
          newStock = String(item[mapping.stock] || "").trim();
          
          let pValRaw = parseFloat(cleanNumericString(item[mapping.price]));
          let fValRaw = parseFloat(cleanNumericString(item[mapping.final]));
          let dValRaw = parseFloat(cleanNumericString(item[mapping.discount]));

          if (dValRaw > 0 && dValRaw < 1) {
            dValRaw = Math.round((dValRaw * 100 + Number.EPSILON) * 100) / 100;
          }

          if (isKimberlyInput) {
            if (pValRaw > 1000 && pValRaw % 1 === 0) pValRaw /= 100;
            if (fValRaw > 1000 && fValRaw % 1 === 0) fValRaw /= 100;
            if (dValRaw === 1) dValRaw = 10;
          }

          if (!isNaN(pValRaw) && pValRaw > 0) {
            newPrice = applyCustomRounding(pValRaw);
            
            if (!isNaN(dValRaw) && dValRaw > 0) {
              newDiscount = applyCustomRounding(dValRaw);
              newFinal = (!isNaN(fValRaw) && fValRaw > 0 && Math.abs(fValRaw - pValRaw) > 0.01)
                ? applyCustomRounding(fValRaw)
                : applyCustomRounding(pValRaw * (1 - newDiscount / 100));
            } else if (!isNaN(fValRaw) && fValRaw > 0 && Math.abs(fValRaw - pValRaw) > 0.01) {
              newFinal = applyCustomRounding(fValRaw);
              const calculated = ((pValRaw - fValRaw) / pValRaw) * 100;
              newDiscount = calculated > 0 ? applyCustomRounding(calculated) : 0;
            } else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dValRaw);
            newFinal = applyCustomRounding(fValRaw);
          }
        }
      }

      // Smart Fallback Scan if newEan or newId or newDesc is missing
      if (!newEan || !newId || !newDesc) {
        if (Array.isArray(item)) {
          for (let col = 0; col < item.length; col++) {
            const cellVal = String(item[col] || "").trim();
            if (!newEan && /^\d{8,14}$/.test(cellVal.replace(/['\s]/g, ''))) {
              newEan = normalizeEAN(cellVal);
            } else if (!newId && /^\d{5,7}$/.test(cellVal.replace(/['\s]/g, ''))) {
              newId = cellVal;
            } else if (!newDesc && cellVal.length > 5 && !/^\d+$/.test(cellVal) && !cellVal.includes("R$")) {
              newDesc = cellVal;
            }
          }
        }
      }

      const isJunk = !newId && !newEan;
      const isHeaderRepeat = newDesc.toLowerCase().includes("descri") || newId.toLowerCase().includes("id") || newEan.toLowerCase().includes("ean");
      
      if (isJunk || isHeaderRepeat) return;

      // Remove from clearedProductIdsAndEans if it was updated or imported
      const labelToRemove = Array.from(clearedProductIdsAndEans).find(label => {
        return (newId && label.includes(`ID: ${newId}`)) || 
               (newEan && label.includes(`EAN: ${newEan}`)) || 
               (newDesc && label.includes(`"${newDesc}"`));
      });
      if (labelToRemove) {
        clearedProductIdsAndEans.delete(labelToRemove);
      }

      const matchingEntriesById = newId ? (existingProductsMap.get(newId) || []) : [];
      const matchingEntriesByEan = newEan ? (existingProductsMap.get(newEan) || []) : [];
      
      let allMatchingEntries = Array.from(new Set([...matchingEntriesById, ...matchingEntriesByEan]));

      if (allMatchingEntries.length > 0) {
        allMatchingEntries.forEach(entry => {
          const row = entry.row;

          const updateVal = (idx: number, val: any) => {
            if (idx !== -1 && val !== undefined && val !== null && val !== "") {
              row[idx] = val;
            }
          };

          const isOfertasSheet = entry.sheetName === "Ofertas";

          let finalId = newId;
          let finalEan = newEan;
          let finalDesc = newDesc;
          let finalStock = newStock;
          let finalPriceVal = newPrice;
          let finalDiscountVal = newDiscount;
          let finalPriceFinalVal = newFinal;

          if (isOfertasSheet) {
            let isStockNotFound = false;
            let isPriceNotFound = false;
            let isDiscountNotFound = false;
            let isFinalNotFound = false;

            if (Array.isArray(item)) {
              if (hasSourceHeaders) {
                const sCol = mappedIndices.stock !== -1 ? mappedIndices.stock : mapping.stock;
                const sVal = sCol !== -1 && sCol < item.length ? String(item[sCol] || "").trim() : "";
                isStockNotFound = sVal === "";
                
                const pCol = mappedIndices.price !== -1 ? mappedIndices.price : mapping.price;
                const pVal = pCol !== -1 && pCol < item.length ? String(item[pCol] || "").trim() : "";
                isPriceNotFound = pVal === "";

                const dCol = mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount;
                const dVal = dCol !== -1 && dCol < item.length ? String(item[dCol] || "").trim() : "";
                isDiscountNotFound = dVal === "";

                const fCol = mappedIndices.final !== -1 ? mappedIndices.final : mapping.final;
                const fVal = fCol !== -1 && fCol < item.length ? String(item[fCol] || "").trim() : "";
                isFinalNotFound = fVal === "";
              } else {
                const sVal = mapping.stock !== -1 && mapping.stock < item.length ? String(item[mapping.stock] || "").trim() : "";
                isStockNotFound = sVal === "";
                
                const pVal = mapping.price !== -1 && mapping.price < item.length ? String(item[mapping.price] || "").trim() : "";
                isPriceNotFound = pVal === "";

                const dVal = mapping.discount !== -1 && mapping.discount < item.length ? String(item[mapping.discount] || "").trim() : "";
                isDiscountNotFound = dVal === "";

                const fVal = mapping.final !== -1 && mapping.final < item.length ? String(item[mapping.final] || "").trim() : "";
                isFinalNotFound = fVal === "";
              }
            } else if (item && typeof item === 'object') {
              isStockNotFound = !item[mapping.stock] || String(item[mapping.stock]).trim() === "";
              isPriceNotFound = !item[mapping.price] || String(item[mapping.price]).trim() === "";
              isDiscountNotFound = !item[mapping.discount] || String(item[mapping.discount]).trim() === "";
              isFinalNotFound = !item[mapping.final] || String(item[mapping.final]).trim() === "";
            }

            if (isStockNotFound || !newStock || newStock === "") {
              finalStock = "1";
            }
            if (isPriceNotFound || !newPrice || parseFloat(cleanNumericString(newPrice)) <= 0 || isNaN(parseFloat(cleanNumericString(newPrice)))) {
              finalPriceVal = 1;
            }
            if (isDiscountNotFound || !newDiscount || parseFloat(cleanNumericString(newDiscount)) <= 0 || isNaN(parseFloat(cleanNumericString(newDiscount)))) {
              finalDiscountVal = 1;
            }
            if (isFinalNotFound || !newFinal || parseFloat(cleanNumericString(newFinal)) <= 0 || isNaN(parseFloat(cleanNumericString(newFinal)))) {
              finalPriceFinalVal = 1;
            }
          }

          updateVal(idIdx, finalId);
          updateVal(eanIdx, finalEan);
          updateVal(descIdx, finalDesc);
          updateVal(stockIdx, finalStock);
          updateVal(priceIdx, formatBrazilian(finalPriceVal));
          updateVal(discIdx, formatBrazilian(finalDiscountVal, true));
          updateVal(finalIdx, formatBrazilian(finalPriceFinalVal));
          updateVal(validIdx, newValid);
        });
        updatedCount++;
        updatedProductsLog.push(`${newDesc || "Sem Descrição"} (ID: ${newId || '-'}) → Est: ${newStock || '0'} | Preço: R$ ${formatBrazilian(newPrice)} | Desc: ${formatBrazilian(newDiscount, true)} | Final: R$ ${formatBrazilian(newFinal)}`);

        // Check if we need to update this product in the Ofertas sheet (only if it already exists there)
        const hasOfferEntry = allMatchingEntries.some(e => e.sheetName === "Ofertas");
        if (hasOfferEntry) {
          const dVal = typeof newDiscount === 'number' ? newDiscount : parseFloat(cleanNumericString(newDiscount));
          
          let isDiscountNotFound = false;
          if (Array.isArray(item)) {
            if (hasSourceHeaders) {
              const dCol = mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount;
              const dValStr = dCol !== -1 && dCol < item.length ? String(item[dCol] || "").trim() : "";
              isDiscountNotFound = dValStr === "";
            } else {
              const dValStr = mapping.discount !== -1 && mapping.discount < item.length ? String(item[mapping.discount] || "").trim() : "";
              isDiscountNotFound = dValStr === "";
            }
          } else if (item && typeof item === 'object') {
            isDiscountNotFound = !item[mapping.discount] || String(item[mapping.discount]).trim() === "";
          }

          const isDiscNotFound = isDiscountNotFound || !newDiscount || isNaN(dVal) || dVal <= 0;

          if (newDiscount > 0 || isDiscNotFound) {
            updatedOffersCount++;
          } else {
            // If discount is explicitly 0 or less, mark for removal from Ofertas sheet
            if (newId) idsToRemoveFromOfertas.add(newId);
            if (newEan) eansToRemoveFromOfertas.add(newEan);
          }
        }
      } else {
        const industryName = industria.split(' ')[0].toUpperCase();
        const headers = sheetData["Produtos"]?.headers || [];
        const rowLength = Math.max(headers.length, 10);
        const newRow = new Array(rowLength).fill("");
        
        const finalNewStock = (!newStock || newStock === "" || newStock === "0") ? "100" : newStock;

        // Dynamically locate column indices if headers exist
        let pIdIdx = 0, pEanIdx = 1, pDescIdx = 2, pStockIdx = 3, pPriceIdx = 4, pDiscIdx = 5, pFinalIdx = 6, pValidIdx = 7, pCatIdx = 8, pFabIdx = 9;

        if (headers && headers.length > 0) {
          const normProdHeaders = headers.map(h => String(h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const findIdx = (terms: string[]) => normProdHeaders.findIndex(h => terms.some(t => h.includes(t)));
          
          const idxId = findIdx(["id", "codigo", "cod"]); if (idxId !== -1) pIdIdx = idxId;
          const idxEan = findIdx(["ean", "gtin", "barras"]); if (idxEan !== -1) pEanIdx = idxEan;
          const idxDesc = findIdx(["descri", "nome", "produto"]); if (idxDesc !== -1) pDescIdx = idxDesc;
          const idxStock = findIdx(["estoque", "saldo", "qtd", "stock"]); if (idxStock !== -1) pStockIdx = idxStock;
          const idxPrice = findIdx(["preco venda", "pv", "preco", "tabela", "unitario"]); if (idxPrice !== -1) pPriceIdx = idxPrice;
          const idxDisc = findIdx(["desconto", "desc"]); if (idxDisc !== -1) pDiscIdx = idxDisc;
          const idxFinal = findIdx(["preco final", "pf", "liquido"]); if (idxFinal !== -1) pFinalIdx = idxFinal;
          const idxValid = findIdx(["validade", "expira"]); if (idxValid !== -1) pValidIdx = idxValid;
          const idxCat = findIdx(["categoria", "grupo"]); if (idxCat !== -1) pCatIdx = idxCat;
          const idxFab = findIdx(["fabricante", "industria", "marca"]); if (idxFab !== -1) pFabIdx = idxFab;
        }

        newRow[pIdIdx] = newId;
        newRow[pEanIdx] = newEan;
        newRow[pDescIdx] = newDesc || `Produto ${newId || newEan}`;
        newRow[pStockIdx] = finalNewStock;
        newRow[pPriceIdx] = formatBrazilian(newPrice);
        newRow[pDiscIdx] = formatBrazilian(newDiscount, true);
        newRow[pFinalIdx] = formatBrazilian(newFinal);
        if (pValidIdx !== -1) newRow[pValidIdx] = newValid;
        if (pCatIdx !== -1) newRow[pCatIdx] = "Geral";
        if (pFabIdx !== -1) newRow[pFabIdx] = industryName;

        newProductsRows.push(newRow);
        newCount++;
        newProductsLog.push(`${newDesc || "Sem Descrição"} (ID: ${newId || '-'}) → Est: ${finalNewStock} | Preço: R$ ${formatBrazilian(newPrice)} | Desc: ${formatBrazilian(newDiscount, true)} | Final: R$ ${formatBrazilian(newFinal)}`);

        // Also add to Ofertas sheet if it has a discount
        if (sheetData["Ofertas"] && (newDiscount > 0 || (newFinal > 0 && newFinal < newPrice))) {
          const offerHeaders = sheetData["Ofertas"].headers || [];
          const offerRowLength = Math.max(offerHeaders.length, 10);
          const newOfferRow = new Array(offerRowLength).fill("");

          let oIdIdx = pIdIdx, oEanIdx = pEanIdx, oDescIdx = pDescIdx, oStockIdx = pStockIdx, oPriceIdx = pPriceIdx, oDiscIdx = pDiscIdx, oFinalIdx = pFinalIdx, oValidIdx = pValidIdx, oCatIdx = pCatIdx, oFabIdx = pFabIdx;
          if (offerHeaders && offerHeaders.length > 0) {
            const normOfferHeaders = offerHeaders.map(h => String(h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
            const findIdx = (terms: string[]) => normOfferHeaders.findIndex(h => terms.some(t => h.includes(t)));
            
            const idxId = findIdx(["id", "codigo", "cod"]); if (idxId !== -1) oIdIdx = idxId;
            const idxEan = findIdx(["ean", "gtin", "barras"]); if (idxEan !== -1) oEanIdx = idxEan;
            const idxDesc = findIdx(["descri", "nome", "produto"]); if (idxDesc !== -1) oDescIdx = idxDesc;
            const idxStock = findIdx(["estoque", "saldo", "qtd", "stock"]); if (idxStock !== -1) oStockIdx = idxStock;
            const idxPrice = findIdx(["preco venda", "pv", "preco", "tabela", "unitario"]); if (idxPrice !== -1) oPriceIdx = idxPrice;
            const idxDisc = findIdx(["desconto", "desc"]); if (idxDisc !== -1) oDiscIdx = idxDisc;
            const idxFinal = findIdx(["preco final", "pf", "liquido"]); if (idxFinal !== -1) oFinalIdx = idxFinal;
            const idxValid = findIdx(["validade", "expira"]); if (idxValid !== -1) oValidIdx = idxValid;
            const idxCat = findIdx(["categoria", "grupo"]); if (idxCat !== -1) oCatIdx = idxCat;
            const idxFab = findIdx(["fabricante", "industria", "marca"]); if (idxFab !== -1) oFabIdx = idxFab;
          }

          newOfferRow[oIdIdx] = newId;
          newOfferRow[oEanIdx] = newEan;
          newOfferRow[oDescIdx] = newDesc || `Produto ${newId || newEan}`;
          newOfferRow[oStockIdx] = finalNewStock;
          newOfferRow[oPriceIdx] = formatBrazilian(newPrice);
          newOfferRow[oDiscIdx] = formatBrazilian(newDiscount, true);
          newOfferRow[oFinalIdx] = formatBrazilian(newFinal);
          if (oValidIdx !== -1) newOfferRow[oValidIdx] = newValid;
          if (oCatIdx !== -1) newOfferRow[oCatIdx] = "Geral";
          if (oFabIdx !== -1) newOfferRow[oFabIdx] = industryName;

          sheetData["Ofertas"].rows.push(newOfferRow);
        }
        
        const entry = { row: newRow, sheetName: "Produtos" };
        if (newId) {
          if (!existingProductsMap.has(newId)) existingProductsMap.set(newId, []);
          existingProductsMap.get(newId)!.push(entry);
        }
        if (newEan) {
          if (!existingProductsMap.has(newEan)) existingProductsMap.set(newEan, []);
          existingProductsMap.get(newEan)!.push(entry);
        }
      }
    });

    // Post-processing for Ofertas sheet to default unmatched target industry products to "1"
    let defaultedUnmatchedOffersCount = 0;
    if (sheetData["Ofertas"]) {
      const offersHeaders = sheetData["Ofertas"].headers || [];
      const offersRows = sheetData["Ofertas"].rows;
      const offersFabColIdx = offersHeaders.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
      
      offersRows.slice(1).forEach(row => {
        let belongsToIndustry = false;
        if (offersFabColIdx !== -1 && row[offersFabColIdx]) {
          const rowFab = String(row[offersFabColIdx] || "").trim().toUpperCase();
          belongsToIndustry = rowFab === targetIndustry || rowFab.startsWith(targetIndustry) || targetIndustry.startsWith(rowFab);
        }
        
        if (!belongsToIndustry) {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          if ((id && targetIndustryIdsAndEans.has(id)) || (ean && targetIndustryIdsAndEans.has(ean))) {
            belongsToIndustry = true;
          }
        }
        
        if (belongsToIndustry) {
          while (row.length <= Math.max(stockIdx, priceIdx, discIdx, finalIdx)) {
            row.push("");
          }
          
          let wasDefaulted = false;
          if (!row[stockIdx] || String(row[stockIdx]).trim() === "") {
            row[stockIdx] = "1";
            wasDefaulted = true;
          }
          if (!row[priceIdx] || String(row[priceIdx]).trim() === "") {
            row[priceIdx] = formatBrazilian(1);
            wasDefaulted = true;
          }
          if (!row[discIdx] || String(row[discIdx]).trim() === "") {
            row[discIdx] = formatBrazilian(1, true);
            wasDefaulted = true;
          }
          if (!row[finalIdx] || String(row[finalIdx]).trim() === "") {
            row[finalIdx] = formatBrazilian(1);
            wasDefaulted = true;
          }
          if (wasDefaulted) {
            defaultedUnmatchedOffersCount++;
          }
        }
      });
    }

    let removedOffersCount = 0;
    if (sheetData["Ofertas"]) {
      const originalRows = sheetData["Ofertas"].rows;
      const filteredRows = [
        originalRows[0],
        ...originalRows.slice(1).filter(row => {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          
          const shouldRemove = (id && idsToRemoveFromOfertas.has(id)) || (ean && eansToRemoveFromOfertas.has(ean));
          if (shouldRemove) {
            removedOffersCount++;
          }
          return !shouldRemove;
        })
      ];
      sheetData["Ofertas"].rows = filteredRows;
    }

    log.push(`Processamento concluído para ${industria}.`);
    log.push(`Resumo: ${updatedCount} produtos existentes foram atualizados.`);
    log.push(`Resumo: ${newCount} novos produtos foram adicionados.`);
    log.push(`Resumo de Ofertas: ${promotedOffersCount} novos produtos promovidos à aba Ofertas.`);
    log.push(`Resumo de Ofertas: ${updatedOffersCount} ofertas existentes atualizadas.`);
    if (defaultedUnmatchedOffersCount > 0) {
      log.push(`Resumo de Ofertas: ${defaultedUnmatchedOffersCount} ofertas que não constavam na planilha de atualização tiveram seus valores ausentes preenchidos com 1.`);
    }
    if (removedOffersCount > 0) {
      log.push(`Resumo de Ofertas: ${removedOffersCount} produtos removidos da aba Ofertas (desconto zerado).`);
    }

    if (clearedProductIdsAndEans.size > 0) {
      log.push(`Resumo: ${clearedProductIdsAndEans.size} produtos desta indústria que não constavam na nova planilha tiveram Estoque e Preços apagados/bloqueados.`);
    }
    if (isKimberlyInput) {
      log.push(`Aplicadas correções automáticas de decimais e descontos para Kimberly.`);
    }

    if (updatedProductsLog.length > 0) {
      log.push(`--- DETALHES DOS PRODUTOS ATUALIZADOS ---`);
      if (updatedProductsLog.length <= 150) {
        updatedProductsLog.forEach(p => log.push(`• [ATUALIZADO] ${p}`));
      } else {
        updatedProductsLog.slice(0, 150).forEach(p => log.push(`• [ATUALIZADO] ${p}`));
        log.push(`• ... e outros ${updatedProductsLog.length - 150} produtos atualizados.`);
      }
    }

    if (newProductsLog.length > 0) {
      log.push(`--- DETALHES DOS PRODUTOS NOVOS ADICIONADOS ---`);
      if (newProductsLog.length <= 150) {
        newProductsLog.forEach(p => log.push(`• [NOVO] ${p}`));
      } else {
        newProductsLog.slice(0, 150).forEach(p => log.push(`• [NOVO] ${p}`));
        log.push(`• ... e outros ${newProductsLog.length - 150} produtos adicionados.`);
      }
    }

    if (clearedProductIdsAndEans.size > 0) {
      log.push(`--- PRODUTOS NÃO ATUALIZADOS (LIMPOS POR FALTA NA PLANILHA) ---`);
      const clearedList = Array.from(clearedProductIdsAndEans);
      if (clearedList.length <= 150) {
        clearedList.forEach(p => log.push(`• [LIMPO] ${p}`));
      } else {
        clearedList.slice(0, 150).forEach(p => log.push(`• [LIMPO] ${p}`));
        log.push(`• ... e outros ${clearedList.length - 150} produtos limpos.`);
      }
    }

    log.push(`Sincronizando alterações com as abas Produtos, Ofertas e Lancamentos...`);

    // 4. Save all updated sheets back
    await Promise.all(Object.keys(sheetData).map(async (sheetName) => {
      let finalRows = sheetData[sheetName].rows;
      if (sheetName === "Produtos") {
        finalRows = [...finalRows, ...newProductsRows];
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: finalRows,
        },
      });
    }));

    invalidateSheetCache(spreadsheetId);

    res.json({ 
      sucesso: true, 
      industry: industria, 
      updatedCount, 
      newCount,
      log,
      hasNew: newCount > 0
    });
  } catch (error: any) {
    console.error("Error updating catalog in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/client/update", async (req, res) => {
  try {
    const client = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const sheets = await getSheetsClient();

    // 1. Get current clients to find the row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clientes",
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Sheet Clientes não encontrada ou vazia." });
    }

    const headers = rows[0];
    const idIdx = headers.findIndex((h: string) => h.toLowerCase().includes("id"));
    
    if (idIdx === -1) {
      return res.status(500).json({ error: "Coluna ID não encontrada na sheet Clientes." });
    }

    // 2. Find the row
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIdx] || "").trim() === String(client.id).trim());

    if (rowIdx === -1) {
      return res.status(404).json({ error: `Cliente com ID ${client.id} não encontrado na planilha.` });
    }

    // 3. Prepare the new row data maintaining header order
    const updatedRow = [...rows[rowIdx]];
    const mapping: Record<string, keyof typeof client> = {
      'Nome': 'name',
      'Nome Fantasia': 'tradeName',
      'CNPJ': 'cnpj',
      'Vendedor': 'seller',
      'EmailUsuario': 'email',
      'Endereco': 'address',
      'Cidade': 'city',
      'Estado': 'state',
      'Comprador': 'buyer',
      'Celular': 'phone',
      'Regional': 'regional'
    };

    headers.forEach((header: string, index: number) => {
      const key = mapping[header];
      if (key && client[key] !== undefined) {
        updatedRow[index] = client[key];
      }
    });

    // 4. Update the row in Sheets
    // Sheets uses 1-based indexing for ranges, and we found rowIdx in a 0-indexed array
    const sheetRowNumber = rowIdx + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Clientes!A${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedRow],
      },
    });

    invalidateSheetCache(spreadsheetId, 'Clientes');

    res.json({ sucesso: true, client: client });
  } catch (error: any) {
    console.error("Error updating client in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mount API Router with support for Netlify Functions path
const apiPath = process.env.NETLIFY ? "/.netlify/functions/api" : "/api";
app.use([apiPath, "/api"], apiRouter);

// Timestamp of current server startup
const SERVER_START_TIME = Date.now();

// Version endpoint for auto-update notifications
apiRouter.get("/version", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let distBuildTime = 0;
  let version = "2.5.1";
  try {
    const pubPath = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(pubPath)) {
      const pubData = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
      if (pubData.buildTime) {
        distBuildTime = pubData.buildTime;
      }
      if (pubData.version) version = pubData.version;
    }
  } catch (_) {}

  try {
    const vPath = path.join(process.cwd(), 'dist', 'version.json');
    if (fs.existsSync(vPath)) {
      const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
      if (vData.buildTime && vData.buildTime > distBuildTime) {
        distBuildTime = vData.buildTime;
      }
      if (vData.version) version = vData.version;
    }
  } catch (_) {}

  const effectiveBuildTime = distBuildTime > 0 ? distBuildTime : SERVER_START_TIME;

  res.json({
    version,
    buildTime: effectiveBuildTime,
    buildHash: `hbn1_${effectiveBuildTime}`,
    serverStartTime: SERVER_START_TIME,
    timestamp: Date.now()
  });
});

// Direct route for /version.json
app.get("/version.json", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');

  let distBuildTime = 0;
  let version = "2.5.1";
  try {
    const pubPath = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(pubPath)) {
      const pubData = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
      distBuildTime = pubData.buildTime || 0;
      if (pubData.version) version = pubData.version;
    }
  } catch (_) {}

  try {
    const vPath = path.join(process.cwd(), 'dist', 'version.json');
    if (fs.existsSync(vPath)) {
      const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
      if (vData.buildTime && vData.buildTime > distBuildTime) {
        distBuildTime = vData.buildTime;
      }
      if (vData.version) version = vData.version;
    }
  } catch (_) {}

  const effectiveBuildTime = distBuildTime > 0 ? distBuildTime : SERVER_START_TIME;
  res.json({
    version,
    buildTime: effectiveBuildTime,
    builtAt: new Date(effectiveBuildTime).toISOString()
  });
});

// Fallback for API routes that might be called without expected prefix in various environments
app.use((req, res, next) => {
  if (req.path.startsWith('/data/') || req.path.startsWith('/catalog/') || req.path === '/status' || req.path === '/health' || req.path === '/version') {
    return apiRouter(req, res, next);
  }
  next();
});

// Health check endpoint (can be reached via /api/health)
apiRouter.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      NETLIFY: !!process.env.NETLIFY,
      VERCEL: !!process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_SHEET_ID_SET: !!process.env.GOOGLE_SHEET_ID
    }
  });
});

// Generic catch-all for API router
apiRouter.all("*", (req, res) => {
  res.status(404).json({ error: "Route not found in API router", path: req.path });
});

// Global Express error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[EXPRESS GLOBAL ERROR] ${req.method} ${req.url}:`, err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err.status === 'number' ? err.status : (typeof err.statusCode === 'number' ? err.statusCode : 500);
  res.status(status).json({
    error: err.message || "Erro interno no servidor",
    path: req.path
  });
});

// Vite middleware setup
export async function startServer() {
  const isServerless = !!(process.env.NETLIFY || process.env.VERCEL);
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isServerless) {
    try {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded");
    } catch (e) {
      console.error("Vite middleware failed to load:", e);
    }
  } else if (!isServerless) {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Prevent browser and proxy caching of HTML and version files
    app.use((req, res, next) => {
      if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path) || req.path.endsWith('version.json'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      next();
    });

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('version.json') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen on a port if NOT in a serverless environment
  if (!isServerless) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Ensure app is always exported for serverless
export { app };
export default app;

// Support for deployments (Vercel/Netlify vs normal Server containers like Cloud Run)
const isServerlessEnv = !!(process.env.NETLIFY || process.env.VERCEL);

if (!isServerlessEnv) {
  startServer().catch(console.error);
}
