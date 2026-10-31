import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { 
  ChevronLeft, 
  FileUp, 
  RefreshCw, 
  FileText, 
  Table, 
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Search,
  ChevronRight,
  X,
  PlusCircle,
  Download,
  Sparkles,
  Package,
  ListPlus,
  ClipboardList,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, normalizeEAN, parseFlexibleNumber } from '../lib/utils';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { preloadProductThumbnails } from '../utils/imageExportHelper';
import { findBestMatchingClient, formatCNPJ } from '../utils/clientMatcher';
import { findBestMatchingProduct } from '../utils/productMatcher';
import { REGIONALS, getRegionalLabel, RegionalKey } from '../constants/regionals';

function enhanceResultsWithSuggestions(resultsList: any[], catalogProducts: any[]): any[] {
  if (!resultsList || resultsList.length === 0 || !catalogProducts || catalogProducts.length === 0) {
    return resultsList;
  }

  return resultsList.map(res => {
    const updatedItems = (res.items || []).map((item: any) => {
      // If already matched with a product or explicitly confirmed, keep
      if (item.found && item.product) {
        return item;
      }
      if (item.isConfirmed && item.product) {
        return item;
      }

      // Try fuzzy matching by description and EAN digits
      const searchString = `${item.description || ''} ${item.ean || ''}`;
      const best = findBestMatchingProduct(searchString, catalogProducts);

      if (best.product) {
        // Exact EAN match found embedded in description string -> auto-confirm
        if (best.score === 100) {
          return {
            ...item,
            found: true,
            product: best.product,
            ean: best.product.ean || item.ean,
            description: best.product.description || item.description,
            price: item.price || best.product.finalPrice || 0,
            suggestedProduct: undefined,
            matchScore: 100,
            isConfirmed: true
          };
        }

        // Return with suggested product for user confirmation
        return {
          ...item,
          found: false,
          suggestedProduct: best.product,
          matchScore: best.score,
          isSuggested: true
        };
      }

      return item;
    });

    return {
      ...res,
      items: updatedItems
    };
  });
}
import { 
  drawPDFHeader, 
  drawClientDataCard, 
  drawBottomSummaryCards, 
  drawObservationsBox, 
  drawPDFFooterStrip 
} from '../utils/pdfTemplate';

function inferManufacturer(desc: string): string | null {
  const d = desc.toUpperCase();
  if (d.includes('DOVE') || d.includes('REXONA') || d.includes('REX ') || d.includes('SEDA') || d.includes('CLOSE UP') || d.includes('CLOSEUP') || d.includes('CLEAR') || d.includes('BEAUTY PLANET') || d.includes('LUX') || d.includes('AXE')) {
    return 'UNILEVER';
  }
  if (d.includes('HUGGIES') || d.includes('HUG ') || d.includes('PLENITUDE') || d.includes('PLEN ') || d.includes('KOTEX') || d.includes('INTIMUS')) {
    return 'KIMBERLY CLARK';
  }
  if (d.includes('OMRON')) {
    return 'OMRON';
  }
  if (d.includes('J&J') || d.includes('JOHNSON') || d.includes('HIPOGLOS') || d.includes('CAREFREE') || d.includes('SEMPRE LIVRE') || d.includes('LISTERINE') || d.includes('BAND-AID') || d.includes('BANDAID') || d.includes('NEUTROGENA') || d.includes('REACH')) {
    return 'JOHNSON & JOHNSON';
  }
  if (d.includes('NIVEA')) {
    return 'NIVEA';
  }
  if (d.includes('ELSEVE') || d.includes('LOREAL') || d.includes("L'OREAL") || d.includes('GARNIER')) {
    return 'LOREAL';
  }
  if (d.includes('PAMPERS') || d.includes('ALWAYS') || d.includes('PANTENE') || d.includes('GILLETTE') || d.includes('ORAL-B') || d.includes('ORAL B') || d.includes('HEAD & SHOULDERS')) {
    return 'P&G';
  }
  if (d.includes('COLGATE') || d.includes('PALMOLIVE') || d.includes('SORRISO') || d.includes('PROTEX')) {
    return 'COLGATE';
  }
  return null;
}

export default function ImportPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set()); // Format: "clientIdx-itemIdx"
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedRegional, setSelectedRegional] = useState<string>('TIMON-MA');
  const [isProcessing, setIsProcessing] = useState(false);

  // Export Filter State ('all' | 'noStock' | 'notFound' | 'unavailable')
  const [selectedExportFilter, setSelectedExportFilter] = useState<'all' | 'noStock' | 'notFound' | 'unavailable'>('all');
  const [activeOrderExportMenu, setActiveOrderExportMenu] = useState<number | null>(null);

  // Substitution & Description Matching State
  const [replacingItem, setReplacingItem] = useState<{ clientIdx: number; itemIdx: number; item: any } | null>(null);
  const [replacementSearch, setReplacementSearch] = useState<string>('');

  useEffect(() => {
    if (replacingItem?.item) {
      setReplacementSearch(replacingItem.item.description || replacingItem.item.ean || '');
    } else {
      setReplacementSearch('');
    }
  }, [replacingItem]);

  const filteredReplacementProducts = useMemo(() => {
    if (!replacingItem || !allProducts || allProducts.length === 0) return [];
    
    if (!replacementSearch.trim()) {
      if (replacingItem.item?.description) {
        const best = findBestMatchingProduct(replacingItem.item.description, allProducts);
        if (best.product) {
          const rest = allProducts.filter(p => p.id !== best.product.id).slice(0, 15);
          return [best.product, ...rest];
        }
      }
      return allProducts.slice(0, 15);
    }

    const query = replacementSearch.toLowerCase().trim();
    return allProducts.filter(p => 
      p.description?.toLowerCase().includes(query) ||
      normalizeEAN(p.ean).includes(query) ||
      String(p.id).toLowerCase().includes(query) ||
      p.industry?.toLowerCase().includes(query)
    ).slice(0, 30);
  }, [replacementSearch, allProducts, replacingItem]);

  const handleConfirmSuggestion = (clientIdx: number, itemIdx: number) => {
    setResults(prev => {
      const updated = [...prev];
      const item = { ...updated[clientIdx].items[itemIdx] };
      if (item.suggestedProduct) {
        item.product = item.suggestedProduct;
        item.found = true;
        item.isConfirmed = true;
        item.ean = item.suggestedProduct.ean || item.ean;
        item.description = item.suggestedProduct.description || item.description;
        item.price = item.suggestedProduct.finalPrice || item.price;
        item.suggestedProduct = undefined;
        updated[clientIdx].items[itemIdx] = item;

        setCheckedItems(cPrev => new Set(cPrev).add(`${clientIdx}-${itemIdx}`));
        toast.success(`Produto "${item.product.description}" confirmado!`);
      }
      return updated;
    });
  };

  const handleReplaceProduct = (clientIdx: number, itemIdx: number, newProduct: any) => {
    setResults(prev => {
      const updated = [...prev];
      const item = { ...updated[clientIdx].items[itemIdx] };
      item.product = newProduct;
      item.found = true;
      item.isConfirmed = true;
      item.isReplaced = true;
      item.ean = newProduct.ean || item.ean;
      item.description = newProduct.description || item.description;
      item.price = newProduct.finalPrice || item.price;
      item.suggestedProduct = undefined;
      updated[clientIdx].items[itemIdx] = item;

      setCheckedItems(cPrev => new Set(cPrev).add(`${clientIdx}-${itemIdx}`));
      toast.success(`Produto substituído por "${newProduct.description}"!`);
      return updated;
    });
    setReplacingItem(null);
  };

  const handleRejectSuggestion = (clientIdx: number, itemIdx: number) => {
    setResults(prev => {
      const updated = [...prev];
      const item = { ...updated[clientIdx].items[itemIdx] };
      item.suggestedProduct = undefined;
      item.isSuggested = false;
      item.found = false;
      updated[clientIdx].items[itemIdx] = item;
      toast.info('Sugestão rejeitada.');
      return updated;
    });
  };

  const splitResultsByManufacturer = useCallback((resultsList: any[]): any[] => {
    const finalSplit: any[] = [];
    resultsList.forEach(res => {
      // Group items of this result by product manufacturer
      const groups: Record<string, any[]> = {};
      res.items.forEach((item: any) => {
        const manufacturer = (item.manufacturer || item.product?.manufacturer || 'OUTROS').trim().toUpperCase();
        if (!groups[manufacturer]) {
          groups[manufacturer] = [];
        }
        groups[manufacturer].push(item);
      });

      // Create a separate result block for each manufacturer
      Object.entries(groups).forEach(([manufacturer, mItems]) => {
        const baseCotacao = res.orderNumber ? `Pedido #${res.orderNumber}` : (res.headerInfo?.cotacao || 'IMPORTAÇÃO');
        finalSplit.push({
          ...res,
          orderNumber: res.orderNumber,
          numeroPedido: res.numeroPedido,
          filial: res.filial,
          headerInfo: {
            status: 'Pendente',
            dataEntrega: new Date().toLocaleDateString('pt-BR'),
            ...(res.headerInfo || {}),
            cotacao: baseCotacao,
            fornecedor: manufacturer
          },
          items: mItems
        });
      });
    });
    return finalSplit;
  }, []);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [selectedImportClient, setSelectedImportClient] = useState<any>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const parsedBulkItems = useMemo(() => {
    if (!bulkImportText.trim()) return [];
    
    const lines = bulkImportText.split('\n');
    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Split by tab, space, semicolon, comma, or vertical bar
      const parts = trimmed.split(/[\t\s,;|]+/);
      if (parts.length === 0) return null;
      
      const code = parts[0].trim();
      let qty = 1;
      if (parts.length > 1) {
        const parsedQty = parseInt(parts[1].trim(), 10);
        if (!isNaN(parsedQty)) {
          qty = parsedQty;
        }
      }
      
      // Look up product by EAN or ID (code)
      const cleanCode = code.replace(/^0+/, '');
      const product = allProducts.find(p => {
        const pEanClean = p.ean ? p.ean.replace(/^0+/, '') : '';
        const pIdClean = p.id ? p.id.replace(/^0+/, '') : '';
        return pEanClean === cleanCode || pIdClean === cleanCode || p.ean === code || p.id === code || normalizeEAN(p.ean) === normalizeEAN(code);
      }) || null;
      
      let error: string | null = null;
      if (!product) {
        error = 'Não encontrado';
      } else if (product.stock <= 0) {
        error = 'Sem estoque';
      } else if (qty > product.stock) {
        error = `Estoque insuficiente (Disponível: ${product.stock})`;
      }
      
      return {
        inputLine: line,
        code,
        quantity: qty,
        product,
        error
      };
    }).filter(Boolean);
  }, [bulkImportText, allProducts]);

  const bulkImportTotal = useMemo(() => {
    return parsedBulkItems.reduce((acc, item) => {
      if (item && item.product && !item.error) {
        const qty = Math.min(item.quantity, item.product.stock);
        return acc + (item.product.finalPrice * qty);
      }
      return acc;
    }, 0);
  }, [parsedBulkItems]);

  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return allClients;
    const term = clientSearchTerm.toLowerCase();
    return allClients.filter(c => 
      c.name?.toLowerCase().includes(term) || 
      c.tradeName?.toLowerCase().includes(term) || 
      c.cnpj?.includes(term) ||
      c.id?.toString().includes(term)
    );
  }, [allClients, clientSearchTerm]);

  useEffect(() => {
    if (profile?.role === 'vendedor' && profile.regional) {
      const reg = profile.regional.toUpperCase();
      const matched = (reg.includes('TIMON') || reg.includes('TIMAO')) ? 'TIMON-MA' : 
                     (reg.includes('THE') || reg.includes('TERESINA')) ? 'THE' :
                     (reg.includes('IMP') || reg.includes('IMPERATRIZ')) ? 'IMP' : null;
      if (matched) {
        setSelectedRegional(matched);
      }
    }
  }, [profile]);

  const handleApplyManualImport = () => {
    if (!selectedImportClient) {
      toast.error('Selecione um cliente para prosseguir com a importação.');
      return;
    }

    const validItems = parsedBulkItems.filter(item => item && item.product);
    if (validItems.length === 0) {
      toast.error('Nenhum produto válido identificado na lista.');
      return;
    }

    const newResult = {
      clientName: selectedImportClient.name,
      cnpj: selectedImportClient.cnpj || '',
      client: selectedImportClient,
      headerInfo: {
        cotacao: `MANUAL-${Date.now().toString().slice(-4)}`,
        fornecedor: 'IMPORTAÇÃO MANUAL EAN',
        status: 'Pendente',
        dataEntrega: new Date().toLocaleDateString('pt-BR'),
      },
      items: parsedBulkItems.map(item => {
        const product = item?.product;
        return {
          ean: item?.code || '',
          quantity: item?.quantity || 1,
          description: product ? product.description : 'Produto não cadastrado',
          found: !!product,
          product: product,
          scannedName: product ? product.description : 'Produto não cadastrado',
          scannedCode: item?.code || '',
          scannedPrice: product ? product.finalPrice : 0,
        };
      })
    };

    const splitResults = splitResultsByManufacturer([newResult]);
    setResults(splitResults);

    // Auto-check all found items across all split results
    const initialChecked = new Set<string>();
    splitResults.forEach((res, cIdx) => {
      res.items.forEach((item, iIdx) => {
        if (item.found) {
          initialChecked.add(`${cIdx}-${iIdx}`);
        }
      });
    });
    setCheckedItems(initialChecked);

    // Reset and close modal
    setShowBulkImport(false);
    setBulkImportText('');
    setSelectedImportClient(null);
    setClientSearchTerm('');
    
    toast.success(`Lista importada para ${selectedImportClient.name}. Verifique os detalhes e clique em "Fazer Pedido" abaixo.`);
  };

  const toggleClientSelection = (clientIdx: number) => {
    const newChecked = new Set(checkedItems);
    const clientItems = results[clientIdx].items;
    const allChecked = clientItems.every((item: any, iIdx: number) => !item.found || newChecked.has(`${clientIdx}-${iIdx}`));

    clientItems.forEach((item: any, iIdx: number) => {
      const key = `${clientIdx}-${iIdx}`;
      if (allChecked) {
        newChecked.delete(key);
      } else if (item.found) {
        newChecked.add(key);
      }
    });
    setCheckedItems(newChecked);
  };

  const handleMakeSingleOrder = async (clientIdx: number) => {
    if (isProcessing) return;
    const res = results[clientIdx];
    const client = res.client;
    if (!client) {
      toast.error('Cliente não vinculado ao sistema. Vincule-o primeiro para fazer o pedido.');
      return;
    }

    const selectedItems = res.items.filter((_: any, itemIdx: number) => 
      checkedItems.has(`${clientIdx}-${itemIdx}`) && _.found && _.product
    );

    if (selectedItems.length === 0) {
      toast.error('Nenhum item válido selecionado para este cliente');
      return;
    }

    try {
      setIsProcessing(true);
      const cartKey = `cart_${client.id}`;
      const saved = localStorage.getItem(cartKey);
      let cartItems: any[] = [];
      try {
        cartItems = saved ? JSON.parse(saved) : [];
      } catch (e) {
        cartItems = [];
      }

      selectedItems.forEach((item: any) => {
        const existing = cartItems.find(i => i.id === item.product.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          cartItems.push({ ...item.product, quantity: item.quantity, ean: item.ean });
        }
      });

      localStorage.setItem(cartKey, JSON.stringify(cartItems));
      
      try {
        if (profile) {
          await dataService.saveCart(profile.uid, client.id, cartItems);
        }
      } catch (fsErr) {
        console.warn('Silent fallback for Firestore saveCart failure:', fsErr);
      }

      toast.success(`${selectedItems.length} itens adicionados ao carrinho de ${client.name}`);
      
      // Uncheck items for this client after adding to cart
      const newChecked = new Set(checkedItems);
      res.items.forEach((_: any, iIdx: number) => newChecked.delete(`${clientIdx}-${iIdx}`));
      setCheckedItems(newChecked);
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Erro ao adicionar ao carrinho');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedClient = useMemo(() => {
    try {
      const saved = localStorage.getItem('selectedClient');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    dataService.setRegional(selectedRegional);
    
    Promise.all([
      dataService.getAllProducts(),
      dataService.getClients(undefined, true)
    ]).then(([products, clients]) => {
      setAllProducts(products);
      setAllClients(clients);
      setLoading(false);
      setResults(prev => enhanceResultsWithSuggestions(prev, products));
    }).catch(err => {
      console.error('Error fetching data for regional:', err);
      setLoading(false);
    });
  }, [selectedRegional]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setResults([]);
    setCheckedItems(new Set());
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      setCheckedItems(new Set());
      
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            
             // Basic validation and mapping
             const mapped = rows.map((row: any) => {
               const rawEan = String(row.EAN || row.ean || row.Barras || row.barras || row['Barras'] || row['BARRAS'] || row['Código Barras'] || row['Codigo Barras'] || row['Código de Barras'] || row['CODIGO EAN'] || row.CODIGO || row['EAN13'] || '');
               const ean = normalizeEAN(rawEan);
               const quantity = parseInt(row.Quantidade || row.qtd || row.qty || row['Qtd'] || row['QTD'] || row['QUANT'] || row['QUANTIDADE'] || 1);
               
               // Try to find product in catalog using normalized EAN comparison
               const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
               
               return {
                 ean,
                 quantity: isNaN(quantity) ? 1 : quantity,
                 description: product?.description || row.Descrição || row.desc || row['Produto'] || row['PRODUTO'] || 'Produto não encontrado',
                 found: !!product,
                 product: product
               };
             }).filter(r => r.ean);

            const splitResults = splitResultsByManufacturer([{
              clientName: 'Importação Manual',
              cnpj: '',
              items: mapped
            }]);
            setResults(splitResults);

            const initialChecked = new Set<string>();
            splitResults.forEach((res, cIdx) => {
              res.items.forEach((item: any, iIdx: number) => {
                if (item.found) {
                  initialChecked.add(`${cIdx}-${iIdx}`);
                }
              });
            });
            setCheckedItems(initialChecked);

            toast.success(`${mapped.length} itens identificados`);
          } catch (err) {
            console.error('Excel parse error:', err);
            toast.error('Erro ao ler planilha');
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjs.getDocument(typedarray).promise;
            const pageTexts: { pageIndex: number; text: string }[] = [];
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const items = textContent.items as any[];
              
              // Filter out empty items or items missing a valid transform array
              const filteredItems = items.filter(item => 
                item && 
                typeof item.str === 'string' && 
                item.transform && 
                item.transform.length >= 6
              );
              
              // Sort items primarily by Y-coordinate descending (top to bottom),
              // then by X-coordinate ascending (left to right) if on the same line.
              const sortedItems = [...filteredItems].sort((a, b) => {
                const yA = a.transform[5];
                const yB = b.transform[5];
                if (Math.abs(yA - yB) <= 5) {
                  return a.transform[4] - b.transform[4];
                }
                return yB - yA;
              });
              
              // Group items into visual lines using a Y-pixel grouping tolerance of 5 pixels
              const visualLines: string[] = [];
              let currentLineItems: any[] = [];
              let currentY = -9999;
              
              sortedItems.forEach(item => {
                const y = item.transform[5];
                if (currentY === -9999 || Math.abs(y - currentY) <= 5) {
                  if (currentY === -9999) {
                    currentY = y;
                  }
                  currentLineItems.push(item);
                } else {
                  // Ensure correct left-to-right order inside the completed line
                  currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                  visualLines.push(currentLineItems.map(item => item.str).join(' '));
                  
                  // Initialize the new line
                  currentLineItems = [item];
                  currentY = y;
                }
              });
              
              if (currentLineItems.length > 0) {
                currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                visualLines.push(currentLineItems.map(item => item.str).join(' '));
              }
              
              const pageText = visualLines.join('\n');
              pageTexts.push({ pageIndex: i, text: pageText });
            }

            const importResults: any[] = [];
            let currentClientObj: any = null;
            let unmatchedBuffer: string[] = [];
            let hbn1MultiItem: any = null;

            for (const pageObj of pageTexts) {
              const pageText = pageObj.text;
              const pageLines = pageText.split('\n');
              let lastFilialNum = '';
              let pageNumeroPedido = '';
              let pageDtEmissao = '';
              let pageFornecedor = '';

              // Pre-scan page text for order-level headers so they are immediately available
              const numPedMatch = pageText.match(/(?:N[úu]mero\s*(?:do\s*)?Pedido|N[º°\.]*\s*Pedido|Numero\s*Pedido|Pedido\s*N[º°\.]*|Ordem\s*de\s*Compra)\s*[:#]?\s*([0-9A-Za-z\-_]+)/i);
              if (numPedMatch) pageNumeroPedido = numPedMatch[1].trim();

              const dtMatch = pageText.match(/Dt\.\s*Emiss[ãa]o\s*Pedido:\s*([0-9\/]+)/i);
              if (dtMatch) pageDtEmissao = dtMatch[1].trim();

              const dtEntregaMatch = pageText.match(/Dt\.\s*Entrega:\s*([0-9\/]+)/i);
              const pageDtEntrega = dtEntregaMatch ? dtEntregaMatch[1].trim() : '';

              const formaPgtoMatch = pageText.match(/Forma\s*(?:de\s*)?pagamento:\s*([^\s\n]+)/i);
              const pageCondPgto = formaPgtoMatch ? formaPgtoMatch[1].trim() : '';

              const fornMatch = pageText.match(/Fornecedor\s*:\s*(?:\d+\s+)?(.*?)(?=\s*(?:Numero|Dt\.|\n|$))/i);
              if (fornMatch && fornMatch[1].trim()) pageFornecedor = fornMatch[1].trim();

              const isPedidoCompraComercializacao = pageText.toLowerCase().includes("compra mercadoria para comercializacao") || 
                                                   (pageText.toLowerCase().includes("pedido de compra") && pageText.toLowerCase().includes("insc. federal (cnpj)"));
              
              for (let lineIdx = 0; lineIdx < pageLines.length; lineIdx++) {
                const line = pageLines[lineIdx];
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                // Capture document-level / page-level headers if present inline
                const lineNumPedMatch = trimmedLine.match(/(?:N[úu]mero\s*(?:do\s*)?Pedido|N[º°\.]*\s*Pedido|Numero\s*Pedido|Pedido\s*N[º°\.]*|Ordem\s*de\s*Compra)\s*[:#]?\s*([0-9A-Za-z\-_]+)/i);
                if (lineNumPedMatch) {
                  const inlineNum = lineNumPedMatch[1].trim();
                  if (inlineNum) {
                    pageNumeroPedido = inlineNum;
                    if (currentClientObj && !currentClientObj.orderNumber) {
                      currentClientObj.orderNumber = inlineNum;
                      currentClientObj.numeroPedido = inlineNum;
                      if (!currentClientObj.headerInfo.cotacao || currentClientObj.headerInfo.cotacao === 'IMPORTAÇÃO') {
                        currentClientObj.headerInfo.cotacao = `Pedido #${inlineNum}`;
                      }
                    }
                  }
                }

                const lineDtMatch = trimmedLine.match(/Dt\.\s*Emiss[ãa]o\s*Pedido:\s*([0-9\/]+)/i);
                if (lineDtMatch && !pageDtEmissao) pageDtEmissao = lineDtMatch[1].trim();

                const lineFornMatch = trimmedLine.match(/Fornecedor\s*:\s*(?:\d+\s+)?(.*?)(?:Numero|$)/i);
                if (lineFornMatch && lineFornMatch[1].trim() && !pageFornecedor) pageFornecedor = lineFornMatch[1].trim();

                // A.0.0 Sta Vitoria / Nazaria Store block header (e.g. "Loja: 01 - STA VITORIA 01 - CNPJ: 23917429000143")
                const lojaHeaderMatch = trimmedLine.match(/^Loja:\s*(\d+)\s*[-–—]?\s*(.*?)(?:\s*[-–—]?\s*CNPJ:\s*([\d\.\/\-]+))?$/i);
                if (lojaHeaderMatch) {
                  const lojaNum = lojaHeaderMatch[1];
                  let rawStoreName = lojaHeaderMatch[2] ? lojaHeaderMatch[2].replace(/[-–—]\s*CNPJ:.*$/i, '').trim() : '';
                  let storeName = rawStoreName || `STA VITORIA ${lojaNum}`;
                  const rawCnpj = lojaHeaderMatch[3] || '';
                  const cnpj = rawCnpj.replace(/[^\d]/g, '');

                  currentClientObj = {
                    clientName: storeName,
                    cnpj: cnpj,
                    items: [],
                    headerInfo: {
                      fornecedor: 'NAZARIA DISTRIBUIDORA',
                      condPgto: '',
                      status: 'Pendente',
                      dataEntrega: '',
                      cotacao: `Loja ${lojaNum}`
                    }
                  };
                  importResults.push(currentClientObj);
                  unmatchedBuffer = [];

                  const matchedClient = findBestMatchingClient(cnpj, storeName, allClients);
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                    if (!currentClientObj.cnpj && matchedClient.cnpj) {
                      currentClientObj.cnpj = matchedClient.cnpj.replace(/[^\d]/g, '');
                    }
                  }
                  continue;
                }

                // Pre-identify client header for Pedido de Compra / Comercialização format
                if (isPedidoCompraComercializacao && !currentClientObj) {
                  let clientName = 'Cliente Não Identificado';
                  let clientCnpj = '';
                  
                  // Find the index of the "Fornecedor" line to limit buyer search to the top buyer header
                  const fornecedorIdx = pageLines.findIndex(l => {
                    const low = l.toLowerCase().trim();
                    return low === 'fornecedor' || low.includes('fornecedor');
                  });
                  const buyerLines = fornecedorIdx !== -1 ? pageLines.slice(0, fornecedorIdx) : pageLines;
                  const buyerText = buyerLines.join('\n');
                  
                  // Extract CNPJ specifically targeting the "Insc. Federal (CNPJ)" or "Insc. Federal" in buyer section
                  for (let i = 0; i < buyerLines.length; i++) {
                    const l = buyerLines[i].toLowerCase();
                    if (l.includes("insc. federal") || l.includes("insc.federal") || l.includes("cnpj") || l.includes("federal")) {
                      for (let j = 0; j <= 3; j++) {
                        if (i + j < buyerLines.length) {
                          const candidate = buyerLines[i + j];
                          const match = candidate.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
                          if (match) {
                            clientCnpj = match[1].replace(/[^\d]/g, '');
                            break;
                          }
                        }
                      }
                      if (clientCnpj) break;
                    }
                  }
                  
                  // Fallback: extract the first CNPJ pattern in buyer section
                  if (!clientCnpj) {
                    const buyerCnpjs = buyerText.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g) || [];
                    if (buyerCnpjs.length > 0) {
                      clientCnpj = buyerCnpjs[0].replace(/[^\d]/g, '');
                    }
                  }
                  
                  // Extract Client Name from buyer lines
                  for (let i = 0; i < buyerLines.length; i++) {
                    const l = buyerLines[i].trim();
                    if ((l.toLowerCase().includes("nome da empresa (razão social)") || l.toLowerCase() === "razão social") && clientName === 'Cliente Não Identificado') {
                      for (let j = 1; j <= 3; j++) {
                        if (i + j < buyerLines.length) {
                          const nextLine = buyerLines[i + j].trim();
                          if (nextLine && 
                              !nextLine.toLowerCase().includes("nome fantasia") && 
                              !nextLine.toLowerCase().includes("comprador") &&
                              !nextLine.toLowerCase().includes("sugestão") &&
                              !nextLine.toLowerCase().includes("empresa") &&
                              !nextLine.toLowerCase().includes("fornecedor") &&
                              !nextLine.match(/^\d+$/)) {
                            clientName = nextLine;
                            break;
                          }
                        }
                      }
                    }
                    if (l.toLowerCase().includes("nome fantasia") && clientName === 'Cliente Não Identificado') {
                      if (i + 1 < buyerLines.length) {
                        const candidate = buyerLines[i + 1].trim();
                        if (candidate && !candidate.toLowerCase().includes("federal")) {
                          clientName = candidate;
                        }
                      }
                    }
                  }
                  
                  currentClientObj = {
                    clientName: clientName,
                    cnpj: clientCnpj,
                    items: [],
                    headerInfo: {
                      fornecedor: 'NAZARIA DISTRIBUIDORA',
                      condPgto: '',
                      status: 'Pendente',
                      dataEntrega: '',
                      cotacao: 'PEDIDO DE COMPRA'
                    }
                  };
                  importResults.push(currentClientObj);
                  unmatchedBuffer = [];
                  
                  const matchedClient = allClients.find(c => {
                    const dbCnpj = c.cnpj ? c.cnpj.replace(/[^\d]/g, '') : '';
                    if (clientCnpj && dbCnpj === clientCnpj) return true;
                    return c.name.toLowerCase().includes(clientName.toLowerCase()) || clientName.toLowerCase().includes(c.name.toLowerCase());
                  });
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                    // Keep parsed clientCnpj as primary, only use matchedClient.cnpj if clientCnpj is empty
                    if (!currentClientObj.cnpj && matchedClient.cnpj) {
                      currentClientObj.cnpj = matchedClient.cnpj.replace(/[^\d]/g, '');
                    }
                  }
                }

                if (!isPedidoCompraComercializacao) {
                  // 1. Identify client block headers
                // A. Nazaria Filial header & CNPJ / Client Name extraction (handles same-line or separate-line layouts)
                const filialOnlyMatch = trimmedLine.match(/Filial:\s*(\d+)/i);
                const nazariaCnpjMatch = trimmedLine.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{8}\/\d{4}-\d{2}|\d{14})/);

                if (filialOnlyMatch) {
                  lastFilialNum = filialOnlyMatch[1];
                }

                if (nazariaCnpjMatch && (filialOnlyMatch || lastFilialNum || trimmedLine.toLowerCase().includes('filial'))) {
                  const rawCnpj = nazariaCnpjMatch[1];
                  const cnpj = rawCnpj.replace(/[^\d]/g, '');
                  const activeFilial = filialOnlyMatch ? filialOnlyMatch[1] : (lastFilialNum || '');

                  const cnpjIdx = trimmedLine.indexOf(rawCnpj);
                  let name = trimmedLine.substring(cnpjIdx + rawCnpj.length).trim();
                  
                  const formaPgtoMatch = trimmedLine.match(/Forma\s*de\s*Pagamento:\s*([^\s\n]+)/i);
                  const condPgto = formaPgtoMatch ? formaPgtoMatch[1].trim() : '';

                  const truncateKeywords = [
                    'Forma de Pagamento', 'Bairro', 'Endereço', 'Endereco', 
                    'Cep', 'Cidade', 'UF', 'Numero Pedido', 'Dt. Emissão', 'Dt. Emissao'
                  ];
                  truncateKeywords.forEach(kw => {
                    const idx = name.toLowerCase().indexOf(kw.toLowerCase());
                    if (idx !== -1) {
                      name = name.substring(0, idx).trim();
                    }
                  });
                  name = name.replace(/[\s\-–—]+$/, '').trim();

                  // Check if this EXACT order already exists in results (e.g. multi-page order of the same order number)
                  const existingClientObj = importResults.find(r => {
                    if (r.cnpj !== cnpj) return false;
                    // If order numbers are present, compare them
                    if (pageNumeroPedido && r.orderNumber) {
                      return r.orderNumber === pageNumeroPedido;
                    }
                    if (pageNumeroPedido && !r.orderNumber) {
                      return false;
                    }
                    if (activeFilial && r.filial && activeFilial !== r.filial) {
                      return false;
                    }
                    return !pageNumeroPedido && !r.orderNumber;
                  });

                  if (existingClientObj) {
                    currentClientObj = existingClientObj;
                    if (condPgto && !currentClientObj.headerInfo.condPgto) {
                      currentClientObj.headerInfo.condPgto = condPgto;
                    }
                    if (pageDtEntrega && !currentClientObj.headerInfo.dataEntrega) {
                      currentClientObj.headerInfo.dataEntrega = pageDtEntrega;
                    }
                  } else {
                    currentClientObj = {
                      orderNumber: pageNumeroPedido,
                      numeroPedido: pageNumeroPedido,
                      clientName: name,
                      cnpj: cnpj,
                      filial: activeFilial,
                      items: [],
                      headerInfo: {
                        fornecedor: pageFornecedor || 'NAZARIA DISTRIBUIDORA',
                        condPgto: condPgto || pageCondPgto || '',
                        status: 'Pendente',
                        dataEntrega: pageDtEntrega || pageDtEmissao || '',
                        cotacao: pageNumeroPedido ? `Pedido #${pageNumeroPedido}` : (activeFilial ? `Filial ${activeFilial}` : 'IMPORTAÇÃO')
                      }
                    };
                    importResults.push(currentClientObj);

                    // Try to find the exact client in allClients database
                    const matchedClient = findBestMatchingClient(cnpj, name, allClients);
                    if (matchedClient) {
                      currentClientObj.client = matchedClient;
                      currentClientObj.clientName = matchedClient.name;
                    }
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // B. A7 Pharma Código header
                const codigoMatch = trimmedLine.match(/Cód(?:igo)?:\s*([\d\.]+)/i);
                
                // C. A7 Pharma Unidade header
                const unidadeMatch = trimmedLine.toLowerCase().includes('tot. unidade') ? null : trimmedLine.match(/Unidade:\s*(.*?)(?=\s*CNPJ:|$)/i);
                
                // Standalone CNPJ match (for A7 Pharma or other orders where CNPJ is on its own line)
                const standaloneCnpjMatch = trimmedLine.match(/CNPJ:?\s*([\d\.\/\-]+)/i);
                if (standaloneCnpjMatch && currentClientObj && !currentClientObj.cnpj) {
                  const cnpjClean = standaloneCnpjMatch[1].replace(/[^\d]/g, '');
                  if (cnpjClean.length >= 11) {
                    currentClientObj.cnpj = cnpjClean;
                    const matchedClient = findBestMatchingClient(cnpjClean, currentClientObj.clientName, allClients);
                    if (matchedClient) {
                      currentClientObj.client = matchedClient;
                      currentClientObj.clientName = matchedClient.name;
                    }
                  }
                }

                // D. INOVAFARMA header
                const inovafarmaMatch = trimmedLine.match(/Razão\s+Social:\s*([^\n]+)/i);

                if (codigoMatch) {
                  const orderCode = codigoMatch[1];
                  currentClientObj = {
                    clientName: 'Cliente Não Identificado',
                    cnpj: '',
                    items: [],
                    headerInfo: {
                      fornecedor: '',
                      condPgto: '',
                      status: 'Pendente',
                      dataEntrega: '',
                      cotacao: `Pedido #${orderCode}`
                    }
                  };
                  importResults.push(currentClientObj);
                  unmatchedBuffer = [];
                  continue;
                }

                if (unidadeMatch) {
                  const nameRaw = unidadeMatch[1].trim();
                  const cnpjMatch = trimmedLine.match(/CNPJ:\s*([\d\.\/\-]+)/i);
                  const cnpj = cnpjMatch ? cnpjMatch[1].trim().replace(/[^\d]/g, '') : '';
                  
                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: nameRaw,
                      cnpj: cnpj,
                      items: [],
                      headerInfo: { fornecedor: '', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  } else {
                    currentClientObj.clientName = nameRaw;
                    if (cnpj) currentClientObj.cnpj = cnpj;
                  }

                  unmatchedBuffer = [];

                  // Try to find the exact client in allClients database
                  const matchedClient = findBestMatchingClient(cnpj, nameRaw, allClients);
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                    if (!currentClientObj.cnpj && matchedClient.cnpj) {
                      currentClientObj.cnpj = matchedClient.cnpj.replace(/[^\d]/g, '');
                    }
                  }
                  continue;
                }

                if (inovafarmaMatch) {
                  let name = inovafarmaMatch[1].trim();
                  const truncateKeywords = [
                    'CNPJ', 'Nome Fantasia', 'Nome', 'Endereço', 'Endereco', 'IE:', 'Telefone'
                  ];
                  truncateKeywords.forEach(kw => {
                    const idx = name.toLowerCase().indexOf(kw.toLowerCase());
                    if (idx !== -1) {
                      name = name.substring(0, idx).trim();
                    }
                  });
                  name = name.replace(/[\s\-–—]+$/, '').trim();

                  let cnpj = '';
                  const cnpjMatch = trimmedLine.match(/CNPJ:\s*([\d\.\/\-]+)/i);
                  if (cnpjMatch) {
                    cnpj = cnpjMatch[1].trim().replace(/[^\d]/g, '');
                  }

                  currentClientObj = {
                    clientName: name,
                    cnpj: cnpj,
                    items: [],
                    headerInfo: {
                      fornecedor: 'INOVAFARMA',
                      condPgto: '',
                      status: 'Pendente',
                      dataEntrega: '',
                      cotacao: 'INOVAFARMA'
                    }
                  };
                  importResults.push(currentClientObj);
                  unmatchedBuffer = [];

                  const matchedClient = findBestMatchingClient(cnpj, name, allClients);
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                  }
                  continue;
                }

                // E. VENDAS HBN1 client header identification
                const hbn1ClienteMatch = trimmedLine.match(/^Cliente:?\s+([^\n]+)/i);
                if (hbn1ClienteMatch) {
                  const nameRaw = hbn1ClienteMatch[1].trim();
                  currentClientObj = {
                    clientName: nameRaw,
                    cnpj: '',
                    items: [],
                    headerInfo: {
                      fornecedor: 'VENDAS HBN1',
                      condPgto: '',
                      status: 'Pendente',
                      dataEntrega: '',
                      cotacao: 'VENDAS HBN1'
                    }
                  };
                  importResults.push(currentClientObj);
                  unmatchedBuffer = [];

                  // Try to find client by name
                  const matchedClient = findBestMatchingClient('', nameRaw, allClients);
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                    if (matchedClient.cnpj) {
                      currentClientObj.cnpj = matchedClient.cnpj.replace(/[^\d]/g, '');
                    }
                  }
                  continue;
                }

                const hbn1CnpjMatch = trimmedLine.match(/^CNPJ:?\s+([\d\.\/\-]+)/i);
                if (hbn1CnpjMatch && currentClientObj && currentClientObj.headerInfo?.fornecedor === 'VENDAS HBN1') {
                  const cnpj = hbn1CnpjMatch[1].replace(/[^\d]/g, '');
                  currentClientObj.cnpj = cnpj;

                  // Re-evaluate client lookup with CNPJ
                  const matchedClient = findBestMatchingClient(cnpj, currentClientObj.clientName, allClients);
                  if (matchedClient) {
                    currentClientObj.client = matchedClient;
                    currentClientObj.clientName = matchedClient.name;
                  }
                  continue;
                }

                const hbn1PedidoMatch = trimmedLine.match(/N°\s*DO\s*PEDIDO\s+([^\n]+)/i);
                if (hbn1PedidoMatch && currentClientObj && currentClientObj.headerInfo?.fornecedor === 'VENDAS HBN1') {
                  currentClientObj.headerInfo.cotacao = hbn1PedidoMatch[1].trim();
                  continue;
                }
                }

                // If we match minor header fields
                if (currentClientObj) {
                  const fornecedorMatch = trimmedLine.match(/Fornecedor:\s*(.*?)(?:Cond\.|$)/i);
                  if (fornecedorMatch) {
                    currentClientObj.headerInfo.fornecedor = fornecedorMatch[1].trim();
                  }
                  
                  const condPgtoMatch = trimmedLine.match(/Cond\.\s*Pgto\.?:\s*(.*?)(?:Status|$)/i);
                  if (condPgtoMatch) {
                    currentClientObj.headerInfo.condPgto = condPgtoMatch[1].trim();
                  }

                  const statusMatch = trimmedLine.match(/Status:\s*(.*?)(?:Data|$)/i);
                  if (statusMatch) {
                    currentClientObj.headerInfo.status = statusMatch[1].trim();
                  }

                  const dataEntregaMatch = trimmedLine.match(/Data Entrega:\s*([\d/]+\s*[\d:]*)/i);
                  if (dataEntregaMatch) {
                    currentClientObj.headerInfo.dataEntrega = dataEntregaMatch[1].trim();
                  }

                  const cotacaoMatch = trimmedLine.match(/Cotação:\s*(.*?)(?:\n|$)/i);
                  if (cotacaoMatch && cotacaoMatch[1].trim()) {
                    currentClientObj.headerInfo.cotacao = cotacaoMatch[1].trim();
                  }

                  // If any of these headers were found on the line, we don't treat it as description or product
                  if (fornecedorMatch || condPgtoMatch || statusMatch || dataEntregaMatch || cotacaoMatch) {
                    continue;
                  }
                }

                // 2. Check for product patterns
                // TOP PRIORITY 1: Relatório de Pedido de Compras Pattern (Nazaria / Drogaria Ferreira / Alpha7)
                // e.g. "7896007542864 ABS INTERNO INTIMUS M KIMBERLY-CLA UN 1 X 1 4"
                // e.g. "7896007550890 ABS INTIMUS GEL NOTURNO SUAVE C/A KIMBERLY-CLA UN 1 X 1 3"
                // e.g. "7896018700710 SH HUGGIES 200ML J R UN 1 X 1 4"
                // e.g. "7891025120025 7891025120025 APTAMIL ACTIVE 800G DANONE UN 1 X 1 3 121,19"
                const relatorioComprasRegex = /^\s*(\d{8,14})(?:\s+\d{8,14})?\s+(.*?)\s+(UN|CX|FR|AMP|FL|POTE|KG|G|ML|UNID|PCT|CXA|VD)\s+(\d+\s*[xX]\s*\d+)\s+(\d+[\d\.,]*)(?:\s+([\d\.,]+))?(?:\s+.*)?$/i;
                const relatorioMatch = trimmedLine.match(relatorioComprasRegex);
                if (relatorioMatch) {
                  const ean = normalizeEAN(relatorioMatch[1]);
                  const rawDesc = relatorioMatch[2].trim();
                  const unit = relatorioMatch[3];
                  const packing = relatorioMatch[4]; // e.g. "1 X 1"
                  const quantity = parseInt(relatorioMatch[5].replace(/\./g, '')); // Exact Qtd column!
                  const priceVal = relatorioMatch[6] ? parseFlexibleNumber(relatorioMatch[6]) : 0;

                  // Separate description and manufacturer if manufacturer is trailing
                  let desc = rawDesc;
                  let manufacturer = '';
                  const knownMfrs = ['KIMBERLY-CLA', 'KIMBERLY-CLARK', 'KIMBERLY', 'J R', 'DANONE', 'UNILEVER', 'JOHNSON', 'P&G', 'HYPERA', 'EMS', 'ACHE', 'MEDLEY', 'EUROFARMA', 'NEO QUIMICA', 'SANOFI', 'KENVUE', 'BIOLAB', 'CIMED', 'GEOLAB'];
                  for (const km of knownMfrs) {
                    if (rawDesc.toUpperCase().endsWith(' ' + km)) {
                      manufacturer = km;
                      desc = rawDesc.substring(0, rawDesc.length - km.length - 1).trim();
                      break;
                    }
                  }
                  if (!manufacturer) {
                    const parts = rawDesc.split(/\s+/);
                    if (parts.length > 1) {
                      manufacturer = parts.pop() || '';
                      desc = parts.join(' ');
                    }
                  }

                  if (!currentClientObj) {
                    const pageTopText = pageLines.slice(0, 15).join(' ');
                    const topCnpjMatch = pageTopText.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{8}\/\d{4}-\d{2}|\d{14})/);
                    const topCnpj = topCnpjMatch ? topCnpjMatch[1].replace(/[^\d]/g, '') : '';
                    
                    const matchedClient = allClients.find(c => {
                      const dbCnpj = c.cnpj ? c.cnpj.replace(/[^\d]/g, '') : '';
                      return topCnpj && dbCnpj === topCnpj;
                    });

                    currentClientObj = {
                      clientName: matchedClient?.name || 'Cliente Não Identificado',
                      cnpj: topCnpj,
                      client: matchedClient || null,
                      items: [],
                      headerInfo: { fornecedor: pageFornecedor || 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: pageDtEmissao || '', cotacao: pageNumeroPedido ? `Pedido #${pageNumeroPedido}` : 'RELATÓRIO PEDIDO' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                  const finalEan = product?.ean || ean;
                  const finalDesc = product?.description || desc;
                  const inferredMfr = product?.manufacturer || manufacturer || inferManufacturer(desc) || 'OUTROS';

                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean: finalEan,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: finalDesc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // Check for Tot. Itens / Tot. Unidade summary line
                const totSummaryMatch = trimmedLine.match(/Tot\.\s*Itens:\s*(\d+)\s+Tot\.\s*Unidade:\s*(\d+)/i);
                if (totSummaryMatch && currentClientObj) {
                  currentClientObj.expectedTotItens = parseInt(totSummaryMatch[1]);
                  currentClientObj.expectedTotUnidade = parseInt(totSummaryMatch[2]);
                  unmatchedBuffer = [];
                  continue;
                }

                // TOP PRIORITY 2: Pedido de Compra / Espelho do Pedido with Discount% & Quantity (A7 Pharma / Nazaria)
                // e.g. "LEITE DANONE APTAMIL PREMIUM 1 0-6M 800G 7891025111825 DANONE 55,76 0,00 % 50 2.788,24"
                const espelhoPedidoWithDiscountRegex = /^(.*?)\s+(\d{8,14})\s+([A-Za-z0-9\.\-\/]+?)\s+([\d\.,]+)\s+([\d\.,]+\s*%?)\s+(\d+)\s+([\d\.,]+)$/i;
                const espelhoDiscountMatch = trimmedLine.match(espelhoPedidoWithDiscountRegex);
                if (espelhoDiscountMatch) {
                  const desc = espelhoDiscountMatch[1].trim();
                  const ean = normalizeEAN(espelhoDiscountMatch[2]);
                  const manufacturer = espelhoDiscountMatch[3].trim();
                  const priceVal = parseFlexibleNumber(espelhoDiscountMatch[4]);
                  const quantity = parseInt(espelhoDiscountMatch[6]); // Exact Qtd column!

                  if (!currentClientObj) {
                    const pageTopText = pageLines.slice(0, 15).join(' ');
                    const topCnpjMatch = pageTopText.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
                    const topCnpj = topCnpjMatch ? topCnpjMatch[1].replace(/[^\d]/g, '') : '';
                    
                    const matchedClient = allClients.find(c => {
                      const dbCnpj = c.cnpj ? c.cnpj.replace(/[^\d]/g, '') : '';
                      return topCnpj && dbCnpj === topCnpj;
                    });

                    currentClientObj = {
                      clientName: matchedClient?.name || 'Cliente Não Identificado',
                      cnpj: topCnpj,
                      client: matchedClient || null,
                      items: [],
                      headerInfo: { fornecedor: 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: 'PEDIDO DE COMPRA' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                  const finalEan = product?.ean || ean;
                  const finalDesc = product?.description || desc;
                  const inferredMfr = product?.manufacturer || manufacturer || inferManufacturer(desc) || 'OUTROS';

                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean: finalEan,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: finalDesc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // A.0.0 Sta Vitoria / Nazaria Pedido de Compra product pattern
                // e.g. "080229 7891150095595 COND DOVE BOND INT REP 250ML UN 2,00 24,47 48,94"
                // e.g. "024612 7791293025537 DES REXONA AEROSOL ANTIBACTERIAL MEN 90G UN UNIDADE com 1 6,00 11,80 70,80"
                // e.g. "078960 0000075076825 DES REXONA CLINICAL MEN CLEAN 58G 96H VD 6,00 23,14 138,81"
                const staVitoriaProdRegex = /^(?:(\d{5,7})\s+)?(\d{8,14})\s+(.*?)\s+([A-Z]{2,3})(?:\s+(UNIDADE\s+com\s+\d+|[A-Za-z0-9\s\/]{1,20}))?\s+(\d+[\d\.,]*)\s+(\d+[\d\.,]*,\d{2}|\d+)\s+(\d+[\d\.,]*,\d{2})$/i;
                const staVitoriaMatch = trimmedLine.match(staVitoriaProdRegex);
                if (staVitoriaMatch) {
                  const code = staVitoriaMatch[1] || '';
                  const rawEan = staVitoriaMatch[2];
                  const ean = normalizeEAN(rawEan);
                  const desc = staVitoriaMatch[3].trim();
                  const unit = staVitoriaMatch[4];
                  const qtyStr = staVitoriaMatch[6];
                  const priceStr = staVitoriaMatch[7];

                  const quantity = parseFlexibleNumber(qtyStr);
                  const priceVal = parseFlexibleNumber(priceStr);

                  if (!currentClientObj) {
                    const pageTopText = pageLines.slice(0, 10).join(' ');
                    const topCnpjMatch = pageTopText.match(/CNPJ:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
                    const topCnpj = topCnpjMatch ? topCnpjMatch[1].replace(/[^\d]/g, '') : '';
                    
                    const matchedClient = allClients.find(c => {
                      const dbCnpj = c.cnpj ? c.cnpj.replace(/[^\d]/g, '') : '';
                      return topCnpj && dbCnpj === topCnpj;
                    });

                    currentClientObj = {
                      clientName: matchedClient?.name || 'Cliente Não Identificado',
                      cnpj: topCnpj,
                      client: matchedClient || null,
                      items: [],
                      headerInfo: { fornecedor: 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: 'PEDIDO DE COMPRA' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(p => 
                    normalizeEAN(p.ean) === ean || 
                    (code && p.id && String(p.id).trim() === String(code).trim())
                  );
                  const finalEan = product?.ean || ean;
                  const inferredMfr = product?.manufacturer || inferManufacturer(desc) || 'OUTROS';

                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean || (code && item.code === code))) {
                    currentClientObj.items.push({
                      code,
                      ean: finalEan,
                      quantity: isNaN(quantity) ? 1 : Math.round(quantity),
                      description: product?.description || desc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // A.0 Pedido de Compra / Comercialização product pattern
                if (isPedidoCompraComercializacao) {
                  const regexPedidoCompraEAN = /^(\d+)\s+(\d{8,14})\s+(.*?)\s+(\d+[\d\.,]*,\d{2})\s+([A-Z]{2})\s+(\d+)\s+(\d+[\d\.,]*,\d{2})\b/;
                  const matchEan = trimmedLine.match(regexPedidoCompraEAN);
                  
                  if (matchEan) {
                    const ean = normalizeEAN(matchEan[2]);
                    const desc = matchEan[3].trim();
                    const quantity = parseFlexibleNumber(matchEan[4]);
                    const priceVal = parseFlexibleNumber(matchEan[7]);
                    
                    if (!currentClientObj) {
                      currentClientObj = {
                        clientName: 'Cliente Não Identificado',
                        cnpj: '',
                        items: [],
                        headerInfo: { fornecedor: 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: 'PEDIDO DE COMPRA' }
                      };
                      importResults.push(currentClientObj);
                    }
                    
                    const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                    if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                      currentClientObj.items.push({
                        ean,
                        quantity: isNaN(quantity) ? 1 : quantity,
                        description: product?.description || desc,
                        found: !!product,
                        product: product,
                        price: priceVal || product?.finalPrice || 0
                      });
                    }
                    unmatchedBuffer = [];
                    continue;
                  }
                  
                  const regexPedidoCompraNoEAN = /^(\d+)\s+([A-Za-z0-9\s%\-\/\+ªº\(\)\.,#@&]+?)\s+(\d+[\d\.,]*,\d{2})\s+([A-Z]{2})\s+(\d+)\s+(\d+[\d\.,]*,\d{2})\b/;
                  const matchNoEan = trimmedLine.match(regexPedidoCompraNoEAN);
                  
                  if (matchNoEan) {
                    const descRaw = matchNoEan[2].trim();
                    // If description starts with a 13-digit EAN, skip to avoid misclassifying EAN lines
                    if (!descRaw.match(/^\d{13}\b/)) {
                      const desc = descRaw;
                      const quantity = parseFlexibleNumber(matchNoEan[3]);
                      const priceVal = parseFlexibleNumber(matchNoEan[6]);
                      
                      if (!currentClientObj) {
                        currentClientObj = {
                          clientName: 'Cliente Não Identificado',
                          cnpj: '',
                          items: [],
                          headerInfo: { fornecedor: 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: 'PEDIDO DE COMPRA' }
                        };
                        importResults.push(currentClientObj);
                      }
                      
                      const product = allProducts.find(prod => prod.id === matchNoEan[1] || prod.ean === matchNoEan[1] || prod.description?.toLowerCase().includes(desc.toLowerCase()));
                      const finalEan = product?.ean || '';
                      
                      if (!currentClientObj.items.find((item: any) => item.description === desc || (finalEan && normalizeEAN(item.ean) === normalizeEAN(finalEan)))) {
                        currentClientObj.items.push({
                          ean: finalEan,
                          quantity: isNaN(quantity) ? 1 : quantity,
                          description: product?.description || desc,
                          found: !!product,
                          product: product,
                          price: priceVal || product?.finalPrice || 0
                        });
                      }
                      unmatchedBuffer = [];
                      continue;
                    }
                  }
                }

                // A. INOVAFARMA product pattern
                const inovafarmaProdRegex = /^(\d+)\s+(\d{13})\s+(?:(\d{4,8})\s+)?(.*?)\s+([\s\-]?\d+)\s+(\d+)\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})$/;
                const inovafarmaMatchRow = trimmedLine.match(inovafarmaProdRegex);
                if (inovafarmaMatchRow) {
                  const ean = normalizeEAN(inovafarmaMatchRow[2]);
                  const desc = inovafarmaMatchRow[4].trim();
                  const quantity = parseInt(inovafarmaMatchRow[6]);
                  const priceVal = parseFlexibleNumber(inovafarmaMatchRow[7]);
                  
                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: 'INOVAFARMA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: 'INOVAFARMA' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: product?.description || desc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // B. A7 Pharma Pedido de Compra / Drogarias Ultra Popular pattern
                // We match: EAN, Price, Discount%, Qtd, Total
                const regexA7 = /\b(\d{8,14})\b.*?\b(\d+[\d\.,]*)\s+(\d+[\d\.,]*\s*%?)\s+(\d+)\s+(\d+[\d\.,]*)\b/;
                const matchA7 = trimmedLine.match(regexA7);
                if (matchA7) {
                  const ean = normalizeEAN(matchA7[1]);
                  const eanStr = matchA7[1];
                  const eanIndex = trimmedLine.indexOf(eanStr);
                  const priceStr = matchA7[2];
                  const priceIndex = trimmedLine.indexOf(priceStr, eanIndex + eanStr.length);

                  const partBefore = trimmedLine.substring(0, eanIndex).trim();
                  const partBetween = priceIndex > eanIndex ? trimmedLine.substring(eanIndex + eanStr.length, priceIndex).trim() : trimmedLine.substring(eanIndex + eanStr.length).trim();

                  const quantity = parseInt(matchA7[4]);
                  const priceVal = parseFlexibleNumber(matchA7[2]);

                  // Extract description from previous unmatched line(s) and current line parts
                  let desc = partBetween || partBefore;
                  if (unmatchedBuffer.length > 0) {
                    const previousDesc = unmatchedBuffer.join(' ');
                    desc = previousDesc + (desc ? ' ' + desc : '');
                  }
                  desc = desc.trim();

                  // Clean description of trailing or leading junk (like manufacturer code or extra numbers)
                  const cleanKeywords = ['UNILEVER BRASIL', 'UNILEVER', 'LTDA', 'BRASIL', 'INDUSTRIAL', 'DANONE'];
                  cleanKeywords.forEach(kw => {
                    const regexClean = new RegExp('\\b' + kw + '\\b', 'gi');
                    desc = desc.replace(regexClean, '');
                  });
                  desc = desc.replace(/\s+/g, ' ').trim();

                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: 'A7 PHARMA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  const finalEan = product?.ean || ean;
                  const finalDesc = product?.description || desc;
                  const inferredMfr = product?.manufacturer || inferManufacturer(desc) || 'OUTROS';

                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean: finalEan,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: finalDesc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // C. Nazaria product pattern
                const nazariaProdRegex = /(\d{8,14})\s+(.*)\s+(\S+)\s+([A-Z]{2,3})\s+(\d+(?:\s*[xX]\s*\d+)?)\s+(\d+)(?:\s+[\d\.,]+)*/;
                const nazariaMatch = trimmedLine.match(nazariaProdRegex);
                if (nazariaMatch) {
                  const ean = normalizeEAN(nazariaMatch[1]);
                  const desc = nazariaMatch[2].trim();
                  const manufacturer = nazariaMatch[3].trim();
                  const quantity = parseInt(nazariaMatch[6]);

                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: 'NAZARIA DISTRIBUIDORA', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: product?.description || desc,
                      found: !!product,
                      product: product ? { ...product, manufacturer: product.manufacturer || manufacturer } : { manufacturer },
                      price: product?.finalPrice || 0,
                      manufacturer: manufacturer
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // E. VENDAS HBN1 product patterns
                // 1) Single-line match (Code EAN Description originalPrice discount finalPrice quantity subtotal)
                const hbn1SingleMatch = trimmedLine.match(/^(\d+)\s+(\d{8,14})\s+(.*?)\s+R\$\s*([\d\.,]+)\s+([\d\.,]+%|[-–—])\s+R\$\s*([\d\.,]+)\s+(\d+)\s+R\$\s*([\d\.,]+)/i);
                if (hbn1SingleMatch) {
                  const code = hbn1SingleMatch[1];
                  const ean = normalizeEAN(hbn1SingleMatch[2]);
                  const desc = hbn1SingleMatch[3].trim();
                  const quantity = parseInt(hbn1SingleMatch[7]);
                  const priceVal = parseFlexibleNumber(hbn1SingleMatch[6]);

                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: 'VENDAS HBN1', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  const inferredMfr = product?.manufacturer || inferManufacturer(desc) || 'OUTROS';
                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: product?.description || desc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  hbn1MultiItem = null;
                  unmatchedBuffer = [];
                  continue;
                }

                // 2) Multi-line start match (Starts with Code and 8-14 digit EAN, and description prefix but no "R$")
                const hbn1StartMatch = trimmedLine.match(/^(\d+)\s+(\d{8,14})(?:\s+([^\n]+))?$/);
                if (hbn1StartMatch && !trimmedLine.includes('R$')) {
                  const code = hbn1StartMatch[1];
                  const ean = normalizeEAN(hbn1StartMatch[2]);
                  const desc = hbn1StartMatch[3] ? hbn1StartMatch[3].trim() : '';
                  hbn1MultiItem = {
                    code,
                    ean,
                    descParts: desc ? [desc] : []
                  };
                  unmatchedBuffer = [];
                  continue;
                }

                // 3) Multi-line price line match (Matches price information line starting with "R$")
                const hbn1PriceMatch = trimmedLine.match(/R\$\s*([\d\.,]+)\s+([\d\.,]+%|[-–—])\s+R\$\s*([\d\.,]+)\s+(\d+)\s+R\$\s*([\d\.,]+)/i);
                if (hbn1PriceMatch && hbn1MultiItem) {
                  const priceVal = parseFlexibleNumber(hbn1PriceMatch[3]);
                  const quantity = parseInt(hbn1PriceMatch[4]);
                  const desc = hbn1MultiItem.descParts.join(' ').trim();
                  const ean = hbn1MultiItem.ean;

                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: 'VENDAS HBN1', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  const inferredMfr = product?.manufacturer || inferManufacturer(desc) || 'OUTROS';
                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: product?.description || desc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0,
                      manufacturer: inferredMfr
                    });
                  }
                  hbn1MultiItem = null;
                  unmatchedBuffer = [];
                  continue;
                }

                // 4) Multi-line description continuation match
                if (hbn1MultiItem && !trimmedLine.includes('R$') && !trimmedLine.match(/^(\d+)\s+(\d{8,14})/)) {
                  if (
                    !trimmedLine.toLowerCase().includes('subtotal') &&
                    !trimmedLine.toLowerCase().includes('desconto') &&
                    !trimmedLine.toLowerCase().includes('total') &&
                    !trimmedLine.toLowerCase().includes('página') &&
                    !trimmedLine.toLowerCase().includes('emitido em')
                  ) {
                    hbn1MultiItem.descParts.push(trimmedLine);
                    continue;
                  }
                }

                // D. Standard generic product regex
                const productRegexNormal = /(\d{8,14})\s+([^\n]*?)\s+([\d\.]+)\s+([\d\.]+,\d{2})/;
                const normalMatch = trimmedLine.match(productRegexNormal);
                if (normalMatch) {
                  const ean = normalizeEAN(normalMatch[1]);
                  const desc = normalMatch[2].trim();
                  const quantity = parseInt(normalMatch[3].replace(/\./g, ''));
                  const priceVal = parseFlexibleNumber(normalMatch[4]);

                  if (!currentClientObj) {
                    currentClientObj = {
                      clientName: 'Cliente Não Identificado',
                      cnpj: '',
                      items: [],
                      headerInfo: { fornecedor: '', condPgto: '', status: 'Pendente', dataEntrega: '', cotacao: '' }
                    };
                    importResults.push(currentClientObj);
                  }

                  const product = allProducts.find(prod => normalizeEAN(prod.ean) === ean);
                  if (!currentClientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                    currentClientObj.items.push({
                      ean,
                      quantity: isNaN(quantity) ? 1 : quantity,
                      description: product?.description || desc,
                      found: !!product,
                      product: product,
                      price: priceVal || product?.finalPrice || 0
                    });
                  }
                  unmatchedBuffer = [];
                  continue;
                }

                // If the line is a summary or noise line, ignore it and clear unmatched buffer
                if (
                  trimmedLine.toLowerCase().includes('totais') ||
                  trimmedLine.toLowerCase().includes('total') ||
                  trimmedLine.toLowerCase().includes('desconto médio') ||
                  trimmedLine.toLowerCase().includes('página') ||
                  trimmedLine.toLowerCase().includes('alpha7') ||
                  trimmedLine.toLowerCase().includes('a7 pharma') ||
                  trimmedLine.includes('http://') ||
                  trimmedLine.includes('www.') ||
                  trimmedLine.includes('-----') ||
                  trimmedLine.startsWith('Cód. Barras') ||
                  trimmedLine.startsWith('Preço Compra')
                ) {
                  unmatchedBuffer = [];
                  hbn1MultiItem = null;
                  continue;
                }

                // If it is just an unmatched text line, collect it in the buffer as a potential description part
                if (trimmedLine.length > 2) {
                  unmatchedBuffer.push(trimmedLine);
                }
              }
            }

            // Merge identical clients / orders (preserving distinct orders per CNPJ)
            const mergedResults: any[] = [];
            importResults.forEach(res => {
              const resCnpjClean = res.cnpj ? res.cnpj.replace(/[^\d]/g, '') : '';
              const existing = mergedResults.find(m => {
                // If distinct order numbers exist, NEVER merge!
                if (res.orderNumber && m.orderNumber && res.orderNumber !== m.orderNumber) {
                  return false;
                }
                if (res.numeroPedido && m.numeroPedido && res.numeroPedido !== m.numeroPedido) {
                  return false;
                }
                if (res.headerInfo?.cotacao && m.headerInfo?.cotacao && res.headerInfo.cotacao !== m.headerInfo.cotacao) {
                  return false;
                }
                // If one has an order number and the other doesn't, do NOT merge
                if (Boolean(res.orderNumber || res.numeroPedido) !== Boolean(m.orderNumber || m.numeroPedido)) {
                  return false;
                }
                // If filiais are specified and different, NEVER merge
                if (res.filial && m.filial && res.filial !== m.filial) {
                  return false;
                }

                const mCnpjClean = m.cnpj ? m.cnpj.replace(/[^\d]/g, '') : '';
                // If both have CNPJ:
                if (resCnpjClean && mCnpjClean) {
                  if (res.orderNumber && m.orderNumber) {
                    return resCnpjClean === mCnpjClean && res.orderNumber === m.orderNumber;
                  }
                  if (!res.orderNumber && !m.orderNumber) {
                    return resCnpjClean === mCnpjClean;
                  }
                  return false;
                }

                // If both have matched database client, match if same ID and neither has distinct order number
                if (res.client && m.client && !res.orderNumber && !m.orderNumber) {
                  return res.client.id === m.client.id;
                }
                // Match by name ONLY if name is valid, NOT "Cliente Não Identificado", and NO distinct order numbers
                if (res.clientName && res.clientName !== 'Cliente Não Identificado' && 
                    m.clientName && m.clientName !== 'Cliente Não Identificado' &&
                    !res.orderNumber && !m.orderNumber) {
                  return res.clientName.toLowerCase().trim() === m.clientName.toLowerCase().trim();
                }
                return false;
              });
              
              if (existing) {
                res.items.forEach((item: any) => {
                  const existingItem = existing.items.find((ei: any) => normalizeEAN(ei.ean) === normalizeEAN(item.ean));
                  if (existingItem) {
                    existingItem.quantity += item.quantity;
                  } else {
                    existing.items.push(item);
                  }
                });
              } else {
                mergedResults.push(res);
              }
            });

            // Filter out clients with no items
            const finalResults = mergedResults.filter(r => r.items.length > 0);
            const splitFinalResults = splitResultsByManufacturer(finalResults);

            if (splitFinalResults.length > 0) {
              setResults(splitFinalResults);
              
              // Auto-check all found items across all clients
              const initialChecked = new Set<string>();
              splitFinalResults.forEach((res, cIdx) => {
                res.items.forEach((item: any, iIdx: number) => {
                  if (item.found) initialChecked.add(`${cIdx}-${iIdx}`);
                });
              });
              setCheckedItems(initialChecked);
              
              toast.success(`${splitFinalResults.length} pedidos de indústrias identificados no PDF`);
            } else {
              toast.error('Nenhum item identificado no PDF. Verifique o formato.');
            }
          } catch (err) {
            console.error('PDF parse error:', err);
            toast.error('Erro ao ler PDF');
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Image = e.target?.result as string;
            if (!base64Image) {
              toast.error("Erro ao ler o arquivo de imagem.");
              setLoading(false);
              return;
            }

            toast.loading("Analisando imagem com Inteligência Artificial...", { id: "image-scan" });
            const response = await fetch("/api/gemini/scan-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || "Erro na resposta do servidor.");
            }

            const rawOrders = await response.json();
            if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
              toast.dismiss("image-scan");
              toast.error("Nenhum pedido detectado na imagem.");
              setLoading(false);
              return;
            }

            // Map and validate extracted orders against local catalog and clients
            const finalOrders = rawOrders.map((order: any) => {
              const cleanCnpj = order.cnpj ? order.cnpj.replace(/[^\d]/g, '') : '';
              
              // Find matching client in database
              const matchedClient = findBestMatchingClient(cleanCnpj, order.clientName, allClients);

              const mappedItems = (order.items || []).map((item: any) => {
                const ean = normalizeEAN(String(item.ean || ''));
                const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                const inferredMfr = product?.manufacturer || item.manufacturer || inferManufacturer(item.description || '') || 'OUTROS';
                
                return {
                  ean,
                  quantity: parseInt(item.quantity) || 1,
                  description: product?.description || item.description || 'Produto não encontrado',
                  found: !!product,
                  product: product,
                  price: parseFlexibleNumber(item.price) || product?.finalPrice || 0,
                  manufacturer: inferredMfr
                };
              }).filter((item: any) => item.ean);

              return {
                client: matchedClient || null,
                clientName: matchedClient?.name || order.clientName || 'Cliente Não Identificado',
                cnpj: cleanCnpj,
                headerInfo: {
                  fornecedor: order.headerInfo?.fornecedor || 'IMPORTAÇÃO IMAGEM',
                  condPgto: order.headerInfo?.condPgto || '',
                  status: order.headerInfo?.status || 'Pendente',
                  dataEntrega: order.headerInfo?.dataEntrega || new Date().toLocaleDateString('pt-BR'),
                  cotacao: order.headerInfo?.cotacao || 'SCAN'
                },
                items: mappedItems
              };
            }).filter((order: any) => order.items.length > 0);

            const splitFinalResults = splitResultsByManufacturer(finalOrders);

            if (splitFinalResults.length > 0) {
              setResults(splitFinalResults);
              
              // Auto-check all found items across all clients
              const initialChecked = new Set<string>();
              splitFinalResults.forEach((res, cIdx) => {
                res.items.forEach((item: any, iIdx: number) => {
                  if (item.found) initialChecked.add(`${cIdx}-${iIdx}`);
                });
              });
              setCheckedItems(initialChecked);
              
              toast.success(`${splitFinalResults.length} pedidos identificados na imagem!`, { id: "image-scan" });
            } else {
              toast.error('Nenhum item válido identificado na imagem.', { id: "image-scan" });
            }
          } catch (err: any) {
            console.error('Image scan error:', err);
            toast.error(`Erro ao analisar imagem: ${err.message || err}`, { id: "image-scan" });
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Formato não suportado. Use Excel, CSV, PDF ou Imagem (PNG/JPG).');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar arquivo');
      setLoading(false);
    } finally {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleMakeAllOrders = async () => {
    if (isProcessing) return;
    let totalAdded = 0;
    let clientsWithOrders = 0;
    const processedClients: string[] = [];

    try {
      setIsProcessing(true);
      toast.loading('Processando pedidos...', { id: 'make-all' });
      
      for (const [clientIdx, res] of results.entries()) {
        const client = res.client;
        if (!client) continue;

        const selectedItems = res.items.filter((_: any, itemIdx: number) => 
          checkedItems.has(`${clientIdx}-${itemIdx}`) && _.found && _.product
        );

        if (selectedItems.length > 0) {
          const cartKey = `cart_${client.id}`;
          const saved = localStorage.getItem(cartKey);
          let cartItems: any[] = [];
          try {
            cartItems = saved ? JSON.parse(saved) : [];
          } catch (e) {
            cartItems = [];
          }

          selectedItems.forEach((item: any) => {
            const existing = cartItems.find(i => i.id === item.product.id);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              cartItems.push({ ...item.product, quantity: item.quantity });
            }
          });

          localStorage.setItem(cartKey, JSON.stringify(cartItems));
          
          try {
            if (profile) {
              await dataService.saveCart(profile.uid, client.id, cartItems);
            }
          } catch (fsErr) {
            console.warn(`Silent fallback for Firestore saveCart failure (client ${client.id}):`, fsErr);
          }

          totalAdded += selectedItems.length;
          clientsWithOrders++;
          processedClients.push(client.name);
        }
      }

      if (totalAdded > 0) {
        toast.success(`${totalAdded} itens adicionados aos carrinhos de ${clientsWithOrders} clientes`, { id: 'make-all' });
        
        // Auto-select the first client that got an order so Catalog doesnt redirect to home
        if (processedClients.length > 0) {
          const firstClientName = processedClients[0];
          const firstClient = results.find(r => r.client?.name === firstClientName)?.client;
          if (firstClient) {
            localStorage.setItem('selectedClient', JSON.stringify(firstClient));
          }
        }
        
        navigate('/catalog');
      } else {
        toast.error('Nenhum item válido selecionado ou clientes não vinculados ao sistema', { id: 'make-all' });
      }
    } catch (err) {
      console.error('Error processing all orders:', err);
      toast.error('Erro ao processar pedidos', { id: 'make-all' });
    } finally {
      setIsProcessing(false);
    }
  };

  const isItemMatchingExportFilter = (
    item: any,
    exportFilter: 'all' | 'noStock' | 'notFound' | 'unavailable' = 'all'
  ) => {
    if (exportFilter === 'all') return true;

    const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
    const hasStock = item.product
      ? item.product.stock > 0
      : (item.status !== 'Sem estoque' && item.hasStock !== false);

    if (exportFilter === 'noStock') {
      return isFound && !hasStock;
    }
    if (exportFilter === 'notFound') {
      return !isFound;
    }
    if (exportFilter === 'unavailable') {
      return !isFound || !hasStock;
    }
    return true;
  };

  const exportIndividualOrderToPDF = async (
    clientIdx: number,
    exportFilter: 'all' | 'noStock' | 'notFound' | 'unavailable' = 'all'
  ) => {
    const res = results[clientIdx];
    if (!res) return;

    const selectedItems = res.items.filter((item: any, itemIdx: number) => 
      checkedItems.has(`${clientIdx}-${itemIdx}`) && isItemMatchingExportFilter(item, exportFilter)
    );

    if (selectedItems.length === 0) {
      if (exportFilter === 'noStock') toast.error('Nenhum item sem estoque encontrado neste pedido');
      else if (exportFilter === 'notFound') toast.error('Nenhum item não encontrado neste pedido');
      else if (exportFilter === 'unavailable') toast.error('Nenhum item indisponível neste pedido');
      else toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const thumbnails = await preloadProductThumbnails(selectedItems, allProducts);

    const doc = new jsPDF();
    
    const rawCode = res.headerInfo?.cotacao || res.client?.id || '';
    const digitsOnly = rawCode.replace(/\D/g, '');
    const clientCode = digitsOnly.length >= 5 ? digitsOnly : '1785350359114';

    const subtitleText = exportFilter === 'noStock'
      ? 'RELATÓRIO DE ITENS SEM ESTOQUE'
      : exportFilter === 'notFound'
      ? 'RELATÓRIO DE ITENS NÃO ENCONTRADOS'
      : exportFilter === 'unavailable'
      ? 'RELATÓRIO DE ITENS INDISPONÍVEIS'
      : 'COMPROVANTE DE PEDIDO';

    drawPDFHeader(doc, {
      subtitle: subtitleText,
      orderNumber: `PED${clientCode}`,
      dateTimeStr: new Date().toLocaleString('pt-BR'),
      regionStr: getRegionalLabel(selectedRegional as RegionalKey) || 'TERESINA - PI',
      phoneStr: profile?.phone || '(86) 99964-7573',
      sellerStr: profile?.name || 'LEONEL'
    });

    const cleanName = res.clientName?.split('Fornecedor:')[0]?.trim() || res.clientName || 'N/A';
    const cleanTradeName = res.client?.tradeName || cleanName;
    const cleanLegalName = res.client?.name || cleanName;

    const clientRawCnpj = res.client?.cnpj || res.cnpj;
    const formattedCnpj = clientRawCnpj ? formatCNPJ(clientRawCnpj) : 'N/A';
    const displayAddress = res.client?.address ? res.client.address.toUpperCase() : 'N/A';
    const displayCityState = res.client?.city ? `${res.client.city} / ${res.client.state || 'PI'}`.toUpperCase() : 'N/A';

    const clientFields = [
      { icon: 'user', label: 'Cliente', value: cleanTradeName.toUpperCase() },
      { icon: 'user', label: 'Vendedor', value: (profile?.name || 'LEONEL AMORIM').toUpperCase() },
      { icon: 'id', label: 'ID Cliente', value: res.client?.id || 'N/A' },
      { icon: 'email', label: 'E-mail', value: (res.client?.email || profile?.email || 'N/A').toUpperCase() },
      { icon: 'user', label: 'Nome', value: cleanLegalName.toUpperCase() },
      { icon: 'mapPin', label: 'Endereço', value: displayAddress },
      { icon: 'building', label: 'CNPJ', value: formattedCnpj },
      { icon: 'mapPin', label: 'Cidade/Estado', value: displayCityState },
      { icon: 'phone', label: 'Celular', value: res.client?.phone || '-' }
    ];

    let currentY = drawClientDataCard(doc, 42, clientFields);

    const groupedItems = selectedItems.reduce((acc: any, item: any) => {
      const manufacturer = item.manufacturer || item.product?.manufacturer || 'OUTROS';
      if (!acc[manufacturer]) acc[manufacturer] = [];
      acc[manufacturer].push(item);
      return acc;
    }, {});

    Object.entries(groupedItems).forEach(([mName, mItems]: [string, any]) => {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      const tableData = mItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal > 0 ? `${discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-';
        const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
        const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
        const rowSubtotal = Math.round(finalPrice * (item.quantity || 1) * 100) / 100;
        const statusLabel = !isFound ? 'Não encontrado' : (hasStock ? '✔ OK' : 'Sem estoque');

        return [
          '',
          item.product?.id || item.code || 'N/A',
          item.ean || 'N/A',
          (item.description || 'SEM DESCRIÇÃO').toUpperCase(),
          formatCurrency(salePrice),
          discountStr,
          formatCurrency(finalPrice),
          item.quantity || 1,
          formatCurrency(rowSubtotal),
          statusLabel
        ];
      });

      let indSubtotal = 0;
      let indNoStock = 0;
      let indDiscount = 0;

      mItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const qty = item.quantity || 1;
        const itemSaleSubtotal = salePrice * qty;

        indSubtotal += itemSaleSubtotal;

        const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
        const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
        if (!isFound || !hasStock) {
          indNoStock += itemSaleSubtotal;
        } else {
          indDiscount += Math.max(0, (salePrice - finalPrice) * qty);
        }
      });

      indSubtotal = Math.round(indSubtotal * 100) / 100;
      indNoStock = Math.round(indNoStock * 100) / 100;
      indDiscount = Math.round(indDiscount * 100) / 100;
      const indTotal = Math.max(0, Math.round((indSubtotal - indNoStock - indDiscount) * 100) / 100);

      autoTable(doc, {
        startY: currentY,
        head: [
          [{ content: `INDÚSTRIA: ${mName.toUpperCase()}`, colSpan: 10, styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: { top: 3, bottom: 3 } } }],
          ['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'DESC %', 'PR. FINAL', 'QT', 'SUBTOTAL', 'STATUS']
        ],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [255, 107, 0],
          textColor: [255, 255, 255], 
          fontSize: 7.5, 
          fontStyle: 'bold', 
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 }
        },
        bodyStyles: { fontSize: 7, halign: 'center', valign: 'middle', textColor: [15, 23, 42], minCellHeight: 12 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.2,
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 14 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'left', cellWidth: 'auto' },
          4: { halign: 'right', textColor: [100, 116, 139], cellWidth: 16 },
          5: { halign: 'center', fontStyle: 'bold', textColor: [22, 163, 74], cellWidth: 15 },
          6: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 16 },
          7: { halign: 'center', cellWidth: 10 },
          8: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 18 },
          9: { halign: 'center', cellWidth: 18 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 9) {
            const rawVal = String(data.cell.raw || '');
            if (rawVal.toLowerCase().includes('não encontrado')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (rawVal.toLowerCase().includes('sem estoque')) {
              data.cell.styles.textColor = [234, 88, 12];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const item = mItems[data.row.index];
            if (item) {
              const keyCandidates = [
                item.product?.id ? String(item.product.id).trim() : '',
                item.id ? String(item.id).trim() : '',
                item.product?.ean ? String(item.product.ean).trim() : '',
                item.ean ? String(item.ean).trim() : '',
                item.code ? String(item.code).trim() : '',
                item.description ? String(item.description).trim() : '',
                item.product?.description ? String(item.product.description).trim() : '',
                String(item.product?.id || item.id || item.ean || item.code || item.description || '')
              ];
              let imgData: string | null = null;
              for (const k of keyCandidates) {
                if (k && thumbnails[k]) {
                  imgData = thumbnails[k];
                  break;
                }
              }

              if (imgData) {
                try {
                  doc.setFillColor(255, 255, 255);
                  doc.setDrawColor(226, 232, 240);
                  doc.roundedRect(data.cell.x + 1.5, data.cell.y + 1, 11, 10, 0.5, 0.5, 'FD');
                  const imgFormat = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                  doc.addImage(imgData, imgFormat, data.cell.x + 2, data.cell.y + 1.5, 10, 9, undefined, 'FAST');
                } catch (e) {
                  // ignore
                }
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 3;
      currentY = drawBottomSummaryCards(
        doc,
        currentY,
        {
          subtotal: indSubtotal,
          discount: indDiscount,
          noStock: indNoStock,
          finalTotal: indTotal
        },
        {
          title: `Resumo - INDÚSTRIA: ${mName.toUpperCase()}`,
          totalLabel: `TOTAL INDÚSTRIA (${mName.toUpperCase()})`
        }
      );
      currentY += 4;
    });

    let calculatedPrecoSubtotal = 0;
    let calculatedNoStock = 0;
    let calculatedDiscount = 0;

    selectedItems.forEach((item: any) => {
      const salePrice = item.product?.salePrice || item.price || 0;
      const finalPrice = item.product?.finalPrice || item.price || 0;
      const qty = item.quantity || 1;
      const itemSaleSubtotal = salePrice * qty;

      calculatedPrecoSubtotal += itemSaleSubtotal;

      const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
      const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
      if (!isFound || !hasStock) {
        calculatedNoStock += itemSaleSubtotal;
      } else {
        calculatedDiscount += Math.max(0, (salePrice - finalPrice) * qty);
      }
    });

    const subtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
    const noStock = Math.round(calculatedNoStock * 100) / 100;
    const discount = Math.round(calculatedDiscount * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - noStock - discount) * 100) / 100);

    currentY = drawBottomSummaryCards(doc, currentY, {
      subtotal: subtotal,
      noStock: noStock,
      discount: discount,
      finalTotal: total
    });

    drawPDFFooterStrip(doc, profile, getRegionalLabel(selectedRegional as RegionalKey));

    const rName = res.client?.name || res.clientName || 'CLIENTE';
    const cleanRName = rName.split('Fornecedor:')[0]?.trim() || rName;
    const cleanRNameCleaned = cleanRName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    const rawCnpj = res.cnpj || res.client?.cnpj || '';
    const cleanCnpjStr = rawCnpj.replace(/\D/g, '');

    const orderDate = new Date();
    const dayStr = String(orderDate.getDate()).padStart(2, '0');
    const monthStr = String(orderDate.getMonth() + 1).padStart(2, '0');
    const yearStr = String(orderDate.getFullYear());
    const hourStr = String(orderDate.getHours()).padStart(2, '0');
    const minStr = String(orderDate.getMinutes()).padStart(2, '0');

    const dateAndTimeStr = `${dayStr}${monthStr}${yearStr}${hourStr}${minStr}`;
    const suffix = exportFilter === 'noStock'
      ? '_Sem_Estoque'
      : exportFilter === 'notFound'
      ? '_Nao_Encontrados'
      : exportFilter === 'unavailable'
      ? '_Indisponiveis'
      : '';

    const formattedFilename = `${cleanRNameCleaned}_${cleanCnpjStr}_${dateAndTimeStr}${suffix}.pdf`;

    doc.save(formattedFilename);
    toast.success('PDF exportado com sucesso');
  };

  const exportIndividualOrderToExcel = async (
    clientIdx: number,
    exportFilter: 'all' | 'noStock' | 'notFound' | 'unavailable' = 'all'
  ) => {
    try {
      const res = results[clientIdx];
      if (!res) return;

      const selectedItems = res.items.filter((item: any, itemIdx: number) => 
        checkedItems.has(`${clientIdx}-${itemIdx}`) && isItemMatchingExportFilter(item, exportFilter)
      );

      if (selectedItems.length === 0) {
        if (exportFilter === 'noStock') toast.error('Nenhum item sem estoque encontrado neste pedido');
        else if (exportFilter === 'notFound') toast.error('Nenhum item não encontrado neste pedido');
        else if (exportFilter === 'unavailable') toast.error('Nenhum item indisponível neste pedido');
        else toast.error('Nenhum item selecionado para exportar');
        return;
      }

      const thumbnails = await preloadProductThumbnails(selectedItems, allProducts);

      const rawName = res.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = res.client?.tradeName || cleanName;
      const displayLegalName = res.client?.name || cleanName;

      let calculatedPrecoSubtotal = 0;
      let calculatedNoStock = 0;
      let calculatedDiscount = 0;

      selectedItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const qty = item.quantity || 1;
        const itemSaleSubtotal = salePrice * qty;

        calculatedPrecoSubtotal += itemSaleSubtotal;
        
        const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
        const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
        if (!isFound || !hasStock) {
          calculatedNoStock += itemSaleSubtotal;
        } else {
          calculatedDiscount += Math.max(0, (salePrice - finalPrice) * qty);
        }
      });

      const orderSubtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
      const orderNoStock = Math.round(calculatedNoStock * 100) / 100;
      const orderDiscount = Math.round(calculatedDiscount * 100) / 100;
      const orderTotal = Math.max(0, Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100);

      const workbook = new ExcelJS.Workbook();
      const sheetName = (cleanName).replace(/[\[\]\*\?:\/\\]/g, '').substring(0, 31);
      const worksheet = workbook.addWorksheet(sheetName || 'Pedido');

      const navyColor = 'FF0F172A';
      const orangeColor = 'FFFF6B00';
      const whiteColor = 'FFFFFFFF';
      const grayTextColor = 'FF64748B';

      worksheet.mergeCells('A1:J2');
      const headerCell = worksheet.getCell('A1');

      const headerText = exportFilter === 'noStock'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS SEM ESTOQUE'
        : exportFilter === 'notFound'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS NÃO ENCONTRADOS'
        : exportFilter === 'unavailable'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS INDISPONÍVEIS'
        : 'VENDAS HBN1 — COMPROVANTE DE PEDIDO (IMPORTAÇÃO)';

      headerCell.value = headerText;
      headerCell.font = { size: 16, bold: true, color: { argb: whiteColor } };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.addRow([`${getRegionalLabel(selectedRegional as RegionalKey)} • Tel: ${profile?.phone || '(86) 99964-7573'} • ${profile?.email || 'leonelamorimm@gmail.com'}`]);
      worksheet.mergeCells('A3:J3');
      worksheet.getCell('A3').font = { size: 9, color: { argb: grayTextColor } };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      worksheet.addRow([`${new Date().toLocaleString('pt-BR')} • ${selectedItems.length} item(ns)`]);
      worksheet.mergeCells('A4:J4');
      worksheet.getCell('A4').font = { size: 9, bold: true, color: { argb: orangeColor } };
      worksheet.getCell('A4').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      const clientHeaderRow = worksheet.addRow(['DADOS DO CLIENTE E VENDEDOR']);
      worksheet.mergeCells(`A6:J6`);
      clientHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      clientHeaderRow.getCell(1).font = { bold: true, size: 10, color: { argb: whiteColor } };
      clientHeaderRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const clientRawCnpj = res.client?.cnpj || res.cnpj;
      const formattedCnpj = clientRawCnpj ? formatCNPJ(clientRawCnpj) : 'N/A';
      const displayCityState = res.client?.city ? `${res.client.city} / ${res.client.state || 'PI'}`.toUpperCase() : 'N/A';

      const clientRows = [
        ['Nome Fantasia', displayTradeName.toUpperCase()],
        ['ID Cliente', res.client?.id || 'N/A'],
        ['Razão Social', displayLegalName.toUpperCase()],
        ['CNPJ', formattedCnpj],
        ['Endereço', (res.client?.address || 'N/A').toUpperCase()],
        ['Cidade / Estado', displayCityState],
        ['Vendedor', (profile?.name || 'LEONEL AMORIM').toUpperCase()],
        ['E-mail / Tel', `${profile?.email || 'N/A'} • ${profile?.phone || 'N/A'}`]
      ];

      clientRows.forEach(r => {
        const row = worksheet.addRow([r[0], r[1]]);
        row.getCell(1).font = { bold: true, size: 8.5, color: { argb: 'FF475569' } };
        row.getCell(2).font = { size: 8.5, color: { argb: 'FF0F172A' } };
      });

      worksheet.addRow([]);

      const tableHeaderRow = worksheet.addRow(['FOTO', 'CÓDIGO', 'EAN', 'DESCRIÇÃO', 'PREÇO TAB.', 'DESC %', 'PREÇO LIQ.', 'QTD', 'SUBTOTAL', 'STATUS']);
      tableHeaderRow.font = { bold: true, color: { argb: whiteColor }, size: 9 };
      tableHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
      tableHeaderRow.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
      });

      selectedItems.forEach(item => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const qty = item.quantity || 1;
        const rowSubtotal = Math.round(finalPrice * qty * 100) / 100;

        const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
        const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
        const statusLabel = !isFound ? 'NÃO ENCONTRADO' : (hasStock ? 'EM ESTOQUE' : 'SEM ESTOQUE');

        const row = worksheet.addRow([
          '',
          item.product?.id || item.code || 'N/A',
          item.ean || 'N/A',
          (item.description || 'SEM DESCRIÇÃO').toUpperCase(),
          salePrice,
          discVal / 100,
          finalPrice,
          qty,
          rowSubtotal,
          statusLabel
        ]);

        row.font = { size: 8.5 };
        row.alignment = { vertical: 'middle' };

        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'left' };
        row.getCell(5).numFmt = 'R$ #,##0.00';
        row.getCell(6).numFmt = '0.0%';
        row.getCell(7).numFmt = 'R$ #,##0.00';
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).numFmt = 'R$ #,##0.00';
        row.getCell(10).alignment = { horizontal: 'center' };

        const statusCell = row.getCell(10);
        if (statusLabel === 'EM ESTOQUE') {
          statusCell.font = { bold: true, color: { argb: 'FF16A34A' } };
        } else if (statusLabel === 'SEM ESTOQUE') {
          statusCell.font = { bold: true, color: { argb: 'FFEAB308' } };
        } else {
          statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
        }
      });

      worksheet.addRow([]);

      const summaryRow = worksheet.addRow(['SUBTOTAL', formatCurrency(orderSubtotal)]);
      summaryRow.font = { bold: true, size: 9 };
      const noStockRow = worksheet.addRow(['SEM ESTOQUE / INDISP.', formatCurrency(orderNoStock)]);
      noStockRow.font = { bold: true, color: { argb: 'FFDC2626' }, size: 9 };
      const discRow = worksheet.addRow(['DESCONTO TOTAL', formatCurrency(orderDiscount)]);
      discRow.font = { bold: true, color: { argb: 'FF16A34A' }, size: 9 };
      const totalRow = worksheet.addRow(['TOTAL LÍQUIDO', formatCurrency(orderTotal)]);
      totalRow.font = { bold: true, size: 11, color: { argb: orangeColor } };

      worksheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 10;
        else if (i === 3) col.width = 40;
        else col.width = 16;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const cleanFileName = cleanName.replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = exportFilter === 'noStock'
        ? '_Sem_Estoque'
        : exportFilter === 'notFound'
        ? '_Nao_Encontrados'
        : exportFilter === 'unavailable'
        ? '_Indisponiveis'
        : '';

      a.download = `Pedido_${cleanFileName}${suffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Excel exportado com sucesso');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  const exportAllOrdersToPDF = async (
    exportFilter: 'all' | 'noStock' | 'notFound' | 'unavailable' = 'all'
  ) => {
    const doc = new jsPDF();

    const ordersToExport = results.map((res, cIdx) => {
      const items = res.items.filter((item: any, iIdx: number) => 
        checkedItems.has(`${cIdx}-${iIdx}`) && isItemMatchingExportFilter(item, exportFilter)
      );
      return { ...res, originalIndex: cIdx, filteredItems: items };
    }).filter(res => res.filteredItems.length > 0);

    if (ordersToExport.length === 0) {
      if (exportFilter === 'noStock') toast.error('Nenhum item sem estoque para exportar');
      else if (exportFilter === 'notFound') toast.error('Nenhum item não encontrado para exportar');
      else if (exportFilter === 'unavailable') toast.error('Nenhum item indisponível para exportar');
      else toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const allSelectedItems: any[] = [];
    ordersToExport.forEach(res => {
      res.filteredItems.forEach((item: any) => {
        allSelectedItems.push(item);
      });
    });

    const thumbnails = await preloadProductThumbnails(allSelectedItems, allProducts);

    const subtitleText = exportFilter === 'noStock'
      ? 'RELATÓRIO DE ITENS SEM ESTOQUE'
      : exportFilter === 'notFound'
      ? 'RELATÓRIO DE ITENS NÃO ENCONTRADOS'
      : exportFilter === 'unavailable'
      ? 'RELATÓRIO DE ITENS INDISPONÍVEIS'
      : 'COMPROVANTE DE PEDIDO';

    ordersToExport.forEach((res, idx) => {
      if (idx > 0) doc.addPage();
      
      const rawCode = res.headerInfo?.cotacao || res.client?.id || '';
      const digitsOnly = rawCode.replace(/\D/g, '');
      const clientCode = digitsOnly.length >= 5 ? digitsOnly : `17853503591${14 + idx}`;
      drawPDFHeader(doc, {
        subtitle: subtitleText,
        orderNumber: `PED${clientCode}`,
        dateTimeStr: new Date().toLocaleString('pt-BR'),
        regionStr: getRegionalLabel(selectedRegional as RegionalKey) || 'TERESINA - PI',
        phoneStr: profile?.phone || '(86) 99964-7573',
        sellerStr: profile?.name || 'LEONEL'
      });

      const rawName = res.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = res.client?.tradeName || cleanName;
      const displayLegalName = res.client?.name || cleanName;

      const clientRawCnpj = res.client?.cnpj || res.cnpj;
      const formattedCnpj = clientRawCnpj ? formatCNPJ(clientRawCnpj) : 'N/A';
      const displayAddress = res.client?.address ? res.client.address.toUpperCase() : 'N/A';
      const displayCityState = res.client?.city ? `${res.client.city} / ${res.client.state || 'PI'}`.toUpperCase() : 'N/A';

      const clientFields = [
        { icon: 'user', label: 'Cliente', value: displayTradeName.toUpperCase() },
        { icon: 'user', label: 'Vendedor', value: (profile?.name || 'LEONEL AMORIM').toUpperCase() },
        { icon: 'id', label: 'ID Cliente', value: res.client?.id || 'N/A' },
        { icon: 'email', label: 'E-mail', value: (res.client?.email || profile?.email || 'N/A').toUpperCase() },
        { icon: 'user', label: 'Nome', value: displayLegalName.toUpperCase() },
        { icon: 'mapPin', label: 'Endereço', value: displayAddress },
        { icon: 'building', label: 'CNPJ', value: formattedCnpj },
        { icon: 'mapPin', label: 'Cidade/Estado', value: displayCityState },
        { icon: 'phone', label: 'Celular', value: res.client?.phone || '-' }
      ];

      let nextY = drawClientDataCard(doc, 42, clientFields);
      const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';

      const selectedItems = res.filteredItems;
      let orderPrecoSubtotalAcc = 0;
      let orderNoStockAcc = 0;
      let orderDiscountAcc = 0;

      const tableData = selectedItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal > 0 ? `${discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-';
        const qty = item.quantity || 1;
        const itemSaleSubtotal = salePrice * qty;

        const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
        const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);

        orderPrecoSubtotalAcc += itemSaleSubtotal;
        if (!isFound || !hasStock) {
          orderNoStockAcc += itemSaleSubtotal;
        } else {
          orderDiscountAcc += Math.max(0, (salePrice - finalPrice) * qty);
        }

        const rowSubtotal = Math.round(finalPrice * qty * 100) / 100;
        const statusLabel = !isFound ? 'Não encontrado' : (hasStock ? '✔ OK' : 'Sem estoque');

        return [
          '',
          item.product?.id || item.code || 'N/A',
          item.ean || 'N/A',
          (item.description || 'SEM DESCRIÇÃO').toUpperCase(),
          formatCurrency(salePrice),
          discountStr,
          formatCurrency(finalPrice),
          item.quantity || 1,
          formatCurrency(rowSubtotal),
          statusLabel
        ];
      });

      const orderSubtotal = Math.round(orderPrecoSubtotalAcc * 100) / 100;
      const orderNoStock = Math.round(orderNoStockAcc * 100) / 100;
      const orderDiscount = Math.round(orderDiscountAcc * 100) / 100;
      const orderTotal = Math.max(0, Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100);

      autoTable(doc, {
        startY: nextY,
        head: [
          [{ content: `INDÚSTRIA: ${manufacturer.toUpperCase()}`, colSpan: 10, styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: { top: 3, bottom: 3 } } }],
          ['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'DESC %', 'PR. FINAL', 'QT', 'SUBTOTAL', 'STATUS']
        ],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [255, 107, 0],
          textColor: [255, 255, 255], 
          fontSize: 7.5, 
          fontStyle: 'bold', 
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 }
        },
        bodyStyles: { fontSize: 7, halign: 'center', valign: 'middle', textColor: [15, 23, 42], minCellHeight: 12 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.2,
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 14 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'left', cellWidth: 'auto' },
          4: { halign: 'right', textColor: [100, 116, 139], cellWidth: 16 },
          5: { halign: 'center', fontStyle: 'bold', textColor: [22, 163, 74], cellWidth: 15 },
          6: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 16 },
          7: { halign: 'center', cellWidth: 10 },
          8: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 18 },
          9: { halign: 'center', cellWidth: 18 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 9) {
            const rawVal = String(data.cell.raw || '');
            if (rawVal.toLowerCase().includes('não encontrado')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (rawVal.toLowerCase().includes('sem estoque')) {
              data.cell.styles.textColor = [234, 88, 12];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const item = selectedItems[data.row.index];
            if (item) {
              const keyCandidates = [
                item.product?.id ? String(item.product.id).trim() : '',
                item.id ? String(item.id).trim() : '',
                item.product?.ean ? String(item.product.ean).trim() : '',
                item.ean ? String(item.ean).trim() : '',
                item.code ? String(item.code).trim() : '',
                item.description ? String(item.description).trim() : '',
                item.product?.description ? String(item.product.description).trim() : '',
                String(item.product?.id || item.id || item.ean || item.code || item.description || '')
              ];
              let imgData: string | null = null;
              for (const k of keyCandidates) {
                if (k && thumbnails[k]) {
                  imgData = thumbnails[k];
                  break;
                }
              }

              if (imgData) {
                try {
                  doc.setFillColor(255, 255, 255);
                  doc.setDrawColor(226, 232, 240);
                  doc.roundedRect(data.cell.x + 1.5, data.cell.y + 1, 11, 10, 0.5, 0.5, 'FD');
                  const imgFormat = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                  doc.addImage(imgData, imgFormat, data.cell.x + 2, data.cell.y + 1.5, 10, 9, undefined, 'FAST');
                } catch (e) {
                  // ignore
                }
              }
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      nextY = (doc as any).lastAutoTable.finalY + 3;
      nextY = drawBottomSummaryCards(
        doc,
        nextY,
        {
          subtotal: orderSubtotal,
          discount: orderDiscount,
          noStock: orderNoStock,
          finalTotal: orderTotal
        },
        {
          title: `Resumo - INDÚSTRIA: ${manufacturer.toUpperCase()}`,
          totalLabel: `TOTAL INDÚSTRIA (${manufacturer.toUpperCase()})`
        }
      );
      nextY += 4;
    });

    drawPDFFooterStrip(doc, profile, getRegionalLabel(selectedRegional as RegionalKey));

    const fileName = exportFilter === 'noStock'
      ? 'Relatorio_Itens_Sem_Estoque.pdf'
      : exportFilter === 'notFound'
      ? 'Relatorio_Itens_Nao_Encontrados.pdf'
      : exportFilter === 'unavailable'
      ? 'Relatorio_Itens_Indisponiveis.pdf'
      : 'Relatorio_Importacao_Compilado.pdf';

    doc.save(fileName);
    toast.success('PDF exportado com sucesso');
  };

  const exportAllOrdersToExcel = async (
    exportFilter: 'all' | 'noStock' | 'notFound' | 'unavailable' = 'all'
  ) => {
    try {
      const ordersToExport = results.map((res, cIdx) => {
        const items = res.items.filter((item: any, iIdx: number) => 
          checkedItems.has(`${cIdx}-${iIdx}`) && isItemMatchingExportFilter(item, exportFilter)
        );
        return { ...res, originalIndex: cIdx, filteredItems: items };
      }).filter(res => res.filteredItems.length > 0);

      if (ordersToExport.length === 0) {
        if (exportFilter === 'noStock') toast.error('Nenhum item sem estoque para exportar');
        else if (exportFilter === 'notFound') toast.error('Nenhum item não encontrado para exportar');
        else if (exportFilter === 'unavailable') toast.error('Nenhum item indisponível para exportar');
        else toast.error('Nenhum item selecionado para exportar');
        return;
      }

      const allSelectedItems: any[] = [];
      ordersToExport.forEach(res => {
        res.filteredItems.forEach((item: any) => {
          allSelectedItems.push(item);
        });
      });

      const thumbnails = await preloadProductThumbnails(allSelectedItems, allProducts);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Relatório Consolidado');

      const navyColor = 'FF0F172A';
      const orangeColor = 'FFFF6B00';
      const whiteColor = 'FFFFFFFF';
      const lightSlateBg = 'FFF8FAFC';

      worksheet.mergeCells('A1:J2');
      const headerCell = worksheet.getCell('A1');

      const headerTitle = exportFilter === 'noStock'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS SEM ESTOQUE'
        : exportFilter === 'notFound'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS NÃO ENCONTRADOS'
        : exportFilter === 'unavailable'
        ? 'VENDAS HBN1 — RELATÓRIO DE ITENS INDISPONÍVEIS'
        : 'VENDAS HBN1 — RELATÓRIO DE IMPORTAÇÃO DE PEDIDOS';

      headerCell.value = headerTitle;
      headerCell.font = { size: 16, bold: true, color: { argb: whiteColor } };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.addRow([`${getRegionalLabel(selectedRegional as RegionalKey)} • Tel: ${profile?.phone || '(86) 99964-7573'} • ${profile?.email || 'leonelamorimm@gmail.com'}`]);
      worksheet.mergeCells('A3:J3');
      worksheet.getCell('A3').font = { size: 9, bold: true, color: { argb: whiteColor } };
      worksheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
      worksheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.addRow([`${new Date().toLocaleString('pt-BR')} • ${ordersToExport.length} pedido(s) • ${allSelectedItems.length} item(ns)`]);
      worksheet.mergeCells('A4:J4');
      worksheet.getCell('A4').font = { size: 9, bold: true, color: { argb: orangeColor } };
      worksheet.getCell('A4').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      ordersToExport.forEach((res) => {
        const selectedItems = res.filteredItems;
        const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
        const rawName = res.clientName || 'N/A';
        const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
        const displayTradeName = res.client?.tradeName || cleanName;
        const displayLegalName = res.client?.name || cleanName;

        const cRow = worksheet.addRow(['DADOS DO CLIENTE E VENDEDOR']);
        worksheet.mergeCells(`A${cRow.number}:J${cRow.number}`);
        cRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
        cRow.getCell(1).font = { bold: true, size: 10, color: { argb: whiteColor } };
        cRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const clientRawCnpj = res.client?.cnpj || res.cnpj;
        const formattedCnpj = clientRawCnpj ? formatCNPJ(clientRawCnpj) : 'N/A';
        const displayCityState = res.client?.city ? `${res.client.city} / ${res.client.state || 'PI'}`.toUpperCase() : 'N/A';

        const clientRows = [
          ['Nome Fantasia', displayTradeName.toUpperCase()],
          ['ID Cliente', res.client?.id || 'N/A'],
          ['Razão Social', displayLegalName.toUpperCase()],
          ['CNPJ', formattedCnpj],
          ['Vendedor', (profile?.name || 'Leonel Amorim').toUpperCase()],
          ['Cidade/Estado', displayCityState]
        ];

        clientRows.forEach(row => {
          const r = worksheet.addRow(row);
          r.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
          r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightSlateBg } };
          worksheet.mergeCells(`B${r.number}:J${r.number}`);
        });

        const mRow = worksheet.addRow([`INDÚSTRIA: ${manufacturer.toUpperCase()}`]);
        worksheet.mergeCells(`A${mRow.number}:J${mRow.number}`);
        mRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
        mRow.getCell(1).font = { bold: true, size: 10, color: { argb: whiteColor } };
        mRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const tableHeader = worksheet.addRow(['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'DESC%', 'PR.FINAL', 'QT', 'SUBTOTAL', 'STATUS']);
        tableHeader.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
          cell.font = { bold: true, color: { argb: whiteColor }, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        let orderPrecoSubtotal = 0;
        let orderNoStock = 0;
        let orderDiscount = 0;

        selectedItems.forEach((item: any) => {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const qty = item.quantity || 1;
          const itemSaleSubtotal = salePrice * qty;

          orderPrecoSubtotal += itemSaleSubtotal;

          const isFound = item.found !== false && item.found !== undefined ? item.found : !!item.product;
          const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
          if (!isFound || !hasStock) {
            orderNoStock += itemSaleSubtotal;
          } else {
            orderDiscount += Math.max(0, (salePrice - finalPrice) * qty);
          }

          const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
          const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
          const rowSubtotal = Math.round((finalPrice * qty) * 100) / 100;
          const statusLabel = !isFound ? 'NÃO ENCONTRADO' : (hasStock ? 'OK' : 'Sem estoque');

          const rowData = [
            '',
            item.product?.id || item.code || 'N/A',
            item.ean || '-',
            (item.description || 'SEM DESCRIÇÃO').toUpperCase(),
            salePrice,
            `${discountStr}%`,
            finalPrice,
            item.quantity || 1,
            rowSubtotal,
            statusLabel
          ];

          const row = worksheet.addRow(rowData);
          row.height = 36;

          row.eachCell((cell, colNumber) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (colNumber === 4) cell.alignment = { horizontal: 'left', vertical: 'middle' };
            if (colNumber === 6) cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            if (colNumber === 5 || colNumber === 7 || colNumber === 9) {
              cell.numFmt = '"R$ "#,##0.00';
              if (colNumber === 7) cell.font = { color: { argb: 'FF0F172A' }, bold: true };
              if (colNumber === 9) cell.font = { color: { argb: orangeColor }, bold: true };
            }
            if (colNumber === 10) {
              const strVal = String(cell.value || '');
              if (strVal.includes('NÃO ENCONTRADO')) {
                cell.font = { color: { argb: 'FFDC2626' }, bold: true };
              } else if (strVal.includes('Sem estoque')) {
                cell.font = { color: { argb: 'FFEAB308' }, bold: true };
              } else {
                cell.font = { color: { argb: 'FF16A34A' }, bold: true };
              }
            }
          });

          const key = String(item.product?.id || item.ean || item.code || item.description || '');
          const imgData = thumbnails[key];
          if (imgData) {
            try {
              const imageId = workbook.addImage({
                base64: imgData,
                extension: 'jpeg',
              });
              worksheet.addImage(imageId, {
                tl: { col: 0.1, row: row.number - 1 + 0.1 },
                br: { col: 0.9, row: row.number - 0.1 },
                editAs: 'oneCell',
              } as any);
            } catch (e) {
              console.error('Error adding image to Excel row:', e);
            }
          }
        });

        const orderSubtotal = Math.round(orderPrecoSubtotal * 100) / 100;
        const roundedOrderNoStock = Math.round(orderNoStock * 100) / 100;
        const roundedOrderDiscount = Math.round(orderDiscount * 100) / 100;
        const orderTotal = Math.max(0, Math.round((orderSubtotal - roundedOrderNoStock - roundedOrderDiscount) * 100) / 100);

        const colStart = 4;
        const colVal = 9;
        const colEnd = 10;

        const indHeaderRow = worksheet.addRow([]);
        const indStartRowNum = indHeaderRow.number;
        indHeaderRow.getCell(colStart).value = `RESUMO - INDÚSTRIA: ${manufacturer.toUpperCase()}`;
        worksheet.mergeCells(indStartRowNum, colStart, indStartRowNum, colEnd);
        indHeaderRow.height = 22;

        const ihCell = indHeaderRow.getCell(colStart);
        ihCell.font = { name: 'Calibri', bold: true, color: { argb: 'FF0F172A' }, size: 9.5 };
        ihCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        ihCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        for (let c = colStart; c <= colEnd; c++) {
          indHeaderRow.getCell(c).border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: c === colStart ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            right: c === colEnd ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            bottom: { style: 'medium', color: { argb: orangeColor } }
          };
        }

        const subRow = worksheet.addRow([]);
        const subRowNum = subRow.number;
        subRow.getCell(colStart).value = 'SUBTOTAL (TABELA):';
        subRow.getCell(colVal).value = orderSubtotal;
        worksheet.mergeCells(subRowNum, colStart, subRowNum, colVal - 1);
        worksheet.mergeCells(subRowNum, colVal, subRowNum, colEnd);
        subRow.height = 19;
        subRow.getCell(colStart).font = { name: 'Calibri', bold: true, color: { argb: 'FF64748B' }, size: 9 };
        subRow.getCell(colStart).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        subRow.getCell(colVal).font = { name: 'Calibri', bold: true, color: { argb: 'FF0F172A' }, size: 9 };
        subRow.getCell(colVal).alignment = { horizontal: 'right', vertical: 'middle' };
        subRow.getCell(colVal).numFmt = '"R$ "#,##0.00';

        for (let c = colStart; c <= colEnd; c++) {
          const cell = subRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          cell.border = {
            left: c === colStart ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            right: c === colEnd ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
          };
        }

        if (roundedOrderNoStock > 0) {
          const nsRow = worksheet.addRow([]);
          const nsRowNum = nsRow.number;
          nsRow.getCell(colStart).value = 'SEM ESTOQUE / INDISP.:';
          nsRow.getCell(colVal).value = -roundedOrderNoStock;
          worksheet.mergeCells(nsRowNum, colStart, nsRowNum, colVal - 1);
          worksheet.mergeCells(nsRowNum, colVal, nsRowNum, colEnd);
          nsRow.height = 19;
          nsRow.getCell(colStart).font = { name: 'Calibri', bold: true, color: { argb: 'FFDC2626' }, size: 9 };
          nsRow.getCell(colStart).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          nsRow.getCell(colVal).font = { name: 'Calibri', bold: true, color: { argb: 'FFDC2626' }, size: 9 };
          nsRow.getCell(colVal).alignment = { horizontal: 'right', vertical: 'middle' };
          nsRow.getCell(colVal).numFmt = '- "R$ "#,##0.00';

          for (let c = colStart; c <= colEnd; c++) {
            const cell = nsRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
              left: c === colStart ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
              right: c === colEnd ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
              bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
            };
          }
        }

        if (roundedOrderDiscount > 0) {
          const discRow = worksheet.addRow([]);
          const discRowNum = discRow.number;
          discRow.getCell(colStart).value = 'DESCONTO TOTAL:';
          discRow.getCell(colVal).value = -roundedOrderDiscount;
          worksheet.mergeCells(discRowNum, colStart, discRowNum, colVal - 1);
          worksheet.mergeCells(discRowNum, colVal, discRowNum, colEnd);
          discRow.height = 19;
          discRow.getCell(colStart).font = { name: 'Calibri', bold: true, color: { argb: 'FF16A34A' }, size: 9 };
          discRow.getCell(colStart).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          discRow.getCell(colVal).font = { name: 'Calibri', bold: true, color: { argb: 'FF16A34A' }, size: 9 };
          discRow.getCell(colVal).alignment = { horizontal: 'right', vertical: 'middle' };
          discRow.getCell(colVal).numFmt = '- "R$ "#,##0.00';

          for (let c = colStart; c <= colEnd; c++) {
            const cell = discRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
              left: c === colStart ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
              right: c === colEnd ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
              bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
            };
          }
        }

        const totRow = worksheet.addRow([]);
        const totRowNum = totRow.number;
        totRow.getCell(colStart).value = `TOTAL INDÚSTRIA (${manufacturer.toUpperCase()})`;
        totRow.getCell(colVal).value = orderTotal;
        worksheet.mergeCells(totRowNum, colStart, totRowNum, colVal - 1);
        worksheet.mergeCells(totRowNum, colVal, totRowNum, colEnd);
        totRow.height = 24;

        const tLabelCell = totRow.getCell(colStart);
        tLabelCell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        tLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        const tValCell = totRow.getCell(colVal);
        tValCell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        tValCell.alignment = { horizontal: 'right', vertical: 'middle' };
        tValCell.numFmt = '"R$ "#,##0.00';

        for (let c = colStart; c <= colEnd; c++) {
          const cell = totRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: orangeColor } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: c === colStart ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined,
            right: c === colEnd ? { style: 'thin', color: { argb: 'FFE2E8F0' } } : undefined
          };
        }

        worksheet.addRow([]);
      });

      worksheet.columns = [
        { width: 10 }, { width: 12 }, { width: 18 }, { width: 45 }, { width: 15 }, { width: 14 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);

      const fileName = exportFilter === 'noStock'
        ? 'Relatorio_Itens_Sem_Estoque.xlsx'
        : exportFilter === 'notFound'
        ? 'Relatorio_Itens_Nao_Encontrados.xlsx'
        : exportFilter === 'unavailable'
        ? 'Relatorio_Itens_Indisponiveis.xlsx'
        : 'Relatorio_Importacao_Consolidado.xlsx';

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Excel exportado com sucesso');
    } catch (error) {
      console.error('Excel compile export error:', error);
      toast.error('Erro ao exportar Excel');
    }
  };


  const toggleItem = (clientIdx: number, itemIdx: number) => {
    const key = `${clientIdx}-${itemIdx}`;
    const newChecked = new Set(checkedItems);
    if (newChecked.has(key)) newChecked.delete(key);
    else newChecked.add(key);
    setCheckedItems(newChecked);
  };

  const updateItemQuantity = (clientIdx: number, itemIdx: number, newQty: number) => {
    if (newQty < 1) return;
    setResults(prev => prev.map((res, cIdx) => {
      if (cIdx !== clientIdx) return res;
      return {
        ...res,
        items: res.items.map((item: any, iIdx: number) => {
          if (iIdx !== itemIdx) return item;
          return { ...item, quantity: newQty };
        })
      };
    }));
  };

  const financialSummary = useMemo(() => {
    let subtotal = 0;
    let noStock = 0;
    let discount = 0;
    const clientTotals: { name: string; total: number; subtotal: number; noStock: number; discount: number }[] = [];

    results.forEach((res, cIdx) => {
      let clientSubtotal = 0;
      let clientNoStock = 0;
      let clientDiscount = 0;
      res.items.forEach((item: any, iIdx: number) => {
        if (checkedItems.has(`${cIdx}-${iIdx}`)) {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const qty = item.quantity || 1;
          const itemSaleSubtotal = salePrice * qty;

          clientSubtotal += itemSaleSubtotal;

          const hasStock = item.product ? item.product.stock > 0 : (item.status !== 'Sem estoque' && item.hasStock !== false);
          if (!hasStock) {
            clientNoStock += itemSaleSubtotal;
          } else {
            clientDiscount += Math.max(0, (salePrice - finalPrice) * qty);
          }
        }
      });
      subtotal += clientSubtotal;
      noStock += clientNoStock;
      discount += clientDiscount;
      
      if (clientSubtotal > 0) {
        const clientTotal = Math.round((clientSubtotal - clientNoStock - clientDiscount) * 100) / 100;
        clientTotals.push({ 
          name: res.clientName, 
          total: clientTotal,
          subtotal: clientSubtotal,
          noStock: clientNoStock,
          discount: clientDiscount
        });
      }
    });

    const subtotalRounded = Math.round(subtotal * 100) / 100;
    const noStockRounded = Math.round(noStock * 100) / 100;
    const discountRounded = Math.round(discount * 100) / 100;
    const total = Math.round((subtotalRounded - noStockRounded - discountRounded) * 100) / 100;

    return {
      subtotal: subtotalRounded,
      noStock: noStockRounded,
      discount: discountRounded,
      total,
      clientTotals
    };
  }, [results, checkedItems]);

  const globalStats = useMemo(() => {
    let withStock = 0;
    let noStock = 0;
    let notFound = 0;

    results.forEach(res => {
      res.items.forEach((item: any) => {
        if (!item.found) notFound++;
        else if (item.product?.stock > 0) withStock++;
        else noStock++;
      });
    });

    return { withStock, noStock, notFound };
  }, [results]);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [defaultExpiryDate, setDefaultExpiryDate] = useState<string>('');

  const [catalogUpdateResult, setCatalogUpdateResult] = useState<any>(null);

  const handleCatalogUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCatalogFile(file);
    setIsCatalogModalOpen(true);
  };

  const confirmCatalogUpdate = async (industry: string) => {
    if (!catalogFile) return;
    setIsCatalogModalOpen(false);
    setLoading(true);
    
    try {
      // Set the regional before the update call
      dataService.setRegional(selectedRegional);
      
      const reader = new FileReader();
      reader.onerror = (e) => {
        console.error('FileReader error:', e);
        toast.dismiss('catalog-update');
        toast.dismiss('update-catalog-progress');
        toast.error('Erro ao ler arquivo da planilha');
        setLoading(false);
      };

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('A planilha enviada não contém nenhuma aba visível.');
          }

          let targetSheetName = workbook.SheetNames[0];
          
          if (industry === 'DANONE') {
            const danoneSheet = workbook.SheetNames.find(name => {
              const normalized = name.trim().toUpperCase().replace(/\s/g, '');
              return normalized.includes('FAT.MIN.1.000,00') || normalized.includes('1.000') || normalized.includes('DANONE');
            });
            if (danoneSheet) {
              targetSheetName = danoneSheet;
            } else {
              toast.error('Aba "FAT. MIN. 1.000,00" não encontrada. Usando a primeira aba disponível.');
            }
          } else {
            // Find sheet matching industry name or common keywords
            const indUpper = industry.trim().toUpperCase();
            const matchedSheet = workbook.SheetNames.find(name => {
              const norm = name.trim().toUpperCase();
              return norm.includes(indUpper) || norm.includes('PRODUTO') || norm.includes('CATALOGO') || norm.includes('TABELA') || norm.includes('PRECO') || norm.includes('DADOS');
            });
            if (matchedSheet) {
              targetSheetName = matchedSheet;
            } else if (workbook.SheetNames.length > 1) {
              // Pick sheet with highest row count
              let maxCount = -1;
              for (const sName of workbook.SheetNames) {
                const sheetObj = workbook.Sheets[sName];
                if (sheetObj) {
                  const sheetRows = XLSX.utils.sheet_to_json(sheetObj, { header: 1 }) as any[];
                  const vRows = sheetRows.filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
                  if (vRows.length > maxCount) {
                    maxCount = vRows.length;
                    targetSheetName = sName;
                  }
                }
              }
            }
          }
          
          const targetSheet = workbook.Sheets[targetSheetName];
          if (!targetSheet) {
            throw new Error(`Aba "${targetSheetName}" não foi encontrada no arquivo.`);
          }

          const rawRows = XLSX.utils.sheet_to_json(targetSheet, { header: 1 }) as any[][];
          
          // Filter out completely empty rows
          const validRows = rawRows.filter(row => 
            Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
          );

          if (validRows.length === 0) {
            throw new Error('A planilha selecionada está vazia ou sem dados válidos.');
          }

          // Sanitize rows to primitives to avoid serialization issues
          const sanitizedRows = validRows.map(row => 
            row.map(cell => {
              if (cell === null || cell === undefined) return '';
              if (typeof cell === 'object') {
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String((cell as any).v ?? (cell as any).w ?? '');
              }
              return cell;
            })
          );

          toast.loading(`Atualizando catálogo ${industry} para ${getRegionalLabel(selectedRegional)}...`, { id: 'catalog-update' });
          const result = await dataService.updateCatalogInSheets(industry, sanitizedRows, defaultExpiryDate || null);
          
          toast.dismiss('catalog-update');
          toast.dismiss('update-catalog-progress');

          if (result && (result.sucesso || result.success)) {
            setCatalogUpdateResult(result);
            toast.success(`Catálogo ${industry} atualizado com sucesso!`);
            try {
              const updatedProducts = await dataService.getAllProducts();
              setAllProducts(updatedProducts);
            } catch (pErr) {
              console.warn('Error refreshing products state after catalog update:', pErr);
            }
          }
        } catch (err: any) {
          console.error('Catalog parse error:', err);
          toast.dismiss('catalog-update');
          toast.dismiss('update-catalog-progress');
          const errorMsg = err?.message || 'Erro ao processar planilha de catálogo';
          toast.error(errorMsg);
        } finally {
          toast.dismiss('catalog-update');
          toast.dismiss('update-catalog-progress');
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(catalogFile);
    } catch (error: any) {
      console.error('Catalog update error:', error);
      toast.dismiss('catalog-update');
      toast.dismiss('update-catalog-progress');
      toast.error(`Erro ao iniciar leitura: ${error?.message || error}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] font-sans">
      <header className="bg-brand-blue p-4 pt-safe sticky top-0 z-40 shadow-lg border-b border-white/5 flex items-center justify-between">
        <div className="max-w-5xl flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
          {/* Star Logo */}
          <div className="w-8 h-8 bg-brand-orange text-white rounded-lg flex items-center justify-center p-1.5 shadow-md shadow-brand-orange/20 shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
            </svg>
          </div>
          <h1 className="text-white font-display font-bold text-base uppercase tracking-tight">Importar Pedido</h1>
        </div>
        <button 
          onClick={async () => {
            setLoading(true);
            const [products, clients] = await Promise.all([
              dataService.getAllProducts(),
              dataService.getClients(undefined, true)
            ]);
            setAllProducts(products);
            setAllClients(clients);
            setLoading(false);
            toast.success('Dados sincronizados com a planilha!');
          }}
          className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          title="Sincronizar com Planilha"
        >
          <RefreshCw size={20} className={cn(loading && "animate-spin")} />
        </button>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-4 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer flex flex-col items-center gap-4",
              isDragging ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E]",
              loading && "opacity-50 pointer-events-none"
            )}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input 
              type="file" 
              id="fileInput" 
              className="hidden" 
              accept=".pdf,.xlsx,.xls,.csv,image/*"
              onChange={handleFileSelect}
            />
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600">
              {loading ? <RefreshCw size={40} className="animate-spin" /> : <FileUp size={40} />}
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white">Importar Pedido</h3>
              <p className="text-sm text-gray-500 mt-2">
                PDF (A7 Pharma, HBN1), Excel/CSV<br />ou Imagem de Pedido
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full justify-center">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('fileInput')?.click();
                }}
                className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
              >
                Escolher arquivo
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBulkImport(true);
                }}
                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ClipboardList size={14} />
                Digitar EAN/Qtd
              </button>
            </div>
          </div>

          {/* Catalog Update Card */}
          <div 
            className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center flex flex-col items-center gap-4 cursor-pointer"
            onClick={() => document.getElementById('catalogInput')?.click()}
          >
            <input 
              type="file" 
              id="catalogInput" 
              className="hidden" 
              accept=".xlsx,.xls,.csv"
              onChange={handleCatalogUpdate}
            />
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600">
              <RefreshCw size={40} />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white">Atualizar Catálogo</h3>
              <p className="text-sm text-gray-500 mt-2">
                UNILEVER • DANONE • KENVUE<br />KIMBERLY • OMRON
              </p>
            </div>
            <button className="mt-4 bg-gradient-to-r from-[#26A65B] to-[#1B8A4A] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg">
              Escolher planilha
            </button>
          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {catalogUpdateResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg p-8 shadow-2xl space-y-6 overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Catálogo Atualizado</h3>
                  <p className="text-sm text-gray-500 mt-2">Indústria: <span className="font-bold text-orange-600">{catalogUpdateResult.industry}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Atualizados</p>
                    <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{catalogUpdateResult.updatedCount}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Novos</p>
                    <p className="text-2xl font-black text-green-700 dark:text-green-300">{catalogUpdateResult.newCount}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} /> Log de Processamento
                  </p>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-2 font-mono">
                    {catalogUpdateResult.log && catalogUpdateResult.log.map((line: string, i: number) => (
                      <div key={i} className="flex gap-2 leading-relaxed border-b border-gray-100 dark:border-gray-800 pb-1 last:border-0">
                        <span className="text-orange-500 font-bold">•</span> {line}
                      </div>
                    ))}
                    {(!catalogUpdateResult.log || catalogUpdateResult.log.length === 0) && (
                      <p className="italic opacity-50">Nenhum log disponível.</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setCatalogUpdateResult(null)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-bold shadow-lg"
                >
                  Fechar
                </button>
              </motion.div>
            </div>
          )}

          {isCatalogModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                    <RefreshCw size={32} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Atualizar Catálogo</h3>
                  <p className="text-sm text-gray-500 mt-2">Selecione a regional e a indústria:</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Regional Correspondente
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(REGIONALS).filter(reg => reg === 'TIMON-MA').map((reg) => (
                        <button
                          key={reg}
                          onClick={() => setSelectedRegional(reg)}
                          className={cn(
                            "py-2 rounded-xl text-xs font-black transition-all border-2",
                            selectedRegional === reg 
                              ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20" 
                              : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {REGIONALS[reg as RegionalKey].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Validade do Desconto (Opcional)
                    </label>
                    <input 
                      type="date"
                      value={defaultExpiryDate}
                      onChange={(e) => setDefaultExpiryDate(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all text-gray-700 dark:text-gray-200"
                    />
                    <p className="text-[9px] text-gray-400 mt-1 ml-1 leading-tight">
                      * Se preenchido, os descontos aplicados nesta planilha expirarão automaticamente após esta data.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Indústria
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto p-1 pr-2">
                      {['UNILEVER', 'DANONE', 'KENVUE', 'KIMBERLY', 'OMRON', 'OUTROS'].map((ind) => (
                        <button
                          key={ind}
                          onClick={() => confirmCatalogUpdate(ind)}
                          className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-transparent hover:border-green-500 rounded-2xl font-bold text-gray-700 dark:text-gray-200 transition-all text-left flex justify-between items-center group"
                        >
                          {ind}
                          <ChevronRight size={18} className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="w-full py-4 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </motion.div>
            </div>
          )}

          {results.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Global Stats Bar */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-green-600">{globalStats.withStock}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-green-500" />
                    Com estoque
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-orange-500">{globalStats.noStock}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <AlertCircle size={12} className="text-orange-500" />
                    Sem estoque
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-red-500">{globalStats.notFound}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="text-red-500 font-black">✕</span>
                    Não encontrado
                  </div>
                </div>
              </div>

              {/* All Clients List */}
              <div className="space-y-10">
                {results.map((res, clientIdx) => (
                  <div key={clientIdx} className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                    {/* Client Header - Matches Image 1 */}
                    <div className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-6 text-white relative">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none font-display mb-4">Pedido Nº IMP</h2>
                          
                          {res.headerInfo && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[9px] font-black uppercase opacity-90 tracking-tighter leading-tight">
                              {res.headerInfo.fornecedor && <span>INDÚSTRIA: {res.headerInfo.fornecedor}</span>}
                              {res.headerInfo.condPgto && <span>COND. PGTO: {res.headerInfo.condPgto}</span>}
                              {res.headerInfo.status && <span>STATUS: {res.headerInfo.status}</span>}
                              {res.headerInfo.dataEntrega && <span>DATA ENTREGA: {res.headerInfo.dataEntrega}</span>}
                              {res.headerInfo.cotacao && <span>IMPORTAÇÃO: {res.headerInfo.cotacao}</span>}
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-lg border border-white/20">
                              🏪
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold uppercase tracking-tight leading-none truncate mb-1">
                                {res.clientName}
                              </h3>
                              <div className="inline-flex items-center gap-2">
                                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-[8px] text-[10px] font-mono font-bold tracking-widest border border-white/10 uppercase">
                                  {res.cnpj || 'CNPJ NÃO IDENTIFICADO'}
                                </div>
                                {!res.client && (
                                  <div className="bg-white/10 backdrop-blur-md text-[8px] font-black uppercase px-2 py-1 rounded-[8px] border border-white/10">
                                    Não Cadastrado
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative shrink-0 flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-lg">
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => exportIndividualOrderToPDF(clientIdx, selectedExportFilter)}
                              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Exportar PDF com o filtro ativo"
                            >
                              <FileText size={18} />
                              <span className="hidden sm:inline">PDF</span>
                            </motion.button>

                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => exportIndividualOrderToExcel(clientIdx, selectedExportFilter)}
                              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Exportar Excel com o filtro ativo"
                            >
                              <Table size={18} />
                              <span className="hidden sm:inline">EXCEL</span>
                            </motion.button>

                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setActiveOrderExportMenu(activeOrderExportMenu === clientIdx ? null : clientIdx)}
                              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all cursor-pointer"
                              title="Opções avançadas de exportação"
                            >
                              <ChevronRight size={18} className={cn("transition-transform duration-200", activeOrderExportMenu === clientIdx && "rotate-90")} />
                            </motion.button>
                          </div>

                          {/* Order Export Dropdown Menu */}
                          {activeOrderExportMenu === clientIdx && (
                            <div className="absolute right-0 top-14 z-50 w-72 bg-white dark:bg-gray-900 rounded-2xl p-3 shadow-2xl border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                  Exportar Este Pedido
                                </span>
                                <button 
                                  onClick={() => setActiveOrderExportMenu(null)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <span className="text-[9px] font-bold uppercase text-gray-400 block mb-1">📄 Exportar PDF</span>
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToPDF(clientIdx, 'all');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-orange-500 hover:text-white transition-colors text-left truncate"
                                    >
                                      Todos
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToPDF(clientIdx, 'noStock');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-colors text-left truncate"
                                    >
                                      Sem Estoque
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToPDF(clientIdx, 'notFound');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors text-left truncate"
                                    >
                                      Não Encontrados
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToPDF(clientIdx, 'unavailable');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-colors text-left truncate"
                                    >
                                      Indisponíveis
                                    </button>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                  <span className="text-[9px] font-bold uppercase text-gray-400 block mb-1">📊 Exportar Excel</span>
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToExcel(clientIdx, 'all');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-green-600 hover:text-white transition-colors text-left truncate"
                                    >
                                      Todos
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToExcel(clientIdx, 'noStock');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-colors text-left truncate"
                                    >
                                      Sem Estoque
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToExcel(clientIdx, 'notFound');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors text-left truncate"
                                    >
                                      Não Encontrados
                                    </button>
                                    <button
                                      onClick={() => {
                                        exportIndividualOrderToExcel(clientIdx, 'unavailable');
                                        setActiveOrderExportMenu(null);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-colors text-left truncate"
                                    >
                                      Indisponíveis
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Product List for this Client */}
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {res.items.map((item: any, itemIdx: number) => {
                        const isChecked = checkedItems.has(`${clientIdx}-${itemIdx}`);
                        return (
                          <div 
                            key={itemIdx} 
                            className={cn(
                              "p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/50",
                              !isChecked && "opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-3 shrink-0">
                              <button 
                                onClick={() => toggleItem(clientIdx, itemIdx)}
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center transition-all shrink-0",
                                  isChecked ? "bg-green-500 text-white" : "border-2 border-gray-200 dark:border-gray-700"
                                )}
                              >
                                {isChecked && <CheckCircle2 size={16} />}
                              </button>

                              {(item.product?.photo || item.suggestedProduct?.photo) && (
                                <div 
                                  className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-1 shrink-0 cursor-zoom-in border border-gray-200/50 dark:border-gray-700/50"
                                  onClick={() => setSelectedImage(item.product?.photo || item.suggestedProduct?.photo)}
                                >
                                  <img 
                                    src={item.product?.photo || item.suggestedProduct?.photo} 
                                    alt={item.description} 
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-sm leading-tight">
                                  {item.description}
                                </h4>
                                {item.isReplaced && (
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase">
                                    Substituído
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-gray-400">
                                <span>EAN: {item.ean || 'N/A'}</span>
                                {(item.product?.industry || item.suggestedProduct?.industry) && (
                                  <span className="font-bold text-[#F06292] uppercase font-sans">
                                    {item.product?.industry || item.suggestedProduct?.industry}
                                  </span>
                                )}
                                {item.product?.finalPrice ? (
                                  <span className="font-bold text-green-600 dark:text-green-400 font-sans">
                                    {formatCurrency(item.product.finalPrice)}
                                  </span>
                                ) : null}
                              </div>

                              {/* CASE 1: MATCHED IN CATALOG */}
                              {item.found && item.product && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                    item.product?.stock > 10 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                                    item.product?.stock > 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : 
                                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  )}>
                                    {item.product?.stock > 10 ? 'Em Estoque' : 
                                     item.product?.stock > 0 ? 'Estoque Baixo' : 
                                     'Sem Estoque'}: {item.product?.stock || 0}
                                  </span>
                                  {item.product?.type === 'offer' && (
                                    <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 text-orange-600 rounded uppercase">Oferta</span>
                                  )}
                                  <button
                                    onClick={() => setReplacingItem({ clientIdx, itemIdx, item })}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-orange-100 hover:text-orange-600 transition-colors flex items-center gap-1 border border-gray-200 dark:border-gray-700 cursor-pointer"
                                    title="Substituir por outro produto do catálogo"
                                  >
                                    <Search size={10} /> Substituir Produto
                                  </button>
                                </div>
                              )}

                              {/* CASE 2: SUGGESTION FOUND BY DESCRIPTION */}
                              {!item.found && item.suggestedProduct && (
                                <div className="mt-3 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-black uppercase mb-1.5">
                                    <Sparkles size={13} className="shrink-0 text-amber-500" />
                                    <span>Sugestão Encontrada por Descrição ({item.matchScore}% Similar)</span>
                                  </div>

                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {item.suggestedProduct.photo && (
                                        <img 
                                          src={item.suggestedProduct.photo} 
                                          alt="" 
                                          className="w-9 h-9 object-contain rounded bg-white p-0.5 border border-amber-200/60 shrink-0" 
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate uppercase">
                                          {item.suggestedProduct.description}
                                        </p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                          EAN: {item.suggestedProduct.ean} | Preço: <strong className="text-green-600">{formatCurrency(item.suggestedProduct.finalPrice)}</strong> | Estoque: {item.suggestedProduct.stock || 0}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => handleConfirmSuggestion(clientIdx, itemIdx)}
                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                      >
                                        <CheckCircle2 size={14} /> Confirmar
                                      </button>
                                      <button
                                        onClick={() => setReplacingItem({ clientIdx, itemIdx, item })}
                                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                      >
                                        <Search size={14} /> Substituir
                                      </button>
                                      <button
                                        onClick={() => handleRejectSuggestion(clientIdx, itemIdx)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                        title="Rejeitar sugestão"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* CASE 3: NOT FOUND AND NO SUGGESTION */}
                              {!item.found && !item.suggestedProduct && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                    Não encontrado no catálogo
                                  </span>
                                  <button
                                    onClick={() => setReplacingItem({ clientIdx, itemIdx, item })}
                                    className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:opacity-90 transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                                  >
                                    <Search size={12} /> Buscar e Vincular Produto
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qtd:</span>
                              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const currentQty = item.quantity || 1;
                                    if (currentQty > 1) {
                                      updateItemQuantity(clientIdx, itemIdx, currentQty - 1);
                                    }
                                  }}
                                  disabled={(item.quantity || 1) <= 1}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                    (item.quantity || 1) <= 1 
                                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" 
                                      : "text-red-500 hover:bg-white dark:hover:bg-gray-700"
                                  )}
                                >
                                  <Minus size={14} />
                                </motion.button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val >= 1) {
                                      updateItemQuantity(clientIdx, itemIdx, val);
                                    } else if (e.target.value === '') {
                                      updateItemQuantity(clientIdx, itemIdx, 1);
                                    }
                                  }}
                                  className="w-10 text-center font-black text-sm bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                                />
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const currentQty = item.quantity || 1;
                                    updateItemQuantity(clientIdx, itemIdx, currentQty + 1);
                                  }}
                                  className="w-8 h-8 text-green-500 hover:bg-white dark:hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                                >
                                  <Plus size={14} />
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Client Summary Footer - Matches Image 2 */}
                    <div className="bg-[#FFF9F5] dark:bg-gray-800/30 p-6 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-green-600">
                              <CheckCircle2 size={18} /> {res.items.filter((item: any) => item.found && item.product?.stock > 0).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Com estoque</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-orange-500">
                              <AlertCircle size={18} /> {res.items.filter((item: any) => item.found && item.product?.stock <= 0).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Sem estoque</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-red-500">
                              <span className="text-red-500 font-black text-lg">✕</span> {res.items.filter((item: any) => !item.found).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Não encontrado</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => toggleClientSelection(clientIdx)}
                            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:text-[#FF6B00] transition-colors border border-gray-200 dark:border-gray-700"
                          >
                            {res.items.every((_: any, iIdx: number) => !_.found || checkedItems.has(`${clientIdx}-${iIdx}`)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                          </button>
                          {res.client && (
                            <button 
                              onClick={() => handleMakeSingleOrder(clientIdx)}
                              disabled={isProcessing}
                              className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                              Fazer Pedido
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#FF6B00]" />
                        <h4 className="text-base font-black text-[#FF6B00] uppercase italic flex items-center gap-2 mb-6 font-display">
                          📊 Resumo Financeiro
                        </h4>
                        
                        {(() => {
                          let clientSubtotal = 0;
                          let clientNoStock = 0;
                          let clientDiscount = 0;
                          res.items.forEach((item: any, iIdx: number) => {
                            if (checkedItems.has(`${clientIdx}-${iIdx}`)) {
                              const salePrice = item.product?.salePrice || item.price || 0;
                              const finalPrice = item.product?.finalPrice || item.price || 0;
                              
                              const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
                              const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
                              const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

                              clientSubtotal += rowPrecoSubtotal;
                              clientDiscount += rowDiscount;
                              
                              const hasStock = item.product ? item.product.stock > 0 : false;
                              if (!hasStock) {
                                clientNoStock += rowSubtotal;
                              }
                            }
                          });
                          const clientDiscountRounded = Math.round(clientDiscount * 100) / 100;
                          const clientTotal = Math.round((clientSubtotal - clientNoStock - clientDiscountRounded) * 100) / 100;

                          return (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-500 text-sm">Subtotal</span>
                                <span className="font-bold text-gray-900 dark:text-white text-base">{formatCurrency(clientSubtotal)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-1 bg-red-500 rounded-full" />
                                  <span className="font-bold text-red-500 text-sm">Sem estoque</span>
                                </div>
                                <span className="font-bold text-red-500 text-base">{formatCurrency(clientNoStock)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-1 bg-green-500 rounded-full" />
                                  <span className="font-bold text-green-500 text-sm">Descontos aplicados</span>
                                </div>
                                <span className="font-bold text-green-500 text-base">- {formatCurrency(clientDiscountRounded)}</span>
                              </div>
                              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                                <span className="text-lg font-black text-[#FF6B00] uppercase tracking-tight">Total estimado</span>
                                <span className="text-2xl font-black text-[#FF6B00]">{formatCurrency(clientTotal)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Global Financial Summary - Redesigned to be slim, clean and elegant */}
              <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-6 md:p-8 shadow-xl border-2 border-orange-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                
                <h3 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2 mb-6 font-display leading-none">
                  <span className="text-xl">📄</span> 
                  <span className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] bg-clip-text text-transparent uppercase">TOTAL GERAL – {results.length} pedidos</span>
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <span className="font-bold text-gray-400 text-sm uppercase tracking-wider font-display">Subtotal</span>
                    <span className="font-black text-gray-900 dark:text-white text-lg">{formatCurrency(financialSummary.subtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                      <span className="font-bold text-red-500 text-sm uppercase tracking-wider font-display">Sem Estoque</span>
                    </div>
                    <span className="font-black text-red-500 text-lg">{formatCurrency(financialSummary.noStock)}</span>
                  </div>

                  <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-2 bg-green-500 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                      <span className="font-bold text-green-500 text-sm uppercase tracking-wider font-display">Descontos</span>
                    </div>
                    <span className="font-black text-green-500 text-lg">- {formatCurrency(financialSummary.discount)}</span>
                  </div>
                  
                  <div className="pt-6 mt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950/40 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                        <ShoppingCart size={24} />
                      </div>
                      <span className="text-lg font-black text-[#FF6B00] uppercase tracking-tight italic font-display">Total Geral Estimado</span>
                    </div>
                    <div className="bg-[#FFF5F0] dark:bg-orange-950/20 px-6 py-3 rounded-2xl border border-[#FFE0D1] dark:border-orange-900/20 shadow-inner flex items-center justify-center min-w-[200px]">
                      <span className="text-3xl font-black text-[#FF6B00] drop-shadow-xs">{formatCurrency(financialSummary.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Global Export Filter Bar & Action Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 px-2 tracking-wider flex items-center gap-1.5">
                      <Download size={14} className="text-[#FF6B00]" />
                      <span>Filtro de Exportação:</span>
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedExportFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          selectedExportFilter === 'all'
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Todos os Itens
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedExportFilter('noStock')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                          selectedExportFilter === 'noStock'
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        )}
                      >
                        <AlertCircle size={13} />
                        <span>Sem Estoque</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedExportFilter('notFound')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                          selectedExportFilter === 'notFound'
                            ? "bg-red-500 text-white shadow-sm"
                            : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        )}
                      >
                        <X size={13} />
                        <span>Não Encontrados</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedExportFilter('unavailable')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                          selectedExportFilter === 'unavailable'
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        )}
                      >
                        <Package size={13} />
                        <span>Indisponíveis (Ambos)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <button 
                      onClick={() => {
                        setResults([]);
                        toast.success('Importação cancelada.');
                      }}
                      className="order-4 md:order-1 text-gray-400 hover:text-red-500 font-bold uppercase tracking-wider text-[11px] transition-colors py-2"
                    >
                      CANCELAR IMPORTAÇÃO
                    </button>
                    
                    <div className="order-2 md:order-2 flex gap-3 w-full md:w-auto">
                      <motion.button 
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => exportAllOrdersToExcel(selectedExportFilter)}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-300 transition-colors shadow-sm text-xs group cursor-pointer"
                      >
                        <Table size={16} className="text-green-600 group-hover:scale-110 transition-transform" />
                        <span className="uppercase tracking-wider">
                          EXCEL GERAL {selectedExportFilter === 'noStock' ? '(SEM ESTOQUE)' : selectedExportFilter === 'notFound' ? '(NÃO ENCONTRADOS)' : selectedExportFilter === 'unavailable' ? '(INDISPONÍVEIS)' : ''}
                        </span>
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => exportAllOrdersToPDF(selectedExportFilter)}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300 transition-colors shadow-sm text-xs group cursor-pointer"
                      >
                        <FileText size={16} className="text-red-600 group-hover:scale-110 transition-transform" />
                        <span className="uppercase tracking-wider">
                          PDF GERAL {selectedExportFilter === 'noStock' ? '(SEM ESTOQUE)' : selectedExportFilter === 'notFound' ? '(NÃO ENCONTRADOS)' : selectedExportFilter === 'unavailable' ? '(INDISPONÍVEIS)' : ''}
                        </span>
                      </motion.button>
                    </div>

                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleMakeAllOrders}
                      disabled={isProcessing}
                      className="order-1 md:order-3 w-full md:w-auto bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-6 py-3.5 rounded-xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />}
                      <span>FAZER TODOS OS PEDIDOS</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
              onClick={() => setSelectedImage(null)}
            >
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-xl transition-colors z-[210]"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
              >
                <X size={24} />
              </motion.button>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedImage}
                  alt="Expanded View"
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Bulk Import Modal */}
        <AnimatePresence>
          {showBulkImport && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-brand-blue text-white font-sans">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <ListPlus size={22} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg leading-tight">Digitar EAN e Quantidade</h3>
                      <p className="text-white/70 text-[11px]">Crie um pedido rapidamente informando os EANs e quantidades</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkImportText('');
                      setSelectedImportClient(null);
                      setClientSearchTerm('');
                    }} 
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800 font-sans">
                  {/* Left Side: Input Text & Client Selector (7 cols) */}
                  <div className="lg:col-span-7 p-6 flex flex-col gap-5 overflow-y-auto max-h-[50vh] lg:max-h-[68vh]">
                    {/* Step 1: Select Client */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase block tracking-wider">
                        Passo 1: Selecionar Cliente
                      </label>
                      {selectedImportClient ? (
                        <div className="bg-blue-50/50 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">🏪</div>
                            <div>
                              <p className="font-bold text-sm text-gray-800 dark:text-gray-200 uppercase">
                                {selectedImportClient.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                CNPJ: {selectedImportClient.cnpj || 'Não informado'} • {selectedImportClient.city || 'N/A'} - {selectedImportClient.state || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setSelectedImportClient(null)}
                            className="text-xs text-red-500 hover:text-red-600 font-bold uppercase hover:underline cursor-pointer"
                          >
                            Alterar
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                              <Search size={16} />
                            </span>
                            <input
                              type="text"
                              value={clientSearchTerm}
                              onChange={(e) => setClientSearchTerm(e.target.value)}
                              placeholder="Buscar cliente por nome, CNPJ, ID..."
                              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-800 dark:text-white placeholder-gray-400"
                            />
                          </div>
                          <div className="max-h-[140px] overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-[#151515]">
                            {filteredClients.length === 0 ? (
                              <p className="p-4 text-center text-xs text-gray-400">Nenhum cliente encontrado.</p>
                            ) : (
                              filteredClients.map((client) => (
                                <button
                                  key={client.id}
                                  onClick={() => setSelectedImportClient(client)}
                                  className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 flex items-center justify-between text-xs transition-colors group cursor-pointer"
                                >
                                  <div className="min-w-0 pr-4">
                                    <p className="font-black text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase truncate">
                                      {client.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                      {client.cnpj || 'Sem CNPJ'} • {client.city || 'N/A'}
                                    </p>
                                  </div>
                                  <span className="text-blue-500 font-black shrink-0 group-hover:translate-x-1 transition-transform">Selecionar &rarr;</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Paste List */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase block tracking-wider">
                          Passo 2: Inserir EAN e Quantidade
                        </label>
                        <span className="text-[10px] text-gray-400">Um item por linha</span>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1 font-sans">
                        <p className="font-bold">Formato de entrada:</p>
                        <pre className="font-mono bg-white/50 dark:bg-black/20 p-2 rounded-lg text-[10px] overflow-x-auto">
                          7891150037465{"\t"}6{"\n"}
                          7891000342345{"\t"}10
                        </pre>
                      </div>

                      <textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder={"7891150037465\t6\n7891000342345\t10"}
                        className="w-full min-h-[150px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 resize-none placeholder-gray-400 dark:text-white"
                      />

                      {bulkImportText && (
                        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                          <span>Total de linhas: {bulkImportText.split('\n').filter(l => l.trim()).length}</span>
                          <button 
                            onClick={() => setBulkImportText('')}
                            className="text-red-500 hover:text-red-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                            Limpar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Preview & Totals (5 cols) */}
                  <div className="lg:col-span-5 p-6 bg-gray-50/50 dark:bg-black/10 flex flex-col gap-4 overflow-y-auto max-h-[40vh] lg:max-h-[68vh]">
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase block tracking-wider">
                        Resumo da Lista ({parsedBulkItems.filter(item => item && item.product && !item.error).length} identificados)
                      </label>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[200px] lg:min-h-0">
                      {parsedBulkItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 text-gray-400 dark:text-gray-500">
                          <ClipboardList size={32} className="stroke-[1.5]" />
                          <p className="text-xs font-medium leading-normal">Insira os EANs e quantidades para visualizar a lista.</p>
                        </div>
                      ) : (
                        parsedBulkItems.map((item: any, i: number) => {
                          if (!item) return null;
                          const hasError = !!item.error;
                          
                          return (
                            <div 
                              key={i} 
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200",
                                hasError 
                                  ? "bg-red-50/50 dark:bg-red-950/10 border-red-100/60 dark:border-red-900/20" 
                                  : "bg-white dark:bg-[#252525] border-gray-100 dark:border-gray-800 hover:shadow-sm"
                              )}
                            >
                              {/* Product Thumbnail */}
                              {item.product ? (
                                <img 
                                  src={item.product.photo} 
                                  alt={item.product.description} 
                                  className="w-10 h-10 object-contain bg-white rounded-xl border border-gray-100 dark:border-gray-800 shrink-0" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-200/50 dark:border-gray-700 text-gray-400">
                                  <Package size={16} />
                                </div>
                              )}

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black truncate text-gray-800 dark:text-gray-200">
                                  {item.product ? item.product.description : `Código: ${item.code}`}
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[8px] px-1 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200/40 dark:border-gray-700/40">
                                    {item.code}
                                  </span>
                                  
                                  {hasError ? (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded-md bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 max-w-[120px] truncate" title={item.error}>
                                      {item.error}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded-md bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                                      Disponível
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity & Price */}
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-black text-gray-800 dark:text-gray-200">
                                  Qtd: <span className="text-blue-600 dark:text-blue-400">{item.quantity}</span>
                                </p>
                                {item.product && !hasError && (
                                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                                    {formatCurrency(item.product.finalPrice * Math.min(item.quantity, item.product.stock))}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold font-sans">Valor Total Estimado:</p>
                    <p className="text-xl font-black text-brand-orange mt-0.5 font-sans">{formatCurrency(bulkImportTotal)}</p>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto font-sans">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowBulkImport(false);
                        setBulkImportText('');
                        setSelectedImportClient(null);
                        setClientSearchTerm('');
                      }}
                      className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleApplyManualImport}
                      disabled={!selectedImportClient || parsedBulkItems.filter(item => item && item.product && !item.error).length === 0}
                      className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-brand-orange hover:bg-brand-orange/90 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-orange/10 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Importar Pedido ({parsedBulkItems.filter(item => item && item.product && !item.error).length})
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Product Substitution & Catalog Match Modal */}
        <AnimatePresence>
          {replacingItem && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col font-sans"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase font-display flex items-center gap-2">
                      <Package className="text-[#FF6B00]" size={20} />
                      Substituir Produto do Catálogo
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Busque o produto correto no catálogo para vincular ao item do pedido.
                    </p>
                  </div>
                  <button 
                    onClick={() => setReplacingItem(null)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Current Item Info Box */}
                <div className="my-4 p-3 bg-orange-50/60 dark:bg-orange-950/20 rounded-2xl border border-orange-200/60 dark:border-orange-900/40 text-xs">
                  <span className="font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block text-[10px] mb-0.5">
                    Item Original do Arquivo / Pedido:
                  </span>
                  <p className="font-bold text-gray-900 dark:text-white uppercase">
                    {replacingItem.item.description || 'Descrição não informada'}
                  </p>
                  <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                    EAN Lido: {replacingItem.item.ean || 'Não informado'}
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={replacementSearch}
                    onChange={(e) => setReplacementSearch(e.target.value)}
                    placeholder="Digite a descrição, EAN ou código para buscar no catálogo..."
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#FF6B00] outline-none text-gray-900 dark:text-white"
                    autoFocus
                  />
                  {replacementSearch && (
                    <button 
                      onClick={() => setReplacementSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Search Results List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[380px]">
                  {filteredReplacementProducts.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 italic">
                      <Package size={32} className="mx-auto mb-2 opacity-40" />
                      Nenhum produto encontrado com esse termo no catálogo.
                    </div>
                  ) : (
                    filteredReplacementProducts.map((prod) => (
                      <div 
                        key={prod.id}
                        className="p-3 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-700 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {prod.photo ? (
                            <img 
                              src={prod.photo} 
                              alt="" 
                              className="w-12 h-12 object-contain bg-gray-50 dark:bg-gray-900 rounded-xl p-1 border border-gray-100 dark:border-gray-800 shrink-0" 
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shrink-0 text-gray-400">
                              <Package size={20} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs uppercase text-gray-900 dark:text-white truncate">
                              {prod.description}
                            </h5>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-mono flex-wrap">
                              <span>EAN: {prod.ean}</span>
                              <span>•</span>
                              <span>ID: {prod.id}</span>
                              {prod.industry && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-[#F06292] font-sans uppercase">{prod.industry}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px]">
                              <span className="font-black text-green-600 dark:text-green-400">
                                {formatCurrency(prod.finalPrice)}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2 rounded uppercase",
                                prod.stock > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              )}>
                                Estoque: {prod.stock || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleReplaceProduct(replacingItem.clientIdx, replacingItem.itemIdx, prod)}
                          className="px-4 py-2 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase shadow-sm transition-all shrink-0 active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Selecionar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
