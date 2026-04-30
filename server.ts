import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DEFAULT_SPREADSHEET_ID = cleanSpreadsheetId(process.env.GOOGLE_SHEET_ID || "1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs");

const getRequestSpreadsheetId = (req: express.Request) => {
  const headerId = req.headers['x-spreadsheet-id'] as string || req.query.spreadsheetId as string;
  if (headerId) return headerId;

  return DEFAULT_SPREADSHEET_ID;
};

// API Routes
app.post("/api/product/update-image", async (req, res) => {
  try {
    const { id, imageUrl, sheetName } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    
    if (!id || !imageUrl || !sheetName) {
      return res.status(400).json({ error: "Missing required fields (id, imageUrl, sheetName)" });
    }

    const sheets = await getSheetsClient();

    // 1. Get current data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: `Sheet "${sheetName}" not found or empty.` });
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
      return res.status(500).json({ error: `Coluna ID não encontrada na sheet "${sheetName}".` });
    }

    // 2. Find the row index
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIdx] || "").trim() === String(id).trim());

    if (rowIdx === -1) {
      return res.status(404).json({ error: `Produto ID "${id}" não encontrado na sheet "${sheetName}".` });
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
        range: `${sheetName}!${colLetter}1`,
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
      range: `${sheetName}!${colLetter}${sheetRowNumber}`,
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
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required. Please set it in the Secrets panel.");
  }

  // Handle cases where the secret might be wrapped in quotes (common copy-paste issue)
  if ((authJson.startsWith('"') && authJson.endsWith('"')) || 
      (authJson.startsWith("'") && authJson.endsWith("'"))) {
    authJson = authJson.slice(1, -1).trim();
  }

  let credentials;
  try {
    credentials = JSON.parse(authJson);
  } catch (e) {
    const preview = authJson.substring(0, 30) + "...";
    let message = `Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. The value starts with "${preview}".`;
    
    if (authJson.includes('@') && !authJson.startsWith('{')) {
      message += " It looks like you pasted just the Service Account EMAIL address. You must paste the ENTIRE JSON content from the key file you downloaded from Google Cloud Console (it starts with '{' and contains a 'private_key' field).";
    } else {
      message += " Ensure you pasted the ENTIRE JSON content from your Google Service Account key file, not just a path or a single field.";
    }
    
    throw new Error(message);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
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

app.get("/api/status", async (req, res) => {
  const spreadsheetId = getRequestSpreadsheetId(req);
  console.log(`[Status] Check requested for: ${spreadsheetId}`);
  try {
    const authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    if (!authJson) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is missing from Secrets." 
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(authJson);
    } catch (e) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." 
      });
    }

    const serviceAccountEmail = credentials.client_email;
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

app.get("/api/data/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const now = Date.now();

    const cacheKey = `${spreadsheetId}_${sheetName}`;

    // Check cache
    if (dataCache[cacheKey] && (now - dataCache[cacheKey].timestamp < DATA_CACHE_DURATION)) {
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
      dataCache[sheetName] = { data: emptyData, timestamp: now };
      return res.json(emptyData);
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row: any) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index];
      });
      return obj;
    });

    // Update cache
    dataCache[cacheKey] = { data, timestamp: now };

    res.json(data);
  } catch (error: any) {
    console.error(`Error fetching sheet ${req.params.sheetName}:`, error);
    
    let message = error.message;
    const spreadsheetId = getRequestSpreadsheetId(req);
  }
});

app.post("/api/order", async (req, res) => {
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

app.post("/api/catalog/update", async (req, res) => {
  try {
    const { industria, dados } = req.body;
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
            const ean = String(row[eanIdx] || "").trim().replace(/^'/, '');
            
            const entry = { row, sheetName };
            if (id && id.length >= 2) {
              if (!existingProductsMap.has(id)) existingProductsMap.set(id, []);
              existingProductsMap.get(id)!.push(entry);
            }
            if (ean && ean.length >= 5) {
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
      final: getSourceIndex(["PREÇO C/ DESC", "PRECO C/ DESC", "PRECO C DESC", "PF", "Preço Final", "Preco Final", "VALOR FINAL", "PRECO LIQUIDO", "PRECO LÍQUIDO", "VALOR LIQUIDO", "LIQUIDO"])
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

    log.push(`Iniciando atualização do catálogo ${industria}...`);
    log.push(`Planilha detectada com ${rowsToProcess.length} linhas de dados.`);
    if (hasSourceHeaders) {
      log.push(`Colunas encontradas: EAN(${mappedIndices.ean}), Preço(${mappedIndices.price}), Final(${mappedIndices.final}), Descrição(${mappedIndices.desc})`);
    }

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

    rowsToProcess.forEach((item: any) => {
      let newId = "";
      let newEan = "";
      let newDesc = "";
      let newStock = "";
      let newPrice: any = "";
      let newDiscount: any = "";
      let newFinal: any = "";

      if (Array.isArray(item)) {
        if (hasSourceHeaders) {
          newId = String(item[mappedIndices.id !== -1 ? mappedIndices.id : mapping.id] || "").trim();
          newEan = String(item[mappedIndices.ean !== -1 ? mappedIndices.ean : mapping.ean] || "").trim().replace(/^'/, '');
          newDesc = String(item[mappedIndices.desc !== -1 ? mappedIndices.desc : mapping.desc] || "").trim();
          newStock = String(item[mappedIndices.stock !== -1 ? mappedIndices.stock : mapping.stock] || "").trim();
          newPrice = String(item[mappedIndices.price !== -1 ? mappedIndices.price : mapping.price] || "").trim();
          newDiscount = String(item[mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount] || "").trim();
          newFinal = String(item[mappedIndices.final !== -1 ? mappedIndices.final : mapping.final] || "").trim();

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
          newEan = String(item[mapping.ean] || "").trim().replace(/^'/, '');
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

          updateVal(idIdx, newId);
          updateVal(eanIdx, newEan);
          updateVal(descIdx, newDesc);
          updateVal(stockIdx, newStock);
          updateVal(priceIdx, formatBrazilian(newPrice));
          updateVal(discIdx, formatBrazilian(newDiscount, true));
          updateVal(finalIdx, formatBrazilian(newFinal));
        });
        updatedCount++;
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

        const fabColIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
        if (fabColIdx !== -1) newRow[fabColIdx] = industryName;
        
        newProductsRows.push(newRow);
        newCount++;
        
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

    log.push(`Processamento concluído para ${industria}.`);
    log.push(`Resumo: ${updatedCount} produtos existentes foram atualizados.`);
    log.push(`Resumo: ${newCount} novos produtos foram adicionados.`);
    if (isKimberlyInput) {
      log.push(`Aplicadas correções automáticas de decimais e descontos para Kimberly.`);
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

app.post("/api/client/update", async (req, res) => {
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

// Vite middleware setup
export async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Support for serverless deployments (Vercel/Netlify)
export default app;

const isMainModule = import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMainModule || !process.env.VERCEL) {
  startServer().catch(console.error);
}
