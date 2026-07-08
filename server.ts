import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import axios from "axios";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const apiRouter = express.Router();
const PORT = 3000;

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

// API Routes on apiRouter
apiRouter.post("/product/update-image", async (req, res) => {
  try {
    const { id, imageUrl, sheetName } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    
    if (!id || !imageUrl || !sheetName) {
      return res.status(400).json({ error: "Missing required fields (id, imageUrl, sheetName)" });
    }

    const sheets = await getSheetsClient();

    // Retrieve sheet list and perform robust case & accent insensitive mapping
    let availableSheets: string[] = [];
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      availableSheets = spreadsheet.data.sheets?.map((s: any) => s.properties.title) || [];
    } catch (err: any) {
      console.error("Error retrieving spreadsheet in update-image:", err.message);
      return res.status(500).json({ error: `Erro ao obter abas da planilha: ${err.message}` });
    }

    const normalizeStr = (str: string) => 
      String(str || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const targetSheet = availableSheets.find(s => normalizeStr(s) === normalizeStr(sheetName)) || sheetName;

    // 1. Get current data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: `Sheet "${targetSheet}" not found or empty.` });
    }

    const headers = rows[0];
    const idIdx = headers.findIndex((h: string) => {
      const normalizedH = String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return ["idproduto", "id", "codigo", "cod"].includes(normalizedH);
    });
    
    const photoIdx = headers.findIndex((h: string) => {
       const normalizedH = String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
       return ["foto", "imagem", "url", "photo", "link", "img"].includes(normalizedH) || normalizedH.includes("foto");
    });

    if (idIdx === -1) {
      return res.status(500).json({ error: `Coluna ID não encontrada na sheet "${targetSheet}".` });
    }

    // 2. Find the row index
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIdx] || "").trim() === String(id).trim());

    if (rowIdx === -1) {
      return res.status(404).json({ error: `Produto ID "${id}" não encontrado na sheet "${targetSheet}".` });
    }

    // 3. Update the row
    let targetPhotoIdx = photoIdx;
    const getColumnLetter = (index: number) => {
      let letter = "";
      while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    if (targetPhotoIdx === -1) {
      // Photo column doesn't exist, create it at the end
      targetPhotoIdx = headers.length;
      const colLetter = getColumnLetter(targetPhotoIdx);
      
      // Add "Foto" header
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!${colLetter}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Foto"]],
        },
      });
    }

    const sheetRowNumber = rowIdx + 1;
    const colLetter = getColumnLetter(targetPhotoIdx);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetSheet}!${colLetter}${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[imageUrl]],
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating image in Sheets:", error);
    res.status(500).json({ error: error.message });
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

// API Routes Metadata
let cachedSpreadsheetInfo: Record<string, any> = {};
let cachedMetadataFetchTime: Record<string, number> = {};
const METADATA_CACHE_DURATION = 60000; // 1 minute

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
    const now = Date.now();
    let isApiKey = spreadsheetId.startsWith("AIza");
    let spreadsheetError = null;

    if (!cachedSpreadsheetInfo[spreadsheetId] || (now - (cachedMetadataFetchTime[spreadsheetId] || 0) > METADATA_CACHE_DURATION)) {
      try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.get({
          spreadsheetId,
        });
        
        const sheetTitles = response.data.sheets?.map((s: any) => s.properties.title) || [];
        
        cachedSpreadsheetInfo[spreadsheetId] = {
          title: response.data.properties?.title,
          sheets: sheetTitles,
          headers: {} // Headers fetched on demand now to save quota
        };
        cachedMetadataFetchTime[spreadsheetId] = now;
      } catch (err: any) {
        spreadsheetError = err.message;
        if (err.code === 404 && isApiKey) {
          spreadsheetError = `ERRO CRÍTICO: O ID "${spreadsheetId}" não foi encontrado. Este valor parece ser uma CHAVE DE API (começa com 'AIza'). Você deve usar o ID da Planilha que fica na URL do navegador. Exemplo: 1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs`;
        } else if (err.code === 404) {
          spreadsheetError = `Planilha não encontrada (ID: ${spreadsheetId}). Verifique se o ID está correto e se você compartilhou a planilha com o e-mail: ${serviceAccountEmail}`;
        }
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
const DATA_CACHE_DURATION = 30000; // 30 seconds

apiRouter.get("/data/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const fetchNow = Date.now();

    const cacheKey = `${spreadsheetId}_${sheetName}`;

    // Check cache
    if (dataCache[cacheKey] && (fetchNow - dataCache[cacheKey].timestamp < DATA_CACHE_DURATION)) {
      return res.json(dataCache[cacheKey].data);
    }

    const sheets = await getSheetsClient();
    
    console.log(`Fetching sheet: ${sheetName} from spreadsheet: ${spreadsheetId}`);

    // First, verify the spreadsheet exists and get available sheet names
    let availableSheets: string[] = [];
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      availableSheets = spreadsheet.data.sheets?.map((s: any) => s.properties.title) || [];
    } catch (err: any) {
      console.error("Error verifying spreadsheet:", err.message);
      if (err.code === 404) {
        return res.status(404).json({
          error: `Spreadsheet ID "${spreadsheetId}" not found.`,
          details: "Check your GOOGLE_SHEET_ID secret. Ensure the ID is correct and the Service Account has access."
        });
      }
      throw err;
    }

    // Try to find the sheet with a case-insensitive match or trimmed match
    let targetSheet = availableSheets.find(s => s.trim().toLowerCase() === sheetName.trim().toLowerCase());
    
    if (!targetSheet) {
      return res.status(404).json({
        error: `Sheet "${sheetName}" not found in spreadsheet.`,
        availableSheets,
        details: `Available tabs are: ${availableSheets.join(", ")}. Please ensure your Google Sheet has a tab named exactly "${sheetName}".`
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      const emptyData: any[] = [];
      dataCache[sheetName] = { data: emptyData, timestamp: fetchNow };
      return res.json(emptyData);
    }

    const headers = rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Identify discount related columns dynamically on the backend too
    const keysNormalized = headers.map((k: any) => String(k || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const priceIdx = keysNormalized.findIndex((k: string) => ["pv", "preco venda", "preco", "valor"].includes(k));
    const finalIdx = keysNormalized.findIndex((k: string) => ["pf", "preco final", "valor final"].includes(k));
    const discIdx = keysNormalized.findIndex((k: string) => ["desconto", "percentual"].includes(k));
    const validIdx = keysNormalized.findIndex((k: string) => ["validade", "expira", "vencimento"].includes(k));

    const data = rows.slice(1).map((row: any) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        let val = row[index];
        
        // Backend Expiration logic: if we found the relevant columns, check them
        if (index === discIdx || index === finalIdx) {
          const validDateStr = row[validIdx];
          if (validDateStr) {
            try {
              let parsedDate: Date | null = null;
              if (typeof validDateStr === 'number') {
                parsedDate = new Date((validDateStr - 25569) * 86400 * 1000);
              } else if (String(validDateStr).includes('/')) {
                const parts = String(validDateStr).split('/');
                if (parts.length === 3) parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              } else {
                parsedDate = new Date(validDateStr);
              }

              if (parsedDate && !isNaN(parsedDate.getTime())) {
                parsedDate.setHours(0, 0, 0, 0);
                if (today > parsedDate) {
                  // Expired!
                  if (index === discIdx) val = "0.00%";
                  if (index === finalIdx) val = row[priceIdx];
                }
              }
            } catch (e) {}
          }
        }

        obj[header] = val;
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

    // 2. Save to ItensPedido sheet
    // IDItem, IDPedido, IDProduto, Codigo Barras, Descricao, Fabricante, Qtd, Preco, Subtotal
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

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "ItensPedido!A:I",
      valueInputOption: "RAW",
      requestBody: {
        values: itemRows,
      },
    });

    res.json({ sucesso: true, idPedido: order.id });
  } catch (error: any) {
    console.error("Error saving order to Sheets:", error);
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
          range: `${sheetName}!A:Z`,
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

    const getSourceIndex = (names: string[]) => {
      const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      for (const name of normalizedNames) {
        const idx = headerNormalized.indexOf(name);
        if (idx !== -1) return idx;
      }
      for (const name of normalizedNames) {
        if (name.length < 3) continue;
        const idx = headerNormalized.findIndex(h => h.startsWith(name));
        if (idx !== -1) return idx;
      }
      for (const name of normalizedNames) {
        if (name.length < 4) continue;
        const idx = headerNormalized.findIndex(h => h.includes(name));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const mappedIndices = {
      id: getSourceIndex(["IDProduto", "ID_Produto", "Codigo", "Cod", "Código", "CÓD", "CODIGO", "ID"]),
      ean: getSourceIndex(["EAN", "Codigo Barras", "Código de Barras", "EAN13", "GTIN", "BARRAS"]),
      desc: getSourceIndex(["Descrição", "Descricao", "Nome", "Produto", "Descricao Produto", "PRODUTO", "NOME"]),
      stock: getSourceIndex(["Estoque", "Sald", "Saldo", "QTDE", "Qtde", "Quant", "Quantidade", "STOCK", "DISPONIVEL", "QTD DISP", "ESTOQ", "ESTOQUE", "UNIDADES", "UNID"]),
      price: getSourceIndex(["PV", "Preço Venda", "Preco Venda", "PRECO", "PREÇO", "VALOR", "TABELA", "UNITARIO", "UNITÁRIO", "PREÇO UNITARIO", "VALOR UNITARIO"]),
      discount: getSourceIndex(["DESC", "Desconto", "DESCONTO", "PERCENTUAL", "BONUS", "%DESC", "DESC TOTAL"]),
      final: getSourceIndex(["PREÇO C/ DESC", "PRECO C/ DESC", "PRECO C DESC", "PF", "Preço Final", "Preco Final", "VALOR FINAL", "PRECO LIQUIDO", "PRECO LÍQUIDO", "VALOR LIQUIDO", "LIQUIDO"]),
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
      if (isNaN(val)) return 0;
      const s = val.toFixed(10);
      const parts = s.split('.');
      let rounded: number;
      if (parts.length >= 2 && parts[1].length >= 3) {
        const thirdDigit = parseInt(parts[1][2]);
        if (thirdDigit >= 6) {
          rounded = parseFloat((Math.ceil(val * 100) / 100).toFixed(2));
        } else {
          rounded = parseFloat((Math.floor(val * 100) / 100).toFixed(2));
        }
      } else {
        rounded = parseFloat(val.toFixed(2));
      }

      // Special case requested: 0.99% -> 1.00%
      if (rounded === 0.99) return 1.00;
      return rounded;
    };

    const cleanNumericString = (val: any): string => {
      if (val === null || val === undefined) return "0";
      if (typeof val === 'number') return String(val);
      
      let s = String(val).replace('R$', '').replace('%', '').trim();
      if (!s) return "0";

      // Pattern: 1.234,56 -> 1234.56
      if (s.includes('.') && s.includes(',')) {
        return s.replace(/\./g, '').replace(',', '.');
      }
      
      // Pattern: 87,38 -> 87.38
      if (s.includes(',')) {
        return s.replace(',', '.');
      }

      // Pattern: 87.38 -> 87.38 (Keep as decimal)
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount === 1) {
        return s;
      }
      
      // Pattern: 1.234.567 -> 1234567
      if (dotCount > 1) {
        return s.replace(/\./g, '');
      }
      
      return s;
    };

    const formatBrazilian = (num: any, isPercent = false) => {
      const val = parseFloat(String(num).replace(',', '.'));
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

          // HEURISTIC: If pVal looks like it's missing decimal (e.g. 8738 instead of 87.38)
          if (isKimberlyInput) {
            if (pVal > 1000 && pVal % 1 === 0) pVal /= 100;
            if (fVal > 1000 && fVal % 1 === 0) fVal /= 100;
            
            // Special User request: "ao inves de 1.00% é 10%"
            // If the user says "Desconto" is 1.00% but intends 10.00%
            if (dVal === 1) dVal = 10;
          }

          if (dVal > 1 && pVal > 1 && dVal < pVal && dVal > (pVal * 0.45) && !isKimberlyInput) {
            fVal = dVal;
            dVal = 0;
          }

          if (!isNaN(pVal) && pVal > 0) {
            newPrice = applyCustomRounding(pVal);
            
            // Priority 1: Use Final Price to calculate discount if it looks reliable
            // If Final price is significantly less than price, use it.
            // But if it's too small (like 90% discount) and it's Kimberly, maybe trust dVal more
            const looksLikeTooMuchDiscount = isKimberlyInput && fVal > 0 && ((pVal - fVal) / pVal) > 0.4;
            
            if (!isNaN(fVal) && fVal > 0 && Math.abs(fVal - pVal) > 0.01 && !looksLikeTooMuchDiscount) {
              newFinal = applyCustomRounding(fVal);
              const calculatedDisc = ((pVal - fVal) / pVal) * 100;
              newDiscount = calculatedDisc > 0 ? applyCustomRounding(calculatedDisc) : 0;
            } 
            // Priority 2: Use provided Discount
            else if (!isNaN(dVal) && dVal > 0) {
              const dPerc = dVal < 1 ? dVal * 100 : dVal;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pVal * (1 - newDiscount / 100));
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

          if (isKimberlyInput) {
            if (pValRaw > 1000 && pValRaw % 1 === 0) pValRaw /= 100;
            if (fValRaw > 1000 && fValRaw % 1 === 0) fValRaw /= 100;
            if (dValRaw === 1) dValRaw = 10;
          }

          if (!isNaN(pValRaw) && pValRaw > 0) {
            newPrice = applyCustomRounding(pValRaw);
            const looksTooMuch = isKimberlyInput && fValRaw > 0 && ((pValRaw - fValRaw) / pValRaw) > 0.4;
            
            if (!isNaN(fValRaw) && fValRaw > 0 && Math.abs(fValRaw - pValRaw) > 0.01 && !looksTooMuch) {
              newFinal = applyCustomRounding(fValRaw);
              const calculated = ((pValRaw - fValRaw) / pValRaw) * 100;
              newDiscount = calculated > 0 ? applyCustomRounding(calculated) : 0;
            } else if (!isNaN(dValRaw) && dValRaw > 0) {
              const dPerc = dValRaw < 1 ? dValRaw * 100 : dValRaw;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pValRaw * (1 - newDiscount / 100));
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
            if (isPriceNotFound || !newPrice || parseFloat(String(newPrice)) <= 0 || isNaN(parseFloat(String(newPrice)))) {
              finalPriceVal = 1;
            }
            if (isDiscountNotFound || !newDiscount || parseFloat(String(newDiscount)) <= 0 || isNaN(parseFloat(String(newDiscount)))) {
              finalDiscountVal = 1;
            }
            if (isFinalNotFound || !newFinal || parseFloat(String(newFinal)) <= 0 || isNaN(parseFloat(String(newFinal)))) {
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
        // Add as new product to "Produtos" sheet
        const headers = sheetData["Produtos"]?.headers || [];
        const rowLength = Math.max(headers.length, 8);
        const newRow = new Array(rowLength).fill("");
        
        newRow[idIdx] = newId;
        newRow[eanIdx] = newEan;
        newRow[descIdx] = newDesc;
        newRow[stockIdx] = newStock;
        newRow[priceIdx] = formatBrazilian(newPrice);
        newRow[discIdx] = formatBrazilian(newDiscount, true);
        newRow[finalIdx] = formatBrazilian(newFinal);
        newRow[validIdx] = newValid;

        const fabColIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
        if (fabColIdx !== -1) newRow[fabColIdx] = industryName;
        
        newProductsRows.push(newRow);
        newCount++;
        newProductsLog.push(`${newDesc || "Sem Descrição"} (ID: ${newId || '-'}) → Est: ${newStock || '0'} | Preço: R$ ${formatBrazilian(newPrice)} | Desc: ${formatBrazilian(newDiscount, true)} | Final: R$ ${formatBrazilian(newFinal)}`);
        
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
        range: `${sheetName}!A:Z`,
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
      range: "Clientes!A:Z",
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

    res.json({ sucesso: true, client: client });
  } catch (error: any) {
    console.error("Error updating client in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mount API Router with support for Netlify Functions path
const apiPath = process.env.NETLIFY ? "/.netlify/functions/api" : "/api";
app.use([apiPath, "/api"], apiRouter);

// Fallback for API routes that might be called without expected prefix in various environments
app.use((req, res, next) => {
  if (req.path.startsWith('/data/') || req.path.startsWith('/catalog/') || req.path === '/status' || req.path === '/health') {
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

// Vite middleware setup
export async function startServer() {
  const isServerless = !!(process.env.NETLIFY || process.env.VERCEL);
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isServerless) {
    try {
      // Completely hide vite from static analysis using string concatenation
      const v = "vi";
      const t = "te";
      const viteModule = await import(v + t);
      const vite = await viteModule.createServer({
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen on a port if NOT in a serverless environment
  if (!isServerless) {
    const port = Number(process.env.PORT) || PORT;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
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
