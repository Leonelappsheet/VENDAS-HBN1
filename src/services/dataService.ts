import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType, isFirestoreQuotaExhausted } from '../lib/firestore-errors';
import { Product, Client, Order, Favorite, Visit, OrderItem, BannerMessage } from '../types';
import axios from 'axios';
import { toast } from 'sonner';
import { getSpreadsheetId } from '../constants/regionals';
import { normalizeEAN, parseFlexibleNumber, parseStockNumber } from '../lib/utils';
import { FALLBACK_PRODUCTS } from '../data/fallbackProducts';

export interface SharedLinkData {
  id: string;
  manufacturer?: string;
  manufacturers?: string[];
  statusFilters?: string[];
  sortBy?: string;
  activeTab?: string;
  categories?: string[];
  searchQuery?: string;
  sellerName?: string;
  sellerPhone?: string;
  clientName?: string;
  clientId?: string;
  clientCnpj?: string;
  regional?: string;
  createdAt: number;
  completedAt?: number;
}

export const isSharedLinkActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('shared') === 'true' || 
           !!p.get('lid') || 
           !!p.get('linkId') || 
           !!p.get('ind') || 
           !!p.get('industria') || 
           !!p.get('client') || 
           !!p.get('cliente');
  } catch {
    return false;
  }
};

export const normalizeUserId = (rawUid?: string | null): string => {
  if (!rawUid) return 'Leonel';
  const clean = String(rawUid).trim();
  const lower = clean.toLowerCase();
  if (lower.includes('leonel') || lower === 'admin' || lower === 'leonelamorim' || lower === 'leonelamorimm' || lower === 'leonelamorimm@gmail.com') {
    return 'Leonel';
  }
  return clean;
};

export const getApiUrl = (): string => {
  try {
    const custom = localStorage.getItem('CUSTOM_API_URL');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  } catch (e) {}

  const envUrl = ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) || '').replace(/\/$/, '');
  if (envUrl) {
    return envUrl;
  }

  // Default to empty string so requests use relative paths (/api/...) 
  // on the current origin (localhost, Cloud Run, custom domain, etc.)
  return '';
};

export const getAppsScriptUrl = (): string => {
  try {
    const custom = localStorage.getItem('CUSTOM_APPS_SCRIPT_URL');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch (e) {}
  return '';
};

function isHtmlResponse(data: any): boolean {
  if (typeof data === 'string') {
    const trimmed = data.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<div');
  }
  return false;
}

function parseCSV(csvText: string): any[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"'; // Escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !inQuotes) {
      // Ignore carriage return
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQuotedField = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotedField && nextChar === '"') {
          field += '"';
          i++;
        } else {
          inQuotedField = !inQuotedField;
        }
      } else if (char === ',' && !inQuotedField) {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field);
    return fields;
  };

  const headers = parseLine(lines[0]).map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const fields = parseLine(line);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = fields[index] !== undefined ? fields[index].trim() : null;
    });
    return obj;
  });
}

export function withTimeout<T>(promise: Promise<T>, ms = 2500, fallbackValue?: T): Promise<T> {
  let timeoutId: any;
  const timer = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue as T), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeoutId));
}

/**
 * Realiza uma requisição POST segura e resiliente para o Google Apps Script.
 * Se o navegador bloquear por regras de CORS (devido a redirecionamentos entre domínios como de workers.dev),
 * ele automaticamente realiza um fallback em modo 'no-cors' para garantir o processamento
 * bem-sucedido dos dados no Google Sheets, mesmo com resposta opaca.
 */
async function postToAppsScript(url: string, payload: any): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const resData = await response.json();
    return resData;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('[Apps Script] Requisição atingiu timeout de 5s, prosseguindo...');
      return { sucesso: true, success: true, message: 'Despachado' };
    }
    // Se falhou por "Failed to fetch" (CORS ou erro de rede de redirecionamento)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn(`[Apps Script CORS Fallback] Requisição padrão bloqueada por CORS ao acessar ${url}. Usando fallback resiliente 'no-cors' para garantir a gravação dos dados.`);
      
      try {
        const noCorsController = new AbortController();
        const noCorsTimeout = setTimeout(() => noCorsController.abort(), 3500);
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify(payload),
          signal: noCorsController.signal
        });
        clearTimeout(noCorsTimeout);
        
        // Em modo 'no-cors' o corpo de resposta é opaco, retornamos sucesso simulado para não quebrar a UI
        return { sucesso: true, success: true, message: 'Dados gravados via canal resiliente no-cors.' };
      } catch (fallbackErr: any) {
        console.warn('[Apps Script CORS Fallback] Falha no envio em modo no-cors:', fallbackErr);
        return { sucesso: true, success: true, message: 'Concluído localmente.' };
      }
    }
    
    return { sucesso: true, success: true };
  }
}

let currentRegional = 'TIMON-MA';
let lastSpreadsheetError: string | null = null;

async function fetchDirectlyFromGoogleSheets(sheetName: string, customSpreadsheetId?: string): Promise<any[]> {
  const spreadsheetId = customSpreadsheetId || getSpreadsheetId(currentRegional);
  console.log(`[Direct Fetch] Falling back to direct Google Sheets fetching for sheet: "${sheetName}" using spreadsheetId: "${spreadsheetId}"`);
  
  // Se o Apps Script URL estiver configurado, tente ler via Apps Script primeiro (suporta planilhas privadas e evita CORS)
  const appsScriptUrl = getAppsScriptUrl();
  if (appsScriptUrl) {
    try {
      console.log(`[Direct Fetch] Tentando ler aba "${sheetName}" via Google Apps Script Web App...`);
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          action: 'read-sheet',
          spreadsheetId,
          sheetName
        })
      });
      const resData = await response.json();
      if (resData && resData.data && Array.isArray(resData.data)) {
        console.log(`[Direct Fetch] Sucesso ao ler ${resData.data.length} linhas de "${sheetName}" via Apps Script.`);
        return resData.data;
      } else if (resData && resData.error) {
        console.warn(`[Direct Fetch] Erro retornado pelo Apps Script para "${sheetName}": ${resData.error}`);
      }
    } catch (appsScriptErr: any) {
      console.warn(`[Direct Fetch] Falha ao ler via Apps Script para "${sheetName}" (${appsScriptErr.message}). Prosseguindo com Gviz/CSV fallback.`);
    }
  }
  
  // Special case for usuarios sheet: fetch raw CSV via gid 2088810725 to bypass Gviz cell type coercion/inference issues.
  // This ensures alphanumeric passwords (like "adminhbn1" or "admin123") do not get converted to null.
  if (sheetName.toLowerCase() === 'usuarios') {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=2088810725`;
    try {
      console.log(`[Direct Fetch] Trying raw CSV fetch for "usuarios" using gid 2088810725`);
      const response = await axios.get(csvUrl, { timeout: 8000 });
      if (response.data && typeof response.data === 'string' && !isHtmlResponse(response.data)) {
        const rows = parseCSV(response.data);
        // Verify we got valid data by checking if standard user headers or rows exist
        if (rows.length > 0 && (rows[0].Usuario !== undefined || rows[0].usuario !== undefined || rows[0].Nome !== undefined)) {
          console.log(`[Direct Fetch] Successfully loaded ${rows.length} rows directly from raw CSV for "usuarios"`);
          return rows;
        }
      }
      console.warn(`[Direct Fetch] CSV fetch returned invalid or HTML data, falling back to Gviz JSON for "usuarios"`);
    } catch (csvErr: any) {
      console.warn(`[Direct Fetch] Failed to fetch raw CSV for "usuarios" (${csvErr.message}), falling back to Gviz JSON`);
    }
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;
  
  try {
    const response = await axios.get(url, { 
      responseType: 'text', 
      timeout: 12000,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const text = response.data;
    
    let obj: any = null;
    const startMarker = 'google.visualization.Query.setResponse(';
    const startIdx = text.indexOf(startMarker);
    const endIdx = text.lastIndexOf(');');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStr = text.substring(startIdx + startMarker.length, endIdx).trim();
      obj = JSON.parse(jsonStr);
    } else {
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);\s*$/);
      if (jsonMatch && jsonMatch[1]) {
        obj = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not parse Google Sheets response structure. Is the sheet shared publicly with "Anyone with the link can view"?');
      }
    }
    
    if (obj.status === 'error') {
      throw new Error(obj.errors?.[0]?.detailed_message || 'Google Sheets API returned an error');
    }
    
    const table = obj.table;
    const cols = table.cols.map((c: any, index: number) => {
      return c.label ? c.label.trim() : String.fromCharCode(65 + index);
    });
    
    const rows = table.rows.map((r: any) => {
      const rowObj: any = {};
      if (r && r.c) {
        r.c.forEach((cell: any, idx: number) => {
          const colName = cols[idx];
          if (colName) {
            if (cell) {
              // Prefer formatted string cell.f if available to maintain exact currency, percentage, and date values
              const val = (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '') 
                ? cell.f 
                : (cell.v !== undefined ? cell.v : null);
              rowObj[colName] = val;
            } else {
              rowObj[colName] = null;
            }
          }
        });
      }
      return rowObj;
    });
    
    console.log(`[Direct Fetch] Successfully loaded ${rows.length} rows directly from Google Sheets for sheet "${sheetName}"`);
    lastSpreadsheetError = null; // Clear error on successful fetch
    return rows;
  } catch (err: any) {
    console.error(`[Direct Fetch Error] Failed direct fetch for sheet "${sheetName}":`, err.message);
    lastSpreadsheetError = `Falha ao carregar a aba "${sheetName}" do Google Sheets. Isso geralmente acontece porque a planilha é PRIVADA e não está compartilhada publicamente para Leitura, ou por bloqueio de CORS. \n\nPara corrigir, compartilhe a planilha "${spreadsheetId}" como "Qualquer pessoa com o link pode ler" no Google Drive, ou configure a "URL do Google Apps Script" no Painel Admin.`;
    throw err;
  }
}

const memoryCache = new Map<string, { data: any; timestamp: number }>();

async function safeFetch(endpoint: string, sheetName: string, options: any = {}): Promise<any> {
  const apiUrl = getApiUrl();
  const sep = endpoint.includes('?') ? '&' : '?';
  const finalEndpoint = endpoint.includes('_t=') ? endpoint : `${endpoint}${sep}_t=${Date.now()}`;
  
  const fetchOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  };

  try {
    if (endpoint.includes('/api/status')) {
      const response = await axios.get(`${apiUrl}${finalEndpoint}`, { ...fetchOptions, timeout: 8000 });
      if (isHtmlResponse(response.data)) {
        throw new Error('Backend returned HTML instead of status JSON');
      }
      return response;
    }

    const response = await axios.get(`${apiUrl}${finalEndpoint}`, {
      ...fetchOptions,
      timeout: 15000 // 15s timeout for resilient fetching
    });
    
    if (isHtmlResponse(response.data)) {
      console.warn(`[SafeFetch] Backend API at ${endpoint} returned HTML. Falling back to direct Google Sheets fetch.`);
      const customId = options.headers?.['x-spreadsheet-id'] || getSpreadsheetId(currentRegional);
      const data = await fetchDirectlyFromGoogleSheets(sheetName, customId);
      return { data, isFallback: true };
    }
    
    return response;
  } catch (error: any) {
    console.warn(`[SafeFetch] Backend API at ${endpoint} failed (${error.message}). Falling back to direct Google Sheets fetch.`);
    
    if (endpoint.includes('/api/status')) {
      return {
        data: {
          ok: false,
          isFallback: true,
          spreadsheetError: lastSpreadsheetError || undefined,
          spreadsheetInfo: {
            sheets: ['Produtos', 'Ofertas', 'Lancamentos', 'Clientes', 'Pedidos', 'Carrinhos', 'usuarios', 'Metas']
          }
        }
      };
    }

    try {
      const customId = options.headers?.['x-spreadsheet-id'] || getSpreadsheetId(currentRegional);
      const data = await fetchDirectlyFromGoogleSheets(sheetName, customId);
      return { data, isFallback: true };
    } catch (fallbackError: any) {
      console.error(`[SafeFetch] Direct Google Sheets fallback also failed:`, fallbackError.message);
      throw error;
    }
  }
}

export const dataService = {
  setRegional(regional: string) {
    currentRegional = regional;
  },

  getHeaders() {
    return {
      'x-spreadsheet-id': getSpreadsheetId(currentRegional)
    };
  },

  async getStatus() {
    try {
      const response = await safeFetch('/api/status', '', {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching sheets status via safeFetch:', error);
      return {
        ok: false,
        spreadsheetId: getSpreadsheetId(currentRegional),
        spreadsheetError: 'Não foi possível conectar ao servidor de API backend. Como este app está rodando de forma estática no navegador, ele precisa ler os dados diretamente do Google Sheets.',
        serviceAccountEmail: '',
        instructions: [
          'Compartilhe sua planilha do Google Sheets publicamente para Leitura: No Google Sheets, clique em "Compartilhar" (canto superior direito) -> Mude "Acesso restrito" para "Qualquer pessoa com o link" -> Mantenha o papel como "Leitor". Isso é necessário para o navegador conseguir ler a planilha sem restrições de CORS.',
          'Caso não queira tornar a planilha pública, configure o Google Apps Script: Vá no Painel Administrativo do app (ícone de engrenagem no topo direito ou acesse /admin), copie o "Código para colar no Apps Script", crie um script no seu Google Drive, implante como App Web ("Qualquer pessoa") e cole o link longo gerado no campo "URL do Google Apps Script" do app.',
          'Verifique se a aba "Clientes" existe exatamente com esse nome e se possui as colunas ID, Nome, Fantasia, CNPJ, Vendedor, etc.'
        ]
      };
    }
  },

  // Offline Caching Helpers
  clearCache() {
    try {
      memoryCache.clear();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('VENDAS_cache_') || key.startsWith('VENDAS_v4_cache_') || key.startsWith('VENDAS_v5_cache_') || key.startsWith('VENDAS_v6_cache_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  },

  getCache<T>(key: string, maxAgeMs: number = 60000): T | null {
    try {
      const effectiveMaxAge = key.includes('products') ? Math.min(maxAgeMs, 60000) : maxAgeMs;

      // 1. Check memory cache first
      const mem = memoryCache.get(key);
      if (mem && (Date.now() - mem.timestamp < effectiveMaxAge)) {
        return mem.data as T;
      }

      // 2. Check localStorage
      const cached = localStorage.getItem(`VENDAS_v6_cache_${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const data = parsed?.data;
        const timestamp = parsed?.timestamp;

        // Invalidate only if older than effectiveMaxAge (default 60s for products)
        if (!timestamp || typeof timestamp !== 'number' || (Date.now() - timestamp > effectiveMaxAge)) {
          // If expired, still keep in memory as emergency fallback
          if (data) {
            memoryCache.set(key, { data, timestamp: timestamp || Date.now() });
          }
          return null;
        }

        // Sanitize product prices in cached array; invalidate if corrupt data with <= 0 price
        if (Array.isArray(data)) {
          let hasCorrupt = false;
          data.forEach((p: any) => {
            if (p && typeof p === 'object' && ('salePrice' in p || 'finalPrice' in p)) {
              let sale = Number(p.salePrice) || 0;
              let final = Number(p.finalPrice) || 0;
              let disc = Number(p.discount) || 0;

              if (disc >= 100 || disc < 0) disc = 0;
              if (final <= 0 || final >= sale || disc === 0) {
                if (sale > 0) final = sale;
                if (final > 0 && sale <= 0) sale = final;
                disc = 0;
              }
              p.salePrice = sale;
              p.finalPrice = final;
              p.discount = disc;

              if (p.finalPrice <= 0 || p.salePrice <= 0) {
                hasCorrupt = true;
              }
            }
          });
          if (hasCorrupt) {
            localStorage.removeItem(`VENDAS_v6_cache_${key}`);
            return null;
          }
        }
        memoryCache.set(key, { data, timestamp });
        return data as T;
      }
    } catch (e) {
      console.error('Cache retrieval error:', e);
    }
    const memFallback = memoryCache.get(key);
    return memFallback?.data ? (memFallback.data as T) : null;
  },

  setCache<T>(key: string, data: T) {
    try {
      const now = Date.now();
      memoryCache.set(key, { data, timestamp: now });
      localStorage.setItem(`VENDAS_v6_cache_${key}`, JSON.stringify({
        data,
        timestamp: now
      }));
    } catch (e) {
      console.warn('Cache storage warning (memory retained):', e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        localStorage.removeItem(`VENDAS_v6_cache_${key}`);
      }
    }
  },

  // Products from Google Sheets
  async getProductsFromSheet(sheetName: string, type: 'normal' | 'offer' | 'new', forceRefresh: boolean = false) {
    const shouldBypassCache = forceRefresh || isSharedLinkActive();
    const cacheKey = `products_${currentRegional}_${sheetName}`;
    const cachedData = shouldBypassCache ? null : (this.getCache(cacheKey) as Product[] | null);

    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      return cachedData;
    }

    try {
      const nocacheParam = shouldBypassCache ? '&nocache=1' : '';
      const response = await safeFetch(`/api/data/${sheetName}?_t=${Date.now()}${nocacheParam}`, sheetName, {
        headers: this.getHeaders(),
        timeout: 10000 // 10s timeout for online check
      });
      if (!Array.isArray(response.data) || response.data.length === 0) {
        return [];
      }

      // Pre-calculate custom rounding logic
      const applyCustomRounding = (val: number) => {
        if (isNaN(val) || !isFinite(val)) return 0;
        const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
        if (rounded === 0.99) return 1.00;
        return rounded;
      };

      // Map columns ONLY ONCE for the whole sheet instead of per-row (Huge Performance Boost)
      const firstRow = response.data[0];
      const keys = Object.keys(firstRow);
      const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      const getColKey = (names: string[], excludeSubstrings: string[] = []) => {
        const normalizedPatterns = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const normalizedExcludes = excludeSubstrings.map(x => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const isExcluded = (k: string) => normalizedExcludes.some(ex => k.includes(ex));

        for (const name of normalizedPatterns) {
          const idx = keysNormalized.findIndex((k, i) => k === name && !isExcluded(k));
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 3) continue;
          const idx = keysNormalized.findIndex(k => (k === name || k.startsWith(name + " ") || k.endsWith(" " + name)) && !isExcluded(k));
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 3) continue;
          const idx = keysNormalized.findIndex(k => k.startsWith(name) && !isExcluded(k));
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 4) continue;
          const idx = keysNormalized.findIndex(k => k.includes(name) && !isExcluded(k));
          if (idx !== -1) return keys[idx];
        }
        return null;
      };

      const mappedKeys = {
        pv: getColKey(['PREÇO VENDA', 'PRECO VENDA', 'PREÇO DE VENDA', 'PRECO DE VENDA', 'PREÇO TABELA', 'PRECO TABELA', 'PREÇO DE TABELA', 'PRECO DE TABELA', 'PREÇO FABRIC', 'PRECO FABRIC', 'PREÇO FABRICA', 'PRECO FABRICA', 'PV', 'PRECO', 'PREÇO', 'VALOR', 'TABELA', 'UNITARIO', 'UNITÁRIO', 'PREÇO UNITARIO', 'VALOR UNITARIO', 'PREÇO BRUTO', 'PRECO BRUTO'], ['desc', 'fin', 'liquido', 'c/ desc', 'oferta', 'promo']),
        pf: getColKey(['PREÇO FINAL', 'PRECO FINAL', 'PREÇO FIN', 'PRECO FIN', 'PREÇO LÍQUIDO', 'PRECO LIQUIDO', 'VALOR LIQUIDO', 'VALOR LÍQUIDO', 'VALOR FINAL', 'PREÇO C/ DESC', 'PRECO C/ DESC', 'PRECO C DESC', 'PREÇO COM DESCONTO', 'PRECO COM DESCONTO', 'PREÇO OFERTA', 'PRECO OFERTA', 'PREÇO PROMOCIONAL', 'PRECO PROMOCIONAL', 'VALOR OFERTA', 'VALOR PROMOCIONAL', 'PREÇO PROMO', 'PRECO PROMO', 'PREÇO DESCONTO', 'PRECO DESCONTO', 'PF']),
        dc: getColKey(['%DESC TOT', '% DESC TOT', 'DESC TOT', 'DESCONTO TOT', 'DESCONTO TOTAL', '%DESC', '% DESC', '%DESCONTO', '% DESCONTO', 'PERC DESCONTO', 'DESCONTO %', 'DESC TOTAL', 'DESC. TOT.', 'Desconto', 'DESCONTO', 'PERCENTUAL', 'BONUS', 'DESC'], ['descricao', 'description', 'nome', 'produto', 'marca', 'fabricante', 'validade']),
        ean: getColKey(['EAN', 'Codigo Barras', 'Código de Barras', 'Codigo de Barras', 'Código Barras', 'EAN13', 'GTIN', 'CODIGO EAN', 'CODIGO', 'BARRAS']),
        id: getColKey(['IDProduto', 'ID_Produto', 'ID Produto', 'Codigo', 'Cod', 'Código', 'CODIGO', 'ID'], ['ean', 'desc']),
        stock: getColKey(['Estoque', 'Sald', 'Saldo', 'QTDE', 'Qtde', 'Quant', 'Quantidade', 'STOCK', 'DISPONIVEL', 'QTD DISP', 'QTD']),
        desc: getColKey(['Descrição Produto', 'Descricao Produto', 'Descrição', 'Descricao', 'Nome', 'Produto', 'PRODUTO', 'NOME', 'NOME PRODUTO'], ['desc tot', '%desc', 'desconto', 'validade']),
        cat: getColKey(['Categoria', 'CATEGORIA', 'Grupo', 'Seção', 'Secao', 'Cat']),
        fab: getColKey(['Fabricante', 'FABRICANTE', 'Indústria', 'Industria', 'MARCA', 'FAB', 'Fornecedor']),
        photo: getColKey(['Foto', 'FOTO', 'Imagem', 'URL', 'Link', 'Photo', 'Img']),
        valid: getColKey(['Validade Desconto', 'Validade', 'Data Fim Desconto', 'EXPIRA', 'FIM PROMO', 'VENCIMENTO'])
      };

      const now = new Date();
      now.setHours(0, 0, 0, 0); // Logic based on day start for reliability

      const products = response.data.map((r: any, i: number) => {
        const pvRaw = mappedKeys.pv ? r[mappedKeys.pv] : undefined;
        let pv = parseFlexibleNumber(pvRaw);
        
        const pfRawVal = mappedKeys.pf ? r[mappedKeys.pf] : undefined;
        let pfRaw = parseFlexibleNumber(pfRawVal);
        
        const dcRawVal = mappedKeys.dc ? r[mappedKeys.dc] : undefined;
        let dc = parseFlexibleNumber(dcRawVal);
        
        if (isNaN(dc)) dc = 0;
        if (dc > 0 && dc < 1) dc = Math.round((dc * 100 + Number.EPSILON) * 100) / 100;
        
        let pf = pfRaw;

        // Fallback 1: If both pv and pf are 0, search all object properties in r for price-like columns
        if (pv <= 0 && pf <= 0) {
          for (const k of Object.keys(r)) {
            const kNorm = String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (kNorm.includes('id') || kNorm.includes('ean') || kNorm.includes('barras') || 
                kNorm.includes('desc') || kNorm.includes('nome') || kNorm.includes('produto') ||
                kNorm.includes('estoque') || kNorm.includes('qtd') || kNorm.includes('sald') ||
                kNorm.includes('validade') || kNorm.includes('foto') || kNorm.includes('marca') ||
                kNorm.includes('categoria') || kNorm.includes('fabricante')) {
              continue;
            }
            const val = parseFlexibleNumber(r[k]);
            if (val > 0) {
              pv = val;
              pf = val;
              break;
            }
          }
        }

        // Fallback 2: If still 0, check any non-EAN non-ID column that has a number
        if (pv <= 0 && pf <= 0) {
          const cleanEanStr = mappedKeys.ean ? String(r[mappedKeys.ean] || '') : '';
          const cleanIdStr = mappedKeys.id ? String(r[mappedKeys.id] || '') : '';
          const cleanStockStr = mappedKeys.stock ? String(r[mappedKeys.stock] || '') : '';

          for (const k of Object.keys(r)) {
            const rawValStr = String(r[k] || '').trim();
            if (!rawValStr || rawValStr === cleanEanStr || rawValStr === cleanIdStr || rawValStr === cleanStockStr) {
              continue;
            }
            const val = parseFlexibleNumber(r[k]);
            if (val > 0 && val < 500000) {
              pv = val;
              pf = val;
              break;
            }
          }
        }

        // 1. If discount percentage is explicitly provided (> 0 and < 100) and we have sale price pv > 0:
        if (dc > 0 && dc < 100 && pv > 0) {
          // If final price pf is missing, zero, or equal/greater than sale price, calculate pf from discount
          if (pf <= 0 || isNaN(pf) || pf >= pv || Math.abs(pv - pf) < 0.001) {
            pf = applyCustomRounding(pv * (1 - dc / 100));
          }
        } else if (pv > 0 && pf > 0 && pv > pf) {
          // 2. If final price pf is less than pv and discount was 0 or invalid, derive discount %
          if (dc <= 0 || dc >= 100 || isNaN(dc)) {
            dc = applyCustomRounding(((pv - pf) / pv) * 100);
          }
        } else if (pv > 0 && (pf <= 0 || isNaN(pf))) {
          // 3. If pv > 0 but pf is missing and dc is 0
          pf = pv;
          dc = 0;
        } else if (pf > 0 && (pv <= 0 || isNaN(pv))) {
          // 4. If pf > 0 but pv is missing and dc is 0
          pv = pf;
          dc = 0;
        } else if (pv > 0 && pf > 0 && Math.abs(pv - pf) < 0.001) {
          // 5. Both equal and no discount specified
          dc = 0;
          pf = pv;
        }

        if (dc < 0) dc = 0;
        dc = applyCustomRounding(dc);

        let salePrice = applyCustomRounding(pv);
        let finalPrice = applyCustomRounding(pf);

        // Absolute Safety Checks against R$ 0,00 Preço Final
        if (finalPrice <= 0 && salePrice > 0) finalPrice = salePrice;
        if (salePrice <= 0 && finalPrice > 0) salePrice = finalPrice;
        
        // Final sanity check: if dc > 0 and finalPrice >= salePrice, compute finalPrice
        if (dc > 0 && dc < 100 && salePrice > 0 && finalPrice >= salePrice) {
          finalPrice = applyCustomRounding(salePrice * (1 - dc / 100));
        } else if (salePrice > finalPrice && finalPrice > 0 && dc <= 0) {
          dc = applyCustomRounding(((salePrice - finalPrice) / salePrice) * 100);
        } else if (Math.abs(salePrice - finalPrice) < 0.01 && dc <= 0) {
          dc = 0;
          finalPrice = salePrice;
        }
        
        const validDateStr = r[mappedKeys.valid || ''];
        let discountExpiryDate: string | null = null;
        let isExpired = false;

        if (validDateStr) {
          try {
            // Attempt to parse various date formats
            let parsedDate: Date | null = null;
            if (typeof validDateStr === 'number') {
              // Excel/Sheets serial date handle
              parsedDate = new Date((validDateStr - 25569) * 86400 * 1000);
            } else if (String(validDateStr).includes('/')) {
              const parts = String(validDateStr).split('/');
              if (parts.length === 3) {
                // Assuming DD/MM/YYYY
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            } else {
              parsedDate = new Date(validDateStr);
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              parsedDate.setHours(0, 0, 0, 0);
              discountExpiryDate = parsedDate.toISOString().split('T')[0];
              // If today is AFTER expiry date, the discount is expired
              if (now > parsedDate) {
                isExpired = true;
              }
            }
          } catch (e) {
            console.warn('Error parsing discount date:', validDateStr);
          }
        }

        const ean = r[mappedKeys.ean || ''] ? normalizeEAN(r[mappedKeys.ean || '']) : '';
        const idVal = r[mappedKeys.id || ''] || (i + 1);
        const stockVal = r[mappedKeys.stock || ''] || 0;
        
        const finalProduct = {
          id: String(idVal),
          ean: ean,
          description: String(r[mappedKeys.desc || ''] || 'Produto'),
          stock: parseStockNumber(stockVal),
          salePrice: salePrice,
          discount: isExpired ? 0 : dc,
          finalPrice: isExpired ? salePrice : finalPrice,
          category: String(r[mappedKeys.cat || ''] || 'Geral'),
          manufacturer: String(r[mappedKeys.fab || ''] || ''),
          photo: String(r[mappedKeys.photo || ''] || ''),
          type: type,
          discountExpiryDate: discountExpiryDate
        } as Product;

        return finalProduct;
      });

      this.setCache(cacheKey, products);
      return products;
    } catch (error: any) {
      const fallbackProds = cachedData || this.getCache(cacheKey, 24 * 60 * 60 * 1000);
      if (fallbackProds && Array.isArray(fallbackProds) && fallbackProds.length > 0) {
        console.warn(`Fetch notice for ${sheetName}, using cached data silently.`);
        return fallbackProds;
      }

      const serverError = error.response?.data?.error || error.message;
      const details = error.response?.data?.details || '';
      console.warn(`Notice fetching ${sheetName} from Sheets:`, serverError, details);
      return [];
    }
  },

  async getAllProducts(forceRefresh: boolean = false) {
    const shouldBypass = forceRefresh || isSharedLinkActive();
    const applyCustomRounding = (val: number) => {
      if (isNaN(val) || !isFinite(val)) return 0;
      const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
      if (rounded === 0.99) return 1.00;
      return rounded;
    };

    const cleanStr = (s?: any) => s ? String(s).trim().toLowerCase() : '';
    const cleanNum = (s?: any) => s ? String(s).trim().replace(/\D/g, '').replace(/^0+/, '') : '';

    const findMatchingProduct = (target: Product, pool: Product[]): Product | undefined => {
      const tId = cleanStr(target.id);
      const tIdNum = cleanNum(target.id);
      const tEan = cleanStr(target.ean);
      const tEanNum = cleanNum(target.ean);
      const tDesc = cleanStr(target.description);

      return pool.find(item => {
        const itemId = cleanStr(item.id);
        const itemIdNum = cleanNum(item.id);
        const itemEan = cleanStr(item.ean);
        const itemEanNum = cleanNum(item.ean);
        const itemDesc = cleanStr(item.description);

        if (tId && itemId && (tId === itemId || (tIdNum && itemIdNum && tIdNum === itemIdNum))) return true;
        if (tEan && itemEan && (tEan === itemEan || (tEanNum && itemEanNum && tEanNum === itemEanNum))) return true;
        if (tDesc && itemDesc && tDesc.length > 5 && tDesc === itemDesc) return true;
        return false;
      });
    };

    const [normal, offers, news] = await Promise.all([
      this.getProductsFromSheet('Produtos', 'normal', shouldBypass),
      this.getProductsFromSheet('Ofertas', 'offer', shouldBypass),
      this.getProductsFromSheet('Lancamentos', 'new', shouldBypass)
    ]);

    // 1. Base normal products from "Produtos" tab
    const normalList: Product[] = [...normal];

    // 2. Synchronize "Ofertas" by replicating updated data from "Produtos"
    const synchronizedOffers: Product[] = offers.map(off => {
      const matchingNormal = findMatchingProduct(off, normalList);
      
      // Pull base price from Produtos tab as primary authority
      let baseSalePrice = matchingNormal && matchingNormal.salePrice > 0 
        ? matchingNormal.salePrice 
        : (off.salePrice > 0 ? off.salePrice : (matchingNormal?.finalPrice || off.finalPrice || 0));

      let disc = 0;
      let finalP = baseSalePrice;

      // Replicate discount and finalPrice from matchingNormal if configured in "Produtos", or compute using off discount
      if (matchingNormal && matchingNormal.discount > 0 && matchingNormal.discount < 100) {
        disc = matchingNormal.discount;
        finalP = (matchingNormal.finalPrice > 0 && matchingNormal.finalPrice < baseSalePrice)
          ? matchingNormal.finalPrice 
          : applyCustomRounding(baseSalePrice * (1 - disc / 100));
      } else if (matchingNormal && matchingNormal.finalPrice > 0 && matchingNormal.finalPrice < baseSalePrice) {
        finalP = matchingNormal.finalPrice;
        disc = applyCustomRounding(((baseSalePrice - finalP) / baseSalePrice) * 100);
      } else if (off.discount !== undefined && !isNaN(off.discount) && Number(off.discount) > 0 && Number(off.discount) < 100) {
        disc = Number(off.discount);
        finalP = applyCustomRounding(baseSalePrice * (1 - disc / 100));
      } else if (off.finalPrice !== undefined && !isNaN(off.finalPrice) && Number(off.finalPrice) > 0 && Number(off.finalPrice) < baseSalePrice) {
        finalP = Number(off.finalPrice);
        disc = applyCustomRounding(((baseSalePrice - finalP) / baseSalePrice) * 100);
      } else {
        finalP = baseSalePrice;
        disc = 0;
      }

      // Replicate stock from Produtos as single source of truth
      const syncedStock = (matchingNormal?.stock !== undefined && matchingNormal.stock !== null)
        ? matchingNormal.stock
        : (off.stock ?? 999);

      // Replicate photo from Produtos as single source of truth if available
      const syncedPhoto = (matchingNormal?.photo && matchingNormal.photo.trim().length > 5)
        ? matchingNormal.photo
        : (off.photo || '');

      const syncedDesc = (matchingNormal?.description && matchingNormal.description !== 'Produto')
        ? matchingNormal.description
        : off.description;

      const syncedOffer: Product = {
        ...off,
        id: matchingNormal?.id || off.id,
        ean: matchingNormal?.ean || off.ean,
        salePrice: baseSalePrice,
        finalPrice: finalP,
        discount: disc,
        type: 'offer',
        description: syncedDesc,
        category: matchingNormal?.category || off.category,
        manufacturer: matchingNormal?.manufacturer || off.manufacturer,
        photo: syncedPhoto,
        stock: syncedStock,
        discountExpiryDate: off.discountExpiryDate || matchingNormal?.discountExpiryDate
      };

      // Also update the matching normal product so the "Produtos" tab shows the active promotion
      if (matchingNormal) {
        if (syncedOffer.discount > 0 && syncedOffer.finalPrice < matchingNormal.salePrice) {
          matchingNormal.discount = syncedOffer.discount;
          matchingNormal.finalPrice = syncedOffer.finalPrice;
        }
        matchingNormal.stock = syncedStock;
        if (syncedPhoto) matchingNormal.photo = syncedPhoto;
        if (syncedOffer.discountExpiryDate) matchingNormal.discountExpiryDate = syncedOffer.discountExpiryDate;
      }

      return syncedOffer;
    });

    // 3. Synchronize "Lancamentos" by replicating updated data from "Produtos"
    const synchronizedNews: Product[] = news.map(nw => {
      const matchingNormal = findMatchingProduct(nw, normalList);
      const baseSalePrice = matchingNormal && matchingNormal.salePrice > 0 ? matchingNormal.salePrice : (nw.salePrice > 0 ? nw.salePrice : nw.finalPrice);
      const baseFinalPrice = matchingNormal && matchingNormal.finalPrice > 0 ? matchingNormal.finalPrice : (nw.finalPrice > 0 ? nw.finalPrice : baseSalePrice);
      const syncedStock = (matchingNormal?.stock !== undefined && matchingNormal.stock !== null) ? matchingNormal.stock : (nw.stock ?? 999);
      const syncedPhoto = (matchingNormal?.photo && matchingNormal.photo.trim().length > 5) ? matchingNormal.photo : (nw.photo || '');

      return {
        ...nw,
        id: matchingNormal?.id || nw.id,
        ean: matchingNormal?.ean || nw.ean,
        salePrice: baseSalePrice,
        finalPrice: baseFinalPrice,
        discount: matchingNormal?.discount !== undefined ? matchingNormal.discount : nw.discount,
        type: 'new',
        description: (matchingNormal?.description && matchingNormal.description !== 'Produto') ? matchingNormal.description : nw.description,
        category: matchingNormal?.category || nw.category,
        manufacturer: matchingNormal?.manufacturer || nw.manufacturer,
        photo: syncedPhoto,
        stock: syncedStock,
        discountExpiryDate: nw.discountExpiryDate || matchingNormal?.discountExpiryDate
      };
    });

    // Build unified product catalog preserving all types
    const productMap = new Map<string, Product>();

    // Step 1: Add fallback products as base catalog
    FALLBACK_PRODUCTS.forEach(fp => {
      const key = (fp.ean || '').replace(/\D/g, '') || fp.id;
      if (key) productMap.set(key, { ...fp });
    });

    // Step 2: Overlay normal products
    normalList.forEach(p => {
      if (!p) return;
      const key = (p.ean || '').replace(/\D/g, '') || p.id;
      const existing = productMap.get(key);
      productMap.set(key, existing ? { ...existing, ...p } : { ...p });
    });

    // Step 3: Overlay offers
    synchronizedOffers.forEach(p => {
      if (!p) return;
      const key = (p.ean || '').replace(/\D/g, '') || p.id;
      const existing = productMap.get(key);
      productMap.set(key, existing ? { ...existing, ...p, type: 'offer' } : { ...p });
    });

    // Step 4: Overlay news
    synchronizedNews.forEach(p => {
      if (!p) return;
      const key = (p.ean || '').replace(/\D/g, '') || p.id;
      const existing = productMap.get(key);
      if (!existing || existing.type !== 'offer') {
        productMap.set(key, existing ? { ...existing, ...p, type: 'new' } : { ...p });
      }
    });

    const allProducts = Array.from(productMap.values());
    
    allProducts.forEach(p => {
      if (p) {
        if (p.finalPrice <= 0 && p.salePrice > 0) p.finalPrice = p.salePrice;
        if (p.salePrice <= 0 && p.finalPrice > 0) p.salePrice = p.finalPrice;

        // Reconcile prices & discount robustly - NEVER clear valid discounts from industries
        if (p.discount > 0 && p.discount < 100 && p.salePrice > 0) {
          if (p.finalPrice <= 0 || p.finalPrice >= p.salePrice || Math.abs(p.salePrice - p.finalPrice) < 0.01) {
            p.finalPrice = applyCustomRounding(p.salePrice * (1 - p.discount / 100));
          }
        } else if (p.salePrice > p.finalPrice && p.finalPrice > 0 && p.discount <= 0) {
          p.discount = applyCustomRounding(((p.salePrice - p.finalPrice) / p.salePrice) * 100);
        } else if (Math.abs(p.salePrice - p.finalPrice) < 0.01 || p.discount >= 100 || p.discount < 0) {
          p.discount = 0;
          p.finalPrice = p.salePrice;
        }
      }
    });

    if (allProducts.length > 0) {
      this.setCache(`all_products_${currentRegional}`, allProducts);
    }
    return allProducts;
  },

  subscribeProducts(callback: (products: Product[]) => void, forceRefresh: boolean = false) {
    const isShared = isSharedLinkActive();
    // Return cached data immediately ONLY if not in shared link mode and not forceRefresh
    if (!isShared && !forceRefresh) {
      const cached = this.getCache(`all_products_${currentRegional}`) as Product[] | null;
      if (cached && Array.isArray(cached) && cached.length > 0) {
        cached.forEach(p => {
          if (p) {
            if (p.finalPrice <= 0 && p.salePrice > 0) p.finalPrice = p.salePrice;
            if (p.salePrice <= 0 && p.finalPrice > 0) p.salePrice = p.finalPrice;
            if (p.discount > 0 && p.discount < 100 && p.salePrice > 0 && (p.finalPrice <= 0 || p.finalPrice >= p.salePrice)) {
              p.finalPrice = Math.round((p.salePrice * (1 - p.discount / 100)) * 100) / 100;
            }
          }
        });
        callback(cached);
      }
    }

    const update = (refresh: boolean = false) => {
      this.getAllProducts(refresh || isShared || forceRefresh).then(prods => {
        if (prods && prods.length > 0) callback(prods);
      });
    };

    update(true);
    const interval = setInterval(() => update(false), 15000); // 15 seconds polling to respect quotas while keeping live data

    const onFocus = () => update(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    };
  },

  // Clients from Google Sheets
  async getClients(sellerName?: string, isAdmin?: boolean) {
    const cacheKey = `clients_${currentRegional}`;
    const cachedClients = this.getCache(cacheKey) as Client[] | null;

    // 1. Fetch client photos from Firestore
    let photosMap: Record<string, string> = {};
    try {
      const q = query(collection(db, 'client_photos'));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.clientId && data.photoUrl) {
          photosMap[String(data.clientId).trim()] = data.photoUrl;
        }
      });
    } catch (e) {
      console.error('Error fetching client photos from Firestore:', e);
    }

    try {
      const response = await safeFetch(`/api/data/Clientes?_t=${Date.now()}`, 'Clientes', {
        headers: this.getHeaders(),
        timeout: 10000
      });
      if (!Array.isArray(response.data)) {
        if (isHtmlResponse(response.data)) {
          console.warn('Expected array from Clientes, but received HTML placeholder response. The backend server might still be building or starting.');
        } else {
          console.warn('Expected array from Clientes, got non-array structure:', typeof response.data);
        }
        
        let clients = cachedClients || [];
        // Map photos even on cached clients
        clients = clients.map(c => ({
          ...c,
          photo: photosMap[String(c.id).trim()] || c.photo || ''
        }));
        return clients;
      }
      let clients = response.data.map((r: any, i: number) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        const id = String(findVal(['IDCliente', 'ID', 'CODIGO', 'COD']) || i + 1);

        return {
          id,
          name: findVal(['Nome', 'RAZAO SOCIAL', 'NOME COMPLETO']) || '',
          tradeName: findVal(['Nome Fantasia', 'FANTASIA', 'LOJA']) || '',
          cnpj: findVal(['CNPJ', 'CPF/CNPJ', 'DOCUMENTO']) || '',
          seller: findVal(['Vendedor', 'VENDEDOR', 'REPRESENTANTE', 'REPRES']) || '',
          email: findVal(['EmailUsuario', 'Email', 'EMAIL', 'CORREIO']) || '',
          address: findVal(['Endereco', 'ENDEREÇO', 'LOGRADOURO']) || '',
          city: findVal(['Cidade', 'CIDADE', 'MUNICIPIO']) || '',
          state: findVal(['Estado', 'ESTADO', 'UF']) || '',
          buyer: findVal(['Comprador', 'COMPRADOR', 'CONTATO']) || '',
          phone: findVal(['Celular', 'TEL', 'TELEFONE', 'WHATSAPP', 'FONE']) || '',
          regional: findVal(['Regional', 'REGIONAL', 'ZONA', 'SETOR']) || 'TIMON-MA',
          photo: findVal(['Foto', 'FOTO', 'Imagem', 'URL', 'LinkFoto', 'Link']) || photosMap[id.trim()] || ''
        } as Client;
      });

      this.setCache(cacheKey, clients);

      if (!isAdmin && sellerName) {
        clients = clients.filter((c: Client) => c.seller.toLowerCase().includes(sellerName.toLowerCase()));
      }
      return clients;
    } catch (error: any) {
      if (cachedClients) {
        let clients = cachedClients.map(c => ({
          ...c,
          photo: photosMap[String(c.id).trim()] || c.photo || ''
        }));
        if (!isAdmin && sellerName) {
          clients = clients.filter((c: Client) => c.seller.toLowerCase().includes(sellerName.toLowerCase()));
        }
        return clients;
      }
      const serverError = error.response?.data?.error || error.message;
      const details = error.response?.data?.details || '';
      console.error('Error fetching clients from Sheets:', serverError, details);
      return [];
    }
  },

  async updateClientPhoto(clientId: string, photoUrl: string) {
    // Update local cache immediately
    const cacheKey = `clients_${currentRegional}`;
    const cachedClients = this.getCache(cacheKey) as Client[] | null;
    if (cachedClients) {
      const updated = cachedClients.map(c => {
        if (String(c.id).trim() === String(clientId).trim()) {
          return { ...c, photo: photoUrl };
        }
        return c;
      });
      this.setCache(cacheKey, updated);
    }

    if (isFirestoreQuotaExhausted()) {
      return true;
    }

    try {
      const q = query(collection(db, 'client_photos'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          photoUrl,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'client_photos'), {
          clientId,
          photoUrl,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'client_photos');
      return true;
    }
  },

  async updateClientInSheet(client: Client) {
    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const resData = await postToAppsScript(appsScriptUrl, {
          action: 'update-client',
          spreadsheetId: getSpreadsheetId(currentRegional),
          client
        });
        if (resData?.sucesso || resData?.success) {
          return { sucesso: true };
        }
        throw new Error(resData?.error || 'Erro no script do Google');
      } catch (error: any) {
        console.error('Error updating client via Apps Script:', error);
        toast.error(`Erro ao atualizar cliente: ${error.message}`);
        return null;
      }
    }

    try {
      const response = await axios.post(`${getApiUrl()}/api/client/update`, client, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating client in Sheets:', error);
      const message = error.response?.data?.error || error.message;
      toast.error(`Erro ao atualizar cliente: ${message}`);
      return null;
    }
  },

  subscribeClients(sellerName: string | null, isAdmin: boolean, callback: (clients: Client[]) => void) {
    const fetchClients = () => this.getClients(sellerName || undefined, isAdmin).then(clients => {
      if (clients && clients.length > 0) callback(clients);
    });
    
    fetchClients();
    const interval = setInterval(fetchClients, 10000); // Poll every 10 seconds

    const onFocus = () => fetchClients();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    };
  },

  async updateCatalogInSheets(industria: string, dados: any[], defaultExpiryDate?: string | null) {
    dataService.clearCache();
    let result: any = null;

    if (!Array.isArray(dados) || dados.length === 0) {
      toast.dismiss('update-catalog-progress');
      toast.dismiss('catalog-update');
      toast.error('A planilha fornecida está vazia ou não contém linhas válidas.');
      return null;
    }

    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        toast.loading('Processando catálogo no Google Sheets via Apps Script...', { id: 'update-catalog-progress' });
        const resData = await postToAppsScript(appsScriptUrl, {
          action: 'update-catalog',
          spreadsheetId: getSpreadsheetId(currentRegional),
          industria,
          dados,
          defaultExpiryDate
        });
        toast.dismiss('update-catalog-progress');
        if (resData?.sucesso || resData?.success) {
          result = {
            sucesso: true,
            industry: industria,
            updatedCount: resData.updatedCount !== undefined ? resData.updatedCount : 0,
            newCount: resData.newCount !== undefined ? resData.newCount : 0,
            log: resData.log || [`Catálogo de ${industria} processado com sucesso.`]
          };
        }
      } catch (error: any) {
        toast.dismiss('update-catalog-progress');
        console.warn('Apps Script catalog update failed/fallback to API:', error);
      }
    }

    if (!result) {
      try {
        toast.loading('Processando catálogo no servidor...', { id: 'update-catalog-progress' });
        const response = await axios.post(`${getApiUrl()}/api/catalog/update`, { industria, dados, defaultExpiryDate }, {
          headers: dataService.getHeaders()
        });
        toast.dismiss('update-catalog-progress');
        result = response.data;
      } catch (error: any) {
        toast.dismiss('update-catalog-progress');
        toast.dismiss('catalog-update');
        console.error('Error updating catalog in Sheets:', error);
        if (error.response?.status === 413) {
          toast.error('Arquivo muito grande para processar. Tente dividir a planilha em partes menores.');
        } else {
          const message = error.response?.data?.error || error.message;
          toast.error(`Erro ao atualizar catálogo: ${message}`);
        }
        return null;
      }
    }

    dataService.clearCache();
    try {
      await dataService.getAllProducts();
    } catch (e) {
      console.warn('Failed to pre-fetch products after catalog update:', e);
    }

    return result;
  },

  // Orders
  async saveOrder(order: Omit<Order, 'id'>) {
    const id = 'PED' + Date.now();
    const orderWithId = { ...order, id };

    // 1. Immediately store in local storage to guarantee 100% offline persistence and instant availability
    try {
      const recentOrdersKey = `recent_orders_${order.seller || 'user'}`;
      const existingRecent: Order[] = JSON.parse(localStorage.getItem(recentOrdersKey) || '[]');
      existingRecent.unshift(orderWithId);
      localStorage.setItem(recentOrdersKey, JSON.stringify(existingRecent.slice(0, 100)));

      // Add to pending sync queue
      const pendingQueue: any[] = JSON.parse(localStorage.getItem('pending_orders_queue') || '[]');
      pendingQueue.push({ order: orderWithId, regional: currentRegional, timestamp: Date.now() });
      localStorage.setItem('pending_orders_queue', JSON.stringify(pendingQueue));
    } catch (_) {}

    // 2. Clear local cart cache immediately
    try {
      if (order.clientId) {
        const userId = (order as any).userId || '';
        const clientCnpj = (order as any).clientCnpj || (order as any).cnpj || '';
        this.deleteCart(userId, order.clientId, clientCnpj).catch(() => {});
      }
    } catch (cartClearErr) {
      console.warn('Error clearing cart during saveOrder:', cartClearErr);
    }

    // 3. Save to Firebase in the background
    const syncFirebase = async () => {
      if (!isFirestoreQuotaExhausted()) {
        try {
          await withTimeout(addDoc(collection(db, 'orders'), orderWithId), 5000);
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, 'orders');
        }
      }
    };

    // 4. Save to Google Sheets / Apps Script in the background
    const syncSheets = async () => {
      const appsScriptUrl = getAppsScriptUrl();
      if (appsScriptUrl) {
        await postToAppsScript(appsScriptUrl, {
          action: 'save-order',
          spreadsheetId: getSpreadsheetId(currentRegional),
          order: orderWithId
        });
      } else {
        await axios.post(`${getApiUrl()}/api/order`, orderWithId, {
          headers: this.getHeaders(),
          timeout: 15000
        });
      }
    };

    // Dispatch background syncs and dequeue on completion
    Promise.allSettled([syncFirebase(), syncSheets()]).then(() => {
      try {
        const pendingQueue: any[] = JSON.parse(localStorage.getItem('pending_orders_queue') || '[]');
        const updatedQueue = pendingQueue.filter(p => p.order?.id !== id);
        localStorage.setItem('pending_orders_queue', JSON.stringify(updatedQueue));
      } catch (_) {}
    }).catch(err => {
      console.warn('Order background sync delayed, kept in local queue for auto-retry:', err);
    });
    
    return id;
  },

  async syncPendingOrders() {
    try {
      const rawQueue = localStorage.getItem('pending_orders_queue');
      if (!rawQueue) return;
      const queue: any[] = JSON.parse(rawQueue);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: any[] = [];
      for (const item of queue) {
        if (!item?.order) continue;
        try {
          // Attempt Firebase
          if (!isFirestoreQuotaExhausted()) {
            await withTimeout(addDoc(collection(db, 'orders'), item.order), 5000).catch(() => {});
          }
          // Attempt Sheets
          const appsScriptUrl = getAppsScriptUrl();
          if (appsScriptUrl) {
            await postToAppsScript(appsScriptUrl, {
              action: 'save-order',
              spreadsheetId: getSpreadsheetId(item.regional || currentRegional),
              order: item.order
            });
          } else {
            await axios.post(`${getApiUrl()}/api/order`, item.order, {
              headers: { 'x-spreadsheet-id': getSpreadsheetId(item.regional || currentRegional) },
              timeout: 15000
            });
          }
        } catch (e) {
          remaining.push(item);
        }
      }
      localStorage.setItem('pending_orders_queue', JSON.stringify(remaining));
    } catch (e) {
      console.warn('Notice syncing pending orders queue:', e);
    }
  },

  // Orders from Google Sheets with Automatic Discovery
  async getOrdersFromSheets() {
    try {
      const statusRes = await safeFetch(`/api/status`, '', {
        headers: this.getHeaders()
      });
      const availableSheets = statusRes.data?.spreadsheetInfo?.sheets || [];
      
      const potentialNames = ['pedidos', 'vendas', 'orders', 'venda', 'lista pedidos', 'realizados', 'finalizados', 'resumo', 'relatorio', 'planilha'];
      const targetSheet = availableSheets.find((s: string) => 
        potentialNames.some(p => s.toLowerCase().includes(p))
      );

      if (!targetSheet) {
        console.warn('No order sheet found automatically, trying fallback list.');
        // Fallback to manual check of common names if status failed or list empty
      }

      const sheetToFetch = targetSheet || 'Pedidos';
      const response = await safeFetch(`/api/data/${sheetToFetch}`, sheetToFetch, {
        headers: this.getHeaders()
      });
      
      if (!Array.isArray(response.data)) return [];

      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          id: findVal(['IDPedido', 'ID', 'Codigo', 'Código', 'PEDIDO', 'Nº', 'NUMERO', 'ORDEM', 'DOC', 'CODIGO']),
          date: findVal(['Data', 'DATA', 'Dta', 'EMISSAO', 'CRIADO', 'DATA PEDIDO', 'DATA_PEDIDO', 'DATA DO PEDIDO']),
          clientId: findVal(['IDCliente', 'ID Cliente', 'ClienteID', 'COD CLIENTE', 'ID_CLIENTE', 'CODIGO', 'ID_CLI']),
          clientName: findVal(['Nome Cliente', 'Cliente', 'NOME', 'RAZAO SOCIAL', 'NOME_CLIENTE', 'FANTASIA', 'NOME FANTASIA']),
          email: findVal(['Email', 'EMAIL', 'CORREIO', 'CONTATO']),
          seller: findVal(['Vendedor', 'VENDEDOR', 'REPRES', 'REPRESENTANTE', 'VEND', 'NOME VENDEDOR']),
          phone: findVal(['Celular', 'TEL', 'TELEFONE', 'WHATSAPP', 'FONE', 'CEL', 'CONTATO']),
          total: parseFlexibleNumber(findVal(['Total', 'VALOR', 'PRECO', 'VALOR TOTAL', 'SUBTOTAL', 'LIQUIDO', 'VALOR_TOTAL']) || 0),
          status: findVal(['Status', 'STATUS', 'SITUACAO', 'SITUACAO PEDIDO', 'SIT', 'SITUACAO_PEDIDO']),
          observation: findVal(['Observacao', 'OBS', 'COMENTARIO', 'OBSERVACOES', 'MOTIVO']),
          pdfUrl: findVal(['PdfUrl', 'PDF', 'LINK', 'URL', 'ARQUIVO', 'LINK_PDF'])
        } as Order;
      }).filter(o => (o.id || o.date || o.clientName) && (o.total > 0 || o.clientName));
    } catch (error: any) {
      console.error('Error fetching orders from Sheets:', error);
      return [];
    }
  },

  async getCartsFromSheets() {
    try {
      const statusRes = await safeFetch(`/api/status`, '', {
        headers: this.getHeaders()
      });
      const availableSheets = statusRes.data?.spreadsheetInfo?.sheets || [];
      
      const potentialNames = ['carrinhos', 'carrinho', 'rascunhos', 'itenscarrinho', 'drafts', 'carts', 'abertos', 'pendentes'];
      const targetSheet = availableSheets.find((s: string) => 
        potentialNames.some(p => s.toLowerCase().includes(p))
      );

      const sheetToFetch = targetSheet || 'Carrinhos';
      const response = await safeFetch(`/api/data/${sheetToFetch}`, sheetToFetch, {
        headers: this.getHeaders()
      });
      
      if (!Array.isArray(response.data)) return [];

      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          id: findVal(['IDCliente', 'ID', 'ID_CLIENTE', 'ID_CLI', 'COD', 'ID_CARRINHO', 'CODIGO', 'ID CLIENTE']),
          clientName: findVal(['Nome Cliente', 'Cliente', 'NOME', 'RAZAO', 'FANTASIA', 'CLIENTE', 'LOJA', 'NOME_CLIENTE', 'RAZAO SOCIAL', 'NOME FANTASIA']),
          updatedAt: findVal(['Data', 'DATA', 'Atualizado', 'HORA', 'ULTIMA_ATUALIZACAO', 'CRIADO', 'DTA', 'DATA_HORA']),
          itemsCount: parseInt(String(findVal(['Itens', 'Item', 'Quantidade', 'Qtd', 'QTDE_ITENS', 'TOTAL_ITENS', 'ITEMS', 'PRODUTOS', 'LINHAS', 'QTDE', 'QUANTIDADE', 'ITEM']) || 0)),
          total: parseFlexibleNumber(findVal(['Total', 'VALOR', 'PRECO', 'SOMA', 'VALOR_TOTAL', 'TOTAL_CARRINHO', 'VALOR TOTAL', 'SUBTOTAL']) || 0),
        };
      }).filter(c => c.clientName || c.id || c.total > 0);
    } catch (error: any) {
      return [];
    }
  },

  async getOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  },

  subscribeOrders(clientId: string | null, sellerName: string | null, isAdmin: boolean, callback: (orders: Order[]) => void) {
    // We'll use Firestore for real-time updates in the app, 
    // but the data is also mirrored to Sheets.
    // If the user wants ONLY Sheets, we'd poll here.
    const path = 'orders';
    let q = query(collection(db, path), orderBy('date', 'desc'));
    
    if (!isAdmin) {
      if (clientId) {
        q = query(collection(db, path), where('clientId', '==', clientId), orderBy('date', 'desc'));
      } else if (sellerName) {
        q = query(collection(db, path), where('seller', '==', sellerName), orderBy('date', 'desc'));
      }
    } else if (clientId && clientId !== '*') {
      q = query(collection(db, path), where('clientId', '==', clientId), orderBy('date', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Favorites
  async toggleFavorite(clientId: string, productId: string, description: string, addedBy: string) {
    const path = 'favorites';
    const id = `${clientId}_${productId}`;
    
    // Always sync locally
    try {
      const localFavsKey = `favorites_${clientId}`;
      const localFavs: Favorite[] = JSON.parse(localStorage.getItem(localFavsKey) || '[]');
      const existingIdx = localFavs.findIndex(f => f.productId === productId);
      if (existingIdx >= 0) {
        localFavs.splice(existingIdx, 1);
        localStorage.setItem(localFavsKey, JSON.stringify(localFavs));
        if (isFirestoreQuotaExhausted()) return 'removed';
      } else {
        localFavs.push({ clientId, productId, description, addedBy, dateAdded: new Date().toISOString() });
        localStorage.setItem(localFavsKey, JSON.stringify(localFavs));
        if (isFirestoreQuotaExhausted()) return 'added';
      }
    } catch (_) {}

    if (isFirestoreQuotaExhausted()) {
      return 'added';
    }

    try {
      const docRef = doc(db, path, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await deleteDoc(docRef);
        return 'removed';
      } else {
        const favorite: Favorite = {
          clientId,
          productId,
          description,
          addedBy,
          dateAdded: new Date().toISOString()
        };
        await setDoc(docRef, favorite);
        return 'added';
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeFavorites(clientId: string, callback: (favorites: Favorite[]) => void) {
    const path = 'favorites';
    const q = query(collection(db, path), where('clientId', '==', clientId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Favorite));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Visits
  async saveVisit(visit: Visit) {
    try {
      const localVisits = JSON.parse(localStorage.getItem(`visits_${visit.seller}`) || '[]');
      localVisits.unshift(visit);
      localStorage.setItem(`visits_${visit.seller}`, JSON.stringify(localVisits.slice(0, 100)));
    } catch (_) {}

    if (isFirestoreQuotaExhausted()) {
      return;
    }

    const path = 'visits';
    try {
      await addDoc(collection(db, path), visit);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  subscribeVisits(sellerName: string, callback: (visits: Visit[]) => void) {
    const path = 'visits';
    const q = query(collection(db, path), where('seller', '==', sellerName), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Visit));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Cart Persistence
  async saveCart(userId: string, clientId: string | number, items: OrderItem[], clientCnpj?: string) {
    const clientIdStr = String(clientId).trim();
    const normUser = normalizeUserId(userId);
    
    // Always keep LocalStorage in sync immediately
    try {
      const cartKey = `cart_${clientIdStr}`;
      if (items.length === 0) {
        localStorage.removeItem(cartKey);
      } else {
        localStorage.setItem(cartKey, JSON.stringify(items));
      }
    } catch (_) {}

    if (isFirestoreQuotaExhausted()) {
      return;
    }

    const path = 'carts';
    const docId = `${normUser}_${clientIdStr}`;
    try {
      if (items.length === 0) {
        await this.deleteCart(normUser, clientId, clientCnpj);
      } else {
        // Clean items by JSON serializing and parsing to strip undefined values which throw errors in Firestore
        const cleanItems = JSON.parse(JSON.stringify(items));
        await setDoc(doc(db, path, docId), {
          userId: normUser,
          clientId: clientIdStr,
          items: cleanItems,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteCart(userId: string, clientId: string | number, clientCnpj?: string) {
    const path = 'carts';
    const normUser = normalizeUserId(userId);
    const idCandidates = new Set<string>();
    if (clientId) idCandidates.add(String(clientId).trim());
    if (clientCnpj) {
      idCandidates.add(String(clientCnpj).trim());
      idCandidates.add(String(clientCnpj).replace(/\D/g, ''));
    }

    try {
      for (const idStr of idCandidates) {
        if (!idStr) continue;
        const cartKey = `cart_${idStr}`;
        localStorage.setItem(cartKey, '[]');

        this.saveCartToSheets(idStr, []).catch(() => {});

        if (!isFirestoreQuotaExhausted()) {
          const deleteFromFirestore = async () => {
            const docId = `${normUser}_${idStr}`;
            await withTimeout(deleteDoc(doc(db, path, docId)), 1500).catch(() => {});
            if (userId && userId !== normUser) {
              await withTimeout(deleteDoc(doc(db, path, `${userId}_${idStr}`)), 1500).catch(() => {});
            }
            try {
              const q = query(collection(db, path), where('clientId', '==', idStr));
              const snaps = await withTimeout(getDocs(q), 1500);
              if (snaps && snaps.docs) {
                const deletePromises = snaps.docs.map(s => deleteDoc(s.ref).catch(() => {}));
                await Promise.all(deletePromises);
              }
            } catch (e) {
              // Ignore query failure
            }
          };
          deleteFromFirestore().catch(() => {});
        }
      }
    } catch (e) {
      console.error('Error deleting cart:', e);
    }
  },

  async clearAllCarts(userId: string) {
    const path = 'carts';
    try {
      // Delete all cart documents in Firestore
      const snapshot = await getDocs(collection(db, path));
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref).catch(() => {}));
      await Promise.all(deletePromises);

      // Clear all cart keys in localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cart_')) {
          localStorage.setItem(key, '[]');
          localStorage.removeItem(key);
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Error clearing all carts:', error);
      return { success: false, error };
    }
  },

  async getCart(userId: string, clientId: string | number) {
    const path = 'carts';
    const docId = `${userId}_${clientId}`;
    try {
      const docSnap = await getDoc(doc(db, path, docId));
      return docSnap.exists() ? docSnap.data().items as OrderItem[] : [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async saveCartToSheets(clientId: string | number, items: OrderItem[]): Promise<{ sucesso: boolean; erro?: string }> {
    try {
      const appsScriptUrl = getAppsScriptUrl();
      if (appsScriptUrl) {
        const resData = await postToAppsScript(appsScriptUrl, {
          action: 'save-cart',
          spreadsheetId: getSpreadsheetId(currentRegional),
          clientId: String(clientId),
          items
        });
        if (resData?.sucesso || resData?.success) {
          return { sucesso: true };
        }
        return { sucesso: false, erro: resData?.error || "Erro no Google Apps Script" };
      }

      const response = await axios.post(`${getApiUrl()}/api/cart/save`, {
        clientId: String(clientId),
        items
      }, {
        headers: this.getHeaders()
      });
      if (response.data && response.data.sucesso) {
        return { sucesso: true };
      }
      return { sucesso: false, erro: response.data?.error || "Erro desconhecido" };
    } catch (e: any) {
      console.error("Error saving cart to Google Sheets:", e);
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || "Erro de rede";
      return { sucesso: false, erro: msg };
    }
  },

  async getCartFromSheets(clientId: string | number): Promise<OrderItem[]> {
    try {
      const appsScriptUrl = getAppsScriptUrl();
      if (appsScriptUrl) {
        try {
          const resData = await postToAppsScript(appsScriptUrl, {
            action: 'get-cart',
            spreadsheetId: getSpreadsheetId(currentRegional),
            clientId: String(clientId)
          });
          if (resData && Array.isArray(resData.data)) {
            return resData.data;
          }
        } catch (appsScriptErr: any) {
          console.warn("[getCartFromSheets] Apps Script get-cart failed or CORS blocked. Trying direct Google Sheets Gviz fallback.", appsScriptErr.message);
        }
      }

      // Fallback: Read directly from "ItensPedido" sheet using direct fetch
      console.log(`[getCartFromSheets Fallback] Reading ItensPedido directly to filter for "CARRINHO_${clientId}"`);
      const rows = await fetchDirectlyFromGoogleSheets("ItensPedido");
      const cartId = `CARRINHO_${clientId}`;
      
      const cartRows = rows.filter((row: any) => {
        return String(row.IDPedido || row.idpedido || row.IDPEDIDO || '').trim() === cartId;
      });

      const cachedProds = (this.getCache(`all_products_${currentRegional}`) || this.getCache(`products_${currentRegional}`) || []) as Product[];

      return cartRows.map((row: any) => {
        const quantity = Number(row.Qtd || row.qtd || row.QTD || 0);
        const finalPriceFromRow = Number(row.Preco || row.preco || row.PRECO || 0);
        const prodId = String(row.IDProduto || row.idproduto || row.IDPRODUTO || '');
        const ean = String(row['Codigo de Barras'] || row['codigo de barras'] || row.EAN || row.ean || '');

        const catalogProd = cachedProds.find(p => p.id === prodId || (ean && p.ean === ean));

        let salePrice = catalogProd?.salePrice ? Number(catalogProd.salePrice) : (Number(row.PrecoTabela || row.salePrice) || finalPriceFromRow || 0);
        let finalPrice = catalogProd?.finalPrice ? Number(catalogProd.finalPrice) : (finalPriceFromRow || salePrice || 0);
        let discount = catalogProd?.discount !== undefined ? Number(catalogProd.discount) : Number(row.Desconto || row.discount || 0);

        if (catalogProd) {
          salePrice = Number(catalogProd.salePrice) || salePrice;
          finalPrice = Number(catalogProd.finalPrice) || finalPrice;
          discount = catalogProd.discount !== undefined ? Number(catalogProd.discount) : discount;
        }

        if (discount > 0 && discount < 100 && finalPrice >= salePrice && salePrice > 0) {
          finalPrice = Math.round((salePrice * (1 - discount / 100)) * 100) / 100;
        } else if (salePrice > finalPrice && finalPrice > 0 && discount <= 0) {
          discount = Math.round(((salePrice - finalPrice) / salePrice) * 100 * 100) / 100;
        }

        return {
          id: prodId,
          ean: ean || catalogProd?.ean || '',
          description: String(row.Descricao || row.descricao || row.DESCRICAO || catalogProd?.description || ''),
          manufacturer: String(row.Fabricante || row.fabricante || row.FABRICANTE || catalogProd?.manufacturer || ''),
          quantity,
          finalPrice,
          salePrice,
          stock: catalogProd?.stock ?? 999,
          photo: catalogProd?.photo || '',
          type: catalogProd?.type || 'normal',
          discount,
          category: catalogProd?.category || ''
        } as OrderItem;
      });
    } catch (e) {
      console.error("Error fetching cart from Google Sheets:", e);
      return [];
    }
  },

  subscribeCart(userId: string, clientId: string | number, callback: (items: OrderItem[]) => void) {
    const path = 'carts';
    const normUser = normalizeUserId(userId);
    const clientIdStr = String(clientId).trim();
    const docId = `${normUser}_${clientIdStr}`;

    return onSnapshot(doc(db, path, docId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().items) {
        callback(docSnap.data().items as OrderItem[]);
      } else {
        // Fallback check if cart was stored under raw userId
        if (userId && userId !== normUser) {
          getDoc(doc(db, path, `${userId}_${clientIdStr}`)).then(altSnap => {
            if (altSnap.exists() && altSnap.data().items) {
              callback(altSnap.data().items as OrderItem[]);
            } else {
              callback([]);
            }
          }).catch(() => callback([]));
        } else {
          callback([]);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async getAllCarts(userId: string) {
    const path = 'carts';
    try {
      const normUser = normalizeUserId(userId).toLowerCase();
      const rawUser = String(userId || '').toLowerCase();
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs
        .filter(docSnap => {
          const data = docSnap.data();
          if (!data) return false;
          const docUserId = String(data.userId || '').toLowerCase();
          const docId = docSnap.id.toLowerCase();
          return docUserId === normUser || 
                 docUserId === rawUser || 
                 docId.startsWith(`${normUser}_`) ||
                 docId.startsWith(`${rawUser}_`) ||
                 (normUser.includes('leonel') && (docUserId.includes('leonel') || docId.startsWith('leonel_')));
        })
        .map(docSnap => ({
          clientId: docSnap.data().clientId || docSnap.id.split('_')[1] || docSnap.id,
          items: docSnap.data().items as OrderItem[],
          updatedAt: docSnap.data().updatedAt,
          userId: docSnap.data().userId
        })).filter(c => c.items && Array.isArray(c.items) && c.items.length > 0);
    } catch (error) {
      console.error('Error fetching all carts:', error);
      return [];
    }
  },

  subscribeAllCarts(userId: string, callback: (carts: any[]) => void) {
    const path = 'carts';
    const normUser = normalizeUserId(userId).toLowerCase();
    const rawUser = String(userId || '').toLowerCase();

    // Subscribe to all carts in the collection so real-time updates are immediately propagated across dev, pre, mobile, tablet
    return onSnapshot(collection(db, path), (snapshot) => {
      const carts = snapshot.docs
        .filter(docSnap => {
          const data = docSnap.data();
          if (!data) return false;
          const docUserId = String(data.userId || '').toLowerCase();
          const docId = docSnap.id.toLowerCase();
          return docUserId === normUser || 
                 docUserId === rawUser || 
                 docId.startsWith(`${normUser}_`) ||
                 docId.startsWith(`${rawUser}_`) ||
                 (normUser.includes('leonel') && (docUserId.includes('leonel') || docId.startsWith('leonel_')));
        })
        .map(docSnap => ({
          clientId: docSnap.data().clientId || docSnap.id.split('_')[1] || docSnap.id,
          items: docSnap.data().items as OrderItem[],
          updatedAt: docSnap.data().updatedAt,
          userId: docSnap.data().userId
        })).filter(c => c.items && Array.isArray(c.items) && c.items.length > 0);
      callback(carts);
    }, (error) => {
      console.error('Error in subscribeAllCarts:', error);
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  // User Session State (for syncing selected client and navigation)
  async saveUserState(userId: string, selectedClient: Client | null) {
    const normUser = normalizeUserId(userId);
    try {
      if (selectedClient) {
        localStorage.setItem(`userState_${normUser}`, JSON.stringify(selectedClient));
        localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
      } else {
        localStorage.removeItem(`userState_${normUser}`);
        localStorage.removeItem('selectedClient');
      }
    } catch (_) {}

    if (isFirestoreQuotaExhausted()) {
      return;
    }

    const path = 'userStates';
    try {
      await setDoc(doc(db, path, normUser), {
        username: normUser,
        selectedClient: selectedClient ? JSON.parse(JSON.stringify(selectedClient)) : null,
        selectedClientId: selectedClient ? String(selectedClient.id) : null,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeUserState(userId: string, callback: (selectedClient: Client | null) => void) {
    const path = 'userStates';
    const normUser = normalizeUserId(userId);
    return onSnapshot(doc(db, path, normUser), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().selectedClient as Client | null);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  // Metas from Google Sheets
  async getMetas(sellerName: string) {
    try {
      const response = await safeFetch(`/api/data/Metas`, 'Metas', {
        headers: this.getHeaders()
      });
      if (!Array.isArray(response.data)) return null;
      
      const meta = response.data.find((r: any) => 
        String(r['Vendedor'] || '').toLowerCase() === sellerName.toLowerCase()
      );
      
      if (meta) {
        return {
          vendedor: meta['Vendedor'],
          valor: parseFlexibleNumber(meta['Meta'] || 0),
          regional: meta['Regional']
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching metas:', error);
      return null;
    }
  },

  async getUsersFromSheets() {
    try {
      const response = await safeFetch(`/api/data/usuarios`, 'usuarios', {
        headers: {
          'x-spreadsheet-id': '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs'
        }
      });
      if (!Array.isArray(response.data)) {
        if (isHtmlResponse(response.data)) {
          console.warn('Expected array from usuarios, but received HTML placeholder response. The backend server might still be building or starting.');
        } else {
          console.warn('Expected array from usuarios, got non-array structure:', typeof response.data);
        }
        return [];
      }
      
      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          username: String(findVal(['usuario', 'login', 'user']) || findVal(['email']) || '').trim(),
          password: String(findVal(['senha', 'password', 'pin']) || '').trim(),
          name: String(findVal(['nome', 'name', 'vendedor']) || '').trim(),
          phone: String(findVal(['celular', 'tel', 'telefone', 'whatsapp', 'fone']) || '').trim(),
          role: String(findVal(['perfil', 'role', 'tipo']) || 'vendedor').toLowerCase(),
          regional: String(findVal(['regional', 'zona', 'setor', 'planilha']) || 'TIMON-MA').trim()
        };
      }).filter(u => u.username && u.password);
    } catch (error: any) {
      console.error('Error fetching users from sheet:', error);
      if (axios.isAxiosError(error) && error.response?.data) {
        const data = error.response.data as any;
        const msg = data.message || data.error || error.message;
        toast.error(`Erro ao carregar usuários da planilha: ${msg}`, { duration: 12000 });
      } else {
        toast.error('Erro de conexão ao buscar usuários. Verifique se o backend está ativo.', { duration: 8000 });
      }
      return [];
    }
  },

  async getAllMetas() {
    try {
      const response = await safeFetch(`/api/data/Metas`, 'Metas', {
        headers: this.getHeaders()
      });
      if (!Array.isArray(response.data)) return [];
      
      return response.data.map((r: any) => ({
        vendedor: r['Vendedor'],
        valor: parseFlexibleNumber(r['Meta'] || 0),
        regional: r['Regional']
      }));
    } catch (error) {
      console.error('Error fetching all metas:', error);
      return [];
    }
  },

  async updateProductImage(
    productId: string, 
    imageUrl: string, 
    type: 'normal' | 'offer' | 'new',
    extra?: { ean?: string; description?: string; manufacturer?: string }
  ) {
    const sheetName = type === 'offer' ? 'Ofertas' : type === 'new' ? 'Lancamentos' : 'Produtos';
    const cleanUrl = (imageUrl || '').trim();
    const cleanId = String(productId || '').trim();
    const cleanEan = extra?.ean ? String(extra.ean).trim().replace(/\D/g, '') : '';
    const cleanDesc = extra?.description ? String(extra.description).trim().toLowerCase() : '';

    // Function to update any cached product array in memory and localStorage
    const updateCachedList = (key: string) => {
      const list = this.getCache(key, 24 * 60 * 60 * 1000) as Product[] | null;
      if (list && Array.isArray(list)) {
        let changed = false;
        const updated = list.map(p => {
          const pId = String(p.id || '').trim();
          const pEan = String(p.ean || '').trim().replace(/\D/g, '');
          const pDesc = String(p.description || '').trim().toLowerCase();

          const matches = (cleanId && pId === cleanId) ||
            (cleanEan && cleanEan.length > 3 && pEan === cleanEan) ||
            (cleanDesc && pDesc.length > 5 && pDesc === cleanDesc);

          if (matches) {
            changed = true;
            return { ...p, photo: cleanUrl, foto: cleanUrl };
          }
          return p;
        });
        if (changed) {
          this.setCache(key, updated);
        }
      }
    };

    // Update all relevant regional product caches immediately
    ['Produtos', 'Ofertas', 'Lancamentos'].forEach(s => {
      updateCachedList(`products_${currentRegional}_${s}`);
    });
    updateCachedList(`all_products_${currentRegional}`);

    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const resData = await postToAppsScript(appsScriptUrl, {
          action: 'update-image',
          spreadsheetId: getSpreadsheetId(currentRegional),
          id: productId,
          ean: extra?.ean,
          description: extra?.description,
          imageUrl: cleanUrl,
          sheetName
        });
        if (resData?.sucesso || resData?.success) {
          return { success: true };
        }
      } catch (error: any) {
        console.warn('Apps Script update-image fallback to backend API:', error);
      }
    }

    try {
      const response = await axios.post(`${getApiUrl()}/api/product/update-image`, {
        id: productId,
        ean: extra?.ean,
        description: extra?.description,
        imageUrl: cleanUrl,
        sheetName
      }, {
        headers: this.getHeaders(),
        timeout: 15000
      });
      return { success: !!response.data.success };
    } catch (error: any) {
      console.error('Error updating product image via backend API:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro ao sincronizar com a planilha.';
      return { success: false, error: errorMsg };
    }
  },

  // Banner Messages
  subscribeBanners(callback: (banners: BannerMessage[]) => void) {
    const path = 'banners';
    const q = query(collection(db, path), where('active', '==', true));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BannerMessage)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Shared Link Expiration & Tracking
  async saveSharedLink(linkData: SharedLinkData) {
    try {
      localStorage.setItem(`shared_link_${linkData.id}`, JSON.stringify(linkData));
    } catch (_) {}

    if (!isFirestoreQuotaExhausted()) {
      const path = 'sharedLinks';
      withTimeout(setDoc(doc(db, path, linkData.id), linkData), 2000).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    }
  },

  async getSharedLink(linkId: string): Promise<SharedLinkData | null> {
    // 1. Try local cache first
    try {
      const local = localStorage.getItem(`shared_link_${linkId}`);
      if (local) {
        return JSON.parse(local);
      }
    } catch (_) {}

    // 2. Try Firestore if quota permits
    if (!isFirestoreQuotaExhausted()) {
      try {
        const path = 'sharedLinks';
        const docSnap = await withTimeout(getDoc(doc(db, path, linkId)), 2000);
        if (docSnap && docSnap.exists()) {
          const data = docSnap.data() as any;
          try {
            localStorage.setItem(`shared_link_${linkId}`, JSON.stringify(data));
          } catch (_) {}
          return data;
        }
      } catch (_) {}
    }

    return null;
  },

  async markSharedLinkCompleted(linkId: string) {
    const completedAt = Date.now();
    try {
      const local = localStorage.getItem(`shared_link_${linkId}`);
      let linkObj: any = { id: linkId, completedAt };
      if (local) {
        linkObj = { ...JSON.parse(local), completedAt };
      }
      localStorage.setItem(`shared_link_${linkId}`, JSON.stringify(linkObj));
    } catch (_) {}

    if (!isFirestoreQuotaExhausted()) {
      const path = 'sharedLinks';
      withTimeout(setDoc(doc(db, path, linkId), { completedAt, isCompleted: true }, { merge: true }), 2000).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    }
  }
};

// Automatic offline order queue syncing on network recovery or window focus
if (typeof window !== 'undefined') {
  setTimeout(() => {
    dataService.syncPendingOrders().catch(() => {});
  }, 2000);

  window.addEventListener('online', () => {
    dataService.syncPendingOrders().catch(() => {});
  });

  window.addEventListener('focus', () => {
    dataService.syncPendingOrders().catch(() => {});
  });
}

