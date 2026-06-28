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

const API_URL = ''; // Relative to current origin

function isHtmlResponse(data: any): boolean {
  if (typeof data === 'string') {
    const trimmed = data.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<div');
  }
  return false;
}

let currentRegional = 'TIMON-MA';

export const dataService = {
  setRegional(regional: string) {
    currentRegional = regional;
  },

  getHeaders() {
    return {
      'x-spreadsheet-id': getSpreadsheetId(currentRegional)
    };
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
      const response = await axios.get(`${API_URL}/api/data/${sheetName}`, {
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

    try {
      const response = await axios.get(`${API_URL}/api/data/Clientes`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      if (!Array.isArray(response.data)) {
        if (isHtmlResponse(response.data)) {
          console.warn('Expected array from Clientes, but received HTML placeholder response. The backend server might still be building or starting.');
        } else {
          console.warn('Expected array from Clientes, got non-array structure:', typeof response.data);
        }
        return cachedClients || [];
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

        return {
          id: String(findVal(['IDCliente', 'ID', 'CODIGO', 'COD']) || i + 1),
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
          regional: findVal(['Regional', 'REGIONAL', 'ZONA', 'SETOR']) || 'TIMON-MA'
        } as Client;
      });

      this.setCache(cacheKey, clients);

      if (!isAdmin && sellerName) {
        clients = clients.filter((c: Client) => c.seller.toLowerCase().includes(sellerName.toLowerCase()));
      }
      return clients;
    } catch (error: any) {
      if (cachedClients) {
        let clients = cachedClients;
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

  async updateClientInSheet(client: Client) {
    try {
      const response = await axios.post(`${API_URL}/api/client/update`, client, {
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
    try {
      const response = await axios.post(`${API_URL}/api/catalog/update`, { industria, dados, defaultExpiryDate }, {
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
        await axios.post(`${API_URL}/api/order`, orderWithId, {
          headers: this.getHeaders(),
          timeout: 5000 // Fast fail for offline
        });
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
      const statusRes = await axios.get(`${API_URL}/api/status`, {
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
      const response = await axios.get(`${API_URL}/api/data/${sheetToFetch}`, {
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
      const statusRes = await axios.get(`${API_URL}/api/status`, {
        headers: this.getHeaders()
      });
      const availableSheets = statusRes.data?.spreadsheetInfo?.sheets || [];
      
      const potentialNames = ['carrinhos', 'carrinho', 'rascunhos', 'itenscarrinho', 'drafts', 'carts', 'abertos', 'pendentes'];
      const targetSheet = availableSheets.find((s: string) => 
        potentialNames.some(p => s.toLowerCase().includes(p))
      );

      const sheetToFetch = targetSheet || 'Carrinhos';
      const response = await axios.get(`${API_URL}/api/data/${sheetToFetch}`, {
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
  async saveCart(clientId: string, items: OrderItem[]) {
    const path = 'carts';
    try {
      if (items.length === 0) {
        await deleteDoc(doc(db, path, clientId));
      } else {
        await setDoc(doc(db, path, clientId), { items, updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getCart(clientId: string) {
    const path = 'carts';
    try {
      const docSnap = await getDoc(doc(db, path, clientId));
      return docSnap.exists() ? docSnap.data().items as OrderItem[] : [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getAllCarts() {
    const path = 'carts';
    try {
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        clientId: doc.id,
        items: doc.data().items as OrderItem[],
        updatedAt: doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching all carts:', error);
      return [];
    }
  },

  // Metas from Google Sheets
  async getMetas(sellerName: string) {
    try {
      const response = await axios.get(`${API_URL}/api/data/Metas`, {
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
      const response = await axios.get(`${API_URL}/api/data/usuarios`, {
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
      const response = await axios.get(`${API_URL}/api/data/Metas`, {
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
    try {
      const response = await axios.post(`${API_URL}/api/product/update-image`, {
        id: productId,
        imageUrl,
        sheetName
      }, {
        headers: this.getHeaders()
      });
      return response.data.success;
    } catch (error) {
      console.error('Error updating product image:', error);
      return false;
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
