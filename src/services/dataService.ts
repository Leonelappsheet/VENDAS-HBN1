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
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Product, Client, Order, Favorite, Visit, OrderItem, BannerMessage } from '../types';
import axios from 'axios';
import { toast } from 'sonner';
import { getSpreadsheetId } from '../constants/regionals';
import { normalizeEAN } from '../lib/utils';

export const getApiUrl = (): string => {
  try {
    const custom = localStorage.getItem('CUSTOM_API_URL');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  } catch (e) {}

  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (envUrl) {
    return envUrl;
  }

  // Fallback inteligente para quando o app está hospedado fora do Netlify/localhost
  // (por exemplo, no Cloudflare Workers ou GitHub Pages) e não tem backend próprio.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isNetlify = hostname.includes('netlify.app') || hostname.includes('netlify.com');
    const isLocalOrInternal = hostname === 'localhost' || 
                             hostname === '127.0.0.1' || 
                             hostname.includes('run.app');
    
    // Se o usuário está acessando do Cloudflare Workers ou outro domínio público externo,
    // direcionamos automaticamente para o servidor backend estável do AI Studio na Cloud Run
    // que possui CORS configurado (origin: true) para permitir acessos vindos do Workers.
    if (hostname.includes('workers.dev') || hostname.includes('pages.dev') || hostname.includes('cloudflare')) {
      return 'https://ais-pre-nbovrry5l37awj3udhoyr6-141290312650.us-west2.run.app';
    }

    if (!isNetlify && !isLocalOrInternal) {
      return 'https://ais-pre-nbovrry5l37awj3udhoyr6-141290312650.us-west2.run.app';
    }
  }

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

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
  
  try {
    const response = await axios.get(url, { responseType: 'text', timeout: 8000 });
    const text = response.data;
    
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
    if (!jsonMatch) {
      throw new Error('Could not parse Google Sheets response structure. Is the sheet shared publicly with "Anyone with the link can view"?');
    }
    
    const obj = JSON.parse(jsonMatch[1]);
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
              let val = cell.v !== undefined ? cell.v : null;
              // Gviz Type Coercion Bugfix:
              // If cell.v is a Date string from Gviz like "Date(2026,0,7)" but cell.f is a string like "07.01" or "07/01/2026",
              // we must prefer the formatted string cell.f to avoid invalid prices, stock, or date parsing failures.
              if (cell.f !== undefined && cell.v !== undefined && typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
                val = cell.f;
              }
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

async function safeFetch(endpoint: string, sheetName: string, options: any = {}): Promise<any> {
  const apiUrl = getApiUrl();
  try {
    if (endpoint.includes('/api/status')) {
      const response = await axios.get(`${apiUrl}${endpoint}`, { ...options, timeout: 5000 });
      if (isHtmlResponse(response.data)) {
        throw new Error('Backend returned HTML instead of status JSON');
      }
      return response;
    }

    const response = await axios.get(`${apiUrl}${endpoint}`, {
      ...options,
      timeout: 6000 // Fallback fast if server is unresponsive
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
  getCache<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`VENDAS_cache_${key}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Optional: Implement cache expiration if needed
        return data as T;
      }
    } catch (e) {
      console.error('Cache retrieval error:', e);
    }
    return null;
  },

  setCache<T>(key: string, data: T) {
    try {
      localStorage.setItem(`VENDAS_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // LocalStorage might be full
      console.warn('Cache storage error (likely full):', e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        localStorage.removeItem(`VENDAS_cache_${key}`);
      }
    }
  },

  // Products from Google Sheets
  async getProductsFromSheet(sheetName: string, type: 'normal' | 'offer' | 'new') {
    const cacheKey = `products_${currentRegional}_${sheetName}`;
    const cachedData = this.getCache(cacheKey) as Product[] | null;

    try {
      const response = await safeFetch(`/api/data/${sheetName}`, sheetName, {
        headers: this.getHeaders(),
        timeout: 10000 // 10s timeout for online check
      });
      if (!Array.isArray(response.data) || response.data.length === 0) {
        return [];
      }

      // Pre-calculate custom rounding logic (3rd digit 6+)
      const applyCustomRounding = (val: number) => {
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
        
        if (rounded === 0.99) return 1.00;
        return rounded;
      };

      // Map columns ONLY ONCE for the whole sheet instead of per-row (Huge Performance Boost)
      const firstRow = response.data[0];
      const keys = Object.keys(firstRow);
      const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      const getColKey = (names: string[]) => {
        const normalizedPatterns = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        for (const name of normalizedPatterns) {
          const idx = keysNormalized.indexOf(name);
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 3) continue;
          const idx = keysNormalized.findIndex(k => k.startsWith(name));
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 4) continue;
          const idx = keysNormalized.findIndex(k => k.includes(name));
          if (idx !== -1) return keys[idx];
        }
        return null;
      };

      const mappedKeys = {
        pv: getColKey(['PV', 'Preço Venda', 'Preco Venda', 'PRECO', 'PREÇO', 'VALOR', 'TABELA', 'UNITARIO', 'UNITÁRIO', 'PREÇO UNITARIO', 'VALOR UNITARIO']),
        pf: getColKey(['PF', 'Preço Final', 'Preco Final', 'VALOR FINAL', 'PREÇO LÍQUIDO', 'PRECO LIQUIDO', 'VALOR LIQUIDO']),
        dc: getColKey(['Desconto', 'DESCONTO', 'PERCENTUAL', 'BONUS']),
        ean: getColKey(['EAN', 'Codigo Barras', 'Código de Barras', 'EAN13', 'GTIN', 'CODIGO EAN', 'CODIGO', 'BARRAS']),
        id: getColKey(['IDProduto', 'ID_Produto', 'Codigo', 'Cod', 'Código', 'CODIGO', 'ID']),
        stock: getColKey(['Estoque', 'Sald', 'Saldo', 'QTDE', 'Qtde', 'Quant', 'Quantidade', 'STOCK', 'DISPONIVEL', 'QTD DISP']),
        desc: getColKey(['Descrição', 'Descricao', 'Nome', 'Produto', 'Descricao Produto', 'PRODUTO', 'NOME']),
        cat: getColKey(['Categoria', 'CATEGORIA', 'Grupo']),
        fab: getColKey(['Fabricante', 'FABRICANTE', 'Indústria', 'Industria', 'MARCA', 'FAB']),
        photo: getColKey(['Foto', 'FOTO', 'Imagem', 'URL']),
        valid: getColKey(['Validade Desconto', 'Validade', 'Data Fim Desconto', 'EXPIRA', 'FIM PROMO', 'VENCIMENTO'])
      };

      const now = new Date();
      now.setHours(0, 0, 0, 0); // Logic based on day start for reliability

      const products = response.data.map((r: any, i: number) => {
        const pvRaw = r[mappedKeys.pv || ''] || 0;
        const pv = parseFloat(String(pvRaw).replace(',', '.'));
        
        const pfRawVal = r[mappedKeys.pf || ''] || 0;
        const pfRaw = parseFloat(String(pfRawVal).replace(',', '.'));
        
        const dcRawVal = r[mappedKeys.dc || ''] || 0;
        let dc = parseFloat(String(dcRawVal).replace(',', '.'));
        
        if (Math.abs(dc - pfRaw) < 0.01 || Math.abs(dc - pv) < 0.01) dc = 0;
        if (dc > 0 && dc < 1) dc = dc * 100;
        
        let pf = pfRaw;
        if (pv > 0 && pf > 0 && Math.abs(pv - pf) < 0.001) dc = 0;
        
        if (!pf && pv) {
          pf = pv - (pv * dc / 100);
        } else if (pf > 0 && pv > 0) {
          dc = ((pv - pf) / pv) * 100;
        }
        
        if (dc < 0) dc = 0;
        dc = applyCustomRounding(dc);
        const salePrice = applyCustomRounding(pv);
        const finalPrice = applyCustomRounding(pf);
        
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
          stock: (() => {
            const s = String(stockVal).trim();
            if (!s) return 0;
            // Remove dots (thousands separators commonly used in Brazil)
            // but only if there's a comma later or if it looks like a thousand (dot followed by 3 digits)
            // For simplicity and context of stock, we'll strip dots and treat comma as decimal
            const cleaned = s.replace(/\./g, '').replace(',', '.');
            const val = parseFloat(cleaned);
            return isNaN(val) ? 0 : Math.floor(val);
          })(),
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
      if (cachedData) {
        console.warn(`Fetch failed for ${sheetName}, using cached data.`);
        return cachedData;
      }

      const serverError = error.response?.data?.error || error.message;
      const details = error.response?.data?.details || '';
      console.error(`Error fetching ${sheetName} from Sheets:`, serverError, details);
      // Only toast on critical errors, not just empty sheets
      if (error.response?.status !== 404) {
        toast.error(`Offline: Usando dados locais para ${sheetName}`);
      }
      return [];
    }
  },

  async getAllProducts() {
    const [normal, offers, news] = await Promise.all([
      this.getProductsFromSheet('Produtos', 'normal'),
      this.getProductsFromSheet('Ofertas', 'offer'),
      this.getProductsFromSheet('Lancamentos', 'new')
    ]);
    const allProducts = [...normal, ...offers, ...news];
    if (allProducts.length > 0) {
      this.setCache(`all_products_${currentRegional}`, allProducts);
    }
    return allProducts;
  },

  subscribeProducts(callback: (products: Product[]) => void) {
    // Return cached data immediately if available
    const cached = this.getCache(`all_products_${currentRegional}`) as Product[] | null;
    if (cached) callback(cached);

    this.getAllProducts().then(callback);
    const interval = setInterval(() => this.getAllProducts().then(callback), 300000);
    return () => clearInterval(interval);
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
      const response = await safeFetch(`/api/data/Clientes`, 'Clientes', {
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
      
      // Update cache
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
      return true;
    } catch (error) {
      console.error('Error updating client photo in Firestore:', error);
      handleFirestoreError(error, OperationType.WRITE, 'client_photos');
      return false;
    }
  },

  async updateClientInSheet(client: Client) {
    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'update-client',
            spreadsheetId: getSpreadsheetId(currentRegional),
            client
          })
        });
        const resData = await response.json();
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
    const fetchClients = () => this.getClients(sellerName || undefined, isAdmin).then(callback);
    fetchClients();
    const interval = setInterval(fetchClients, 300000); // Poll every 5 minutes
    return () => clearInterval(interval);
  },

  async updateCatalogInSheets(industria: string, dados: any[], defaultExpiryDate?: string | null) {
    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        toast.loading('Processando catálogo no Google Sheets via Apps Script...', { id: 'update-catalog-progress' });
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'update-catalog',
            spreadsheetId: getSpreadsheetId(currentRegional),
            industria,
            dados,
            defaultExpiryDate
          })
        });
        toast.dismiss('update-catalog-progress');
        const resData = await response.json();
        if (resData?.sucesso || resData?.success) {
          toast.success('Catálogo atualizado com sucesso via Apps Script!');
          return { sucesso: true };
        }
        throw new Error(resData?.error || 'Erro no script do Google');
      } catch (error: any) {
        toast.dismiss('update-catalog-progress');
        console.error('Error updating catalog via Apps Script:', error);
        toast.error(`Erro ao atualizar catálogo: ${error.message}`);
        return null;
      }
    }

    try {
      const response = await axios.post(`${getApiUrl()}/api/catalog/update`, { industria, dados, defaultExpiryDate }, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating catalog in Sheets:', error);
      if (error.response?.status === 413) {
        toast.error('Arquivo muito grande para processar. Tente dividir a planilha em partes menores.');
      } else {
        const message = error.response?.data?.error || error.message;
        toast.error(`Erro ao atualizar catálogo: ${message}`);
      }
      return null;
    }
  },

  // Orders
  async saveOrder(order: Omit<Order, 'id'>) {
    const id = 'PED' + Date.now();
    const orderWithId = { ...order, id };

    try {
      // 1. Save to Firebase (with internal persistence enabled, it will sync later)
      const path = 'orders';
      await addDoc(collection(db, path), orderWithId);
      
      // 2. Try to save to Google Sheets (external sync)
      try {
        const appsScriptUrl = getAppsScriptUrl();
        if (appsScriptUrl) {
          await fetch(appsScriptUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
              action: 'save-order',
              spreadsheetId: getSpreadsheetId(currentRegional),
              order: orderWithId
            })
          });
        } else {
          await axios.post(`${getApiUrl()}/api/order`, orderWithId, {
            headers: this.getHeaders(),
            timeout: 5000 // Fast fail for offline
          });
        }
      } catch (sheetsError) {
        console.warn('Google Sheets sync failed (offline?), will sync later when online if the server supports it or via another mechanism.');
      }
      
      return id;
    } catch (error) {
      console.error('Error saving order (Cloud):', error);
      // Return ID anyway so the app can continue to provide PDF/WhatApp
      return id;
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
          total: parseFloat(String(findVal(['Total', 'VALOR', 'PRECO', 'VALOR TOTAL', 'SUBTOTAL', 'LIQUIDO', 'VALOR_TOTAL']) || 0).replace(',', '.')),
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
          total: parseFloat(String(findVal(['Total', 'VALOR', 'PRECO', 'SOMA', 'VALOR_TOTAL', 'TOTAL_CARRINHO', 'VALOR TOTAL', 'SUBTOTAL']) || 0).replace(',', '.')),
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
  async saveCart(userId: string, clientId: string | number, items: OrderItem[]) {
    const path = 'carts';
    const docId = `${userId}_${clientId}`;
    try {
      if (items.length === 0) {
        await deleteDoc(doc(db, path, docId));
      } else {
        // Clean items by JSON serializing and parsing to strip undefined values which throw errors in Firestore
        const cleanItems = JSON.parse(JSON.stringify(items));
        await setDoc(doc(db, path, docId), {
          userId,
          clientId: String(clientId),
          items: cleanItems,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving cart to Firestore:', error);
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error; // Rethrow to ensure caller is aware of the failure
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
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'save-cart',
            spreadsheetId: getSpreadsheetId(currentRegional),
            clientId: String(clientId),
            items
          })
        });
        const resData = await response.json();
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
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'get-cart',
            spreadsheetId: getSpreadsheetId(currentRegional),
            clientId: String(clientId)
          })
        });
        const resData = await response.json();
        if (resData && Array.isArray(resData.data)) {
          return resData.data;
        }
        return [];
      }

      const response = await axios.get(`${getApiUrl()}/api/cart/${clientId}`, {
        headers: this.getHeaders()
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      console.error("Error fetching cart from Google Sheets:", e);
      return [];
    }
  },

  subscribeCart(userId: string, clientId: string | number, callback: (items: OrderItem[]) => void) {
    const path = 'carts';
    const docId = `${userId}_${clientId}`;
    return onSnapshot(doc(db, path, docId), (docSnap) => {
      callback(docSnap.exists() ? docSnap.data().items as OrderItem[] : []);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async getAllCarts(userId: string) {
    const path = 'carts';
    try {
      const q = query(collection(db, path), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        clientId: doc.data().clientId || doc.id.split('_')[1] || doc.id,
        items: doc.data().items as OrderItem[],
        updatedAt: doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching all carts:', error);
      return [];
    }
  },

  subscribeAllCarts(userId: string, callback: (carts: any[]) => void) {
    const path = 'carts';
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const carts = snapshot.docs.map(doc => ({
        clientId: doc.data().clientId || doc.id.split('_')[1] || doc.id,
        items: doc.data().items as OrderItem[],
        updatedAt: doc.data().updatedAt
      }));
      callback(carts);
    }, (error) => {
      console.error('Error in subscribeAllCarts:', error);
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  // User Session State (for syncing selected client and navigation)
  async saveUserState(userId: string, selectedClient: Client | null) {
    const path = 'userStates';
    try {
      await setDoc(doc(db, path, userId), {
        username: userId,
        selectedClient: selectedClient ? JSON.parse(JSON.stringify(selectedClient)) : null,
        selectedClientId: selectedClient ? String(selectedClient.id) : null,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving user state:', error);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeUserState(userId: string, callback: (selectedClient: Client | null) => void) {
    const path = 'userStates';
    return onSnapshot(doc(db, path, userId), (docSnap) => {
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
          valor: parseFloat(String(meta['Meta'] || 0).replace(',', '.')),
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
        valor: parseFloat(String(r['Meta'] || 0).replace(',', '.')),
        regional: r['Regional']
      }));
    } catch (error) {
      console.error('Error fetching all metas:', error);
      return [];
    }
  },

  async updateProductImage(productId: string, imageUrl: string, type: 'normal' | 'offer' | 'new') {
    const sheetName = type === 'offer' ? 'Ofertas' : type === 'new' ? 'Lancamentos' : 'Produtos';
    const appsScriptUrl = getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            action: 'update-image',
            spreadsheetId: getSpreadsheetId(currentRegional),
            id: productId,
            imageUrl,
            sheetName
          })
        });
        const resData = await response.json();
        if (resData?.sucesso || resData?.success) {
          return { success: true };
        }
        throw new Error(resData?.error || 'Erro no script do Google');
      } catch (error: any) {
        console.error('Error updating image via Apps Script:', error);
        return { success: false, error: error.message };
      }
    }

    try {
      const response = await axios.post(`${getApiUrl()}/api/product/update-image`, {
        id: productId,
        imageUrl,
        sheetName
      }, {
        headers: this.getHeaders()
      });
      return { success: !!response.data.success };
    } catch (error: any) {
      console.error('Error updating product image:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro desconhecido';
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
  }
};
