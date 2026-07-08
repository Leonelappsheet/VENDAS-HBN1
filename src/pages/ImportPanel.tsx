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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, normalizeEAN } from '../lib/utils';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REGIONALS, getRegionalLabel, RegionalKey } from '../constants/regionals';

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

    setResults([newResult]);

    // Auto-check all found items
    const initialChecked = new Set<string>();
    newResult.items.forEach((item, iIdx) => {
      if (item.found) {
        initialChecked.add(`0-${iIdx}`);
      }
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
      let cartItems: any[] = saved ? JSON.parse(saved) : [];

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
        await dataService.saveCart(client.id, cartItems);
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
    const saved = sessionStorage.getItem('selectedClient');
    return saved ? JSON.parse(saved) : null;
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
               const rawEan = String(row.EAN || row.ean || row['Código de Barras'] || row['Codigo Barras'] || row['CODIGO EAN'] || row.CODIGO || row['EAN13'] || '');
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

            setResults([{
              clientName: 'Importação Manual',
              cnpj: '',
              items: mapped
            }]);
            toast.success(`${mapped.length} itens identificados`);
          } catch (err) {
            console.error('Excel parse error:', err);
            toast.error('Erro ao ler planilha');
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
            let lastDetectedClient: any = null;

            for (const pageObj of pageTexts) {
              const pageText = pageObj.text;
              
              // 1. Identify client header on this page
              // A. Nazaria Filial header
              const filialMatch = pageText.match(/Filial:\s*(\d+)\s+([\d\.\/\-]+)\s+([^\n]+)/i);
              
              // B. A7 Pharma Unidade header
              const unidadeMatch = pageText.match(/Unidade:\s*(.*?)(?=Usuário:|CNPJ:|$)/i);
              
              let clientObj: any = null;
              
              if (filialMatch) {
                const filialNum = filialMatch[1];
                const cnpjRaw = filialMatch[2];
                const nameRaw = filialMatch[3];
                const cnpj = cnpjRaw.replace(/[^\d]/g, '');
                
                // Clean the name of trailing form details or pagination info
                let name = nameRaw;
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
                
                const fornecedorMatch = pageText.match(/Fornecedor:\s*(.*?)(?=Numero|$)/i);
                const numeroPedidoMatch = pageText.match(/Numero Pedido:\s*(\d+)/i);
                
                clientObj = {
                  clientName: name,
                  cnpj: cnpj,
                  items: [],
                  headerInfo: {
                    fornecedor: fornecedorMatch ? fornecedorMatch[1].trim() : 'NAZARIA DISTRIBUIDORA',
                    condPgto: '',
                    status: 'Pendente',
                    dataEntrega: '',
                    cotacao: numeroPedidoMatch ? `Pedido #${numeroPedidoMatch[1]}` : `Filial ${filialNum}`
                  }
                };
              } else if (unidadeMatch) {
                const name = unidadeMatch[1].trim();
                const cnpjMatch = pageText.match(/CNPJ:\s*([\d\.\/\-]+)/i);
                const cnpj = cnpjMatch ? cnpjMatch[1].trim().replace(/[^\d]/g, '') : '';
                
                const fornecedorMatch = pageText.match(/Fornecedor:\s*(.*?)(?=Cond\.|$)/i);
                const condPgtoMatch = pageText.match(/Cond\. Pgto:\s*(.*?)(?=Status|$)/i);
                const statusMatch = pageText.match(/Status:\s*(.*?)(?=Data|$)/i);
                const dataEntregaMatch = pageText.match(/Data Entrega:\s*([\d/]+\s*[\d:]*)/i);
                const cotacaoMatch = pageText.match(/Cotação:\s*(.*?)(?=\n|$)/i);
                
                clientObj = {
                  clientName: name,
                  cnpj: cnpj,
                  items: [],
                  headerInfo: {
                    fornecedor: fornecedorMatch ? fornecedorMatch[1].trim() : '',
                    condPgto: condPgtoMatch ? condPgtoMatch[1].trim() : '',
                    status: statusMatch ? statusMatch[1].trim() : '',
                    dataEntrega: dataEntregaMatch ? dataEntregaMatch[1].trim() : '',
                    cotacao: cotacaoMatch ? cotacaoMatch[1].trim() : ''
                  }
                };
              }
              
              // Handle context carry over or fallback
              if (!clientObj) {
                if (lastDetectedClient) {
                  // Carry over last client info to this page
                  clientObj = {
                    clientName: lastDetectedClient.clientName,
                    cnpj: lastDetectedClient.cnpj,
                    items: [],
                    headerInfo: { ...lastDetectedClient.headerInfo }
                  };
                } else {
                  clientObj = {
                    clientName: 'Cliente Não Identificado',
                    cnpj: '',
                    items: [],
                    headerInfo: { fornecedor: '', condPgto: '', status: '', dataEntrega: '', cotacao: '' }
                  };
                }
              } else {
                lastDetectedClient = clientObj;
              }
              
              // Try to find the exact client in allClients database
              const targetCnpj = clientObj.cnpj;
              const targetName = clientObj.clientName.toLowerCase();
              const matchedClient = allClients.find(c => {
                const dbCnpj = c.cnpj ? c.cnpj.replace(/[^\d]/g, '') : '';
                if (targetCnpj && dbCnpj === targetCnpj) return true;
                return c.name.toLowerCase().includes(targetName) || targetName.includes(c.name.toLowerCase());
              });
              if (matchedClient) {
                clientObj.client = matchedClient;
                // Use matched client name for visual consistency
                clientObj.clientName = matchedClient.name;
              }
              
              // 2. Extract products on this page
              const pageLines = pageText.split('\n');
              const pageProductsFound: any[] = [];
              
              // Pattern A: Nazaria format line matcher
              // Example: 7891025111832 APTAMIL 1 PREMIUM 400G DANONE UN 1 X 1 3
              const nazariaProdRegex = /(\d{8,14})\s+(.*?)\s+([A-Z0-9\s.\-]+)\s+([A-Z]{1,3})\s+(\d+(?:\s*[xX]\s*\d+)?)\s+(\d+)/;
              
              // Pattern B: A7 Pharma percent format
              const productRegexPercent = /(\d{8,14})\s+([^\n]*?)\s+([\d\.,]+\s*%)\s+([\d\.]+)\s+([\d\.]+,\d{2})/;
              
              // Pattern C: Standard generic product regex
              const productRegexNormal = /(\d{8,14})\s+([^\n]*?)\s+([\d\.]+)\s+([\d\.]+,\d{2})/;
              
              pageLines.forEach((line) => {
                const trimmedLine = line.trim();
                
                // Let's test Nazaria first
                const nazariaMatch = trimmedLine.match(nazariaProdRegex);
                if (nazariaMatch) {
                  const ean = normalizeEAN(nazariaMatch[1]);
                  const desc = nazariaMatch[2].trim();
                  const quantity = parseInt(nazariaMatch[6]);
                  pageProductsFound.push({ ean, desc, quantity, price: 0 });
                  return;
                }
                
                // Next, let's test percent format
                const percentMatch = trimmedLine.match(productRegexPercent);
                if (percentMatch) {
                  const ean = normalizeEAN(percentMatch[1]);
                  const rawDesc = percentMatch[2].trim();
                  const quantityStr = percentMatch[4].replace(/\./g, '');
                  const quantity = parseInt(quantityStr);
                  
                  // Extract price
                  const priceMatch = rawDesc.match(/([\d\.]+,\d{2})\s*$/);
                  let priceVal = 0;
                  let description = rawDesc;
                  if (priceMatch) {
                    priceVal = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
                    description = rawDesc.substring(0, priceMatch.index).trim();
                  } else {
                    const totalVal = parseFloat(percentMatch[5].replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(totalVal) && quantity > 0) {
                      priceVal = totalVal / quantity;
                    }
                  }
                  pageProductsFound.push({ ean, desc: description, quantity, price: priceVal });
                  return;
                }
                
                // Next, let's test normal product format
                const normalMatch = trimmedLine.match(productRegexNormal);
                if (normalMatch) {
                  const ean = normalizeEAN(normalMatch[1]);
                  const desc = normalMatch[2].trim();
                  const quantity = parseInt(normalMatch[3].replace(/\./g, ''));
                  const priceVal = parseFloat(normalMatch[4].replace(/\./g, '').replace(',', '.'));
                  pageProductsFound.push({ ean, desc, quantity, price: priceVal });
                  return;
                }
              });
              
              // Fallback EAN scan on this page if no products found with precise regexes
              if (pageProductsFound.length === 0) {
                const eanRegex = /\b\d{8,14}\b/g;
                const eanMatches = Array.from(pageText.matchAll(eanRegex));
                
                eanMatches.forEach((match, idx) => {
                  const rawEan = match[0];
                  const ean = normalizeEAN(rawEan);
                  const startPos = match.index || 0;
                  const endPos = eanMatches[idx + 1] ? eanMatches[idx + 1].index : pageText.length;
                  const blockText = pageText.substring(startPos, endPos).trim();
                  
                  const qpMatch = blockText.match(/([\d\.]+)\s+([\d\.]+,\d{2})/);
                  if (qpMatch) {
                    const quantity = parseInt(qpMatch[1].replace(/\./g, ''));
                    const priceVal = parseFloat(qpMatch[2].replace(/\./g, '').replace(',', '.'));
                    const description = blockText.substring(rawEan.length, qpMatch.index).trim();
                    pageProductsFound.push({ ean, desc: description, quantity, price: priceVal });
                  } else {
                    const qMatch = blockText.match(/([\d\.]+)\s*$/);
                    if (qMatch) {
                      const quantity = parseInt(qMatch[1].replace(/\./g, ''));
                      const description = blockText.substring(rawEan.length, qMatch.index).trim();
                      pageProductsFound.push({ ean, desc: description, quantity, price: 0 });
                    }
                  }
                });
              }
              
              // Populate the products into clientObj
              pageProductsFound.forEach(p => {
                const product = allProducts.find(prod => normalizeEAN(prod.ean) === p.ean);
                
                // Ensure no duplicate items on the same page
                if (!clientObj.items.find((item: any) => normalizeEAN(item.ean) === p.ean)) {
                  clientObj.items.push({
                    ean: p.ean,
                    quantity: isNaN(p.quantity) ? 1 : p.quantity,
                    description: product?.description || p.desc,
                    found: !!product,
                    product: product,
                    price: p.price || product?.finalPrice || 0
                  });
                }
              });
              
              if (clientObj.items.length > 0) {
                importResults.push(clientObj);
              }
            }

            // 3. Merge identical clients
            const mergedResults: any[] = [];
            importResults.forEach(res => {
              const existing = mergedResults.find(m => 
                (res.cnpj && m.cnpj && res.cnpj === m.cnpj) ||
                (res.client && m.client && res.client.id === m.client.id) ||
                (res.clientName.toLowerCase() === m.clientName.toLowerCase())
              );
              
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

            if (finalResults.length > 0) {
              setResults(finalResults);
              
              // Auto-check all found items across all clients
              const initialChecked = new Set<string>();
              finalResults.forEach((res, cIdx) => {
                res.items.forEach((item: any, iIdx: number) => {
                  if (item.found) initialChecked.add(`${cIdx}-${iIdx}`);
                });
              });
              setCheckedItems(initialChecked);
              
              toast.success(`${finalResults.length} clientes identificados no PDF`);
            } else {
              toast.error('Nenhum item identificado no PDF. Verifique o formato.');
            }
          } catch (err) {
            console.error('PDF parse error:', err);
            toast.error('Erro ao ler PDF');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error('Formato não suportado. Use Excel, CSV ou PDF.');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setLoading(false);
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
          let cartItems: any[] = saved ? JSON.parse(saved) : [];

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
            await dataService.saveCart(client.id, cartItems);
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
            sessionStorage.setItem('selectedClient', JSON.stringify(firstClient));
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

  const exportIndividualOrderToPDF = (clientIdx: number) => {
    const res = results[clientIdx];
    const selectedItems = res.items.filter((_: any, itemIdx: number) => 
      checkedItems.has(`${clientIdx}-${itemIdx}`)
    );

    if (selectedItems.length === 0) {
      toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const doc = new jsPDF();
    
    // Header helper
    const drawHeader = (d: jsPDF, pageNum: number, total: number, clientCode: string) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, 15, 182, 35, 'F');
      d.setFontSize(24);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('VENDAS HBN1', 105, 30, { align: 'center' });
      d.setFontSize(10);
      d.setFont('helvetica', 'normal');
      d.text('COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', 105, 38, { align: 'center' });
      const region = getRegionalLabel(selectedRegional as RegionalKey);
      d.setFontSize(8);
      const contactStr = `${region} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`;
      d.text(contactStr, 105, 43, { align: 'center' });
      d.text(`${new Date().toLocaleString('pt-BR')} \u2022 ${total} pedido(s)`, 105, 48, { align: 'center' });
    };

    const drawClientData = (d: jsPDF, y: number, r: any) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, y, 182, 6, 'F');
      d.setFontSize(8);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('DADOS DO CLIENTE', 105, y + 4.5, { align: 'center' });

      y += 10;
      d.setTextColor(0, 0, 0);
      // Ensure we pull clean names without header noise
      const cleanName = r.clientName?.split('Fornecedor:')[0]?.trim() || r.clientName || 'N/A';
      const cleanTradeName = r.client?.tradeName || cleanName;
      const cleanLegalName = r.client?.name || cleanName;
      
      const labels = ['Nome Fantasia', 'ID Cliente', 'Nome', 'CNPJ', 'Vendedor', 'Cidade/Estado'];
      const values = [
        cleanTradeName.toUpperCase(),
        r.client?.id || 'N/A',
        cleanLegalName.toUpperCase(),
        r.cnpj || r.client?.cnpj || 'N/A',
        (profile?.name || 'Leonel Amorim').toUpperCase(),
        (r.client?.city ? `${r.client.city} / ${r.client.state || 'MA'}` : 'N/A').toUpperCase()
      ];
      labels.forEach((label, i) => {
        d.setFont('helvetica', 'bold');
        d.text(label, 18, y + (i * 5));
        d.setFont('helvetica', 'normal');
        d.text(String(values[i]), 50, y + (i * 5));
      });
      return y + (labels.length * 5) + 5;
    };

    const clientCode = res.headerInfo?.cotacao || res.client?.id?.substring(0, 5) || '30214';
    drawHeader(doc, 1, 1, clientCode);
    let currentY = drawClientData(doc, 55, res);

    const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
    doc.setFillColor(255, 107, 0);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`FABRICANTE: ${manufacturer.toUpperCase()}`, 105, currentY + 4.5, { align: 'center' });
    currentY += 6;

      let calculatedPrecoSubtotal = 0;
      let calculatedNoStock = 0;
      let calculatedDiscount = 0;

      const tableData = selectedItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        calculatedPrecoSubtotal += rowPrecoSubtotal;
        calculatedDiscount += rowDiscount;
        if (!hasStock) {
          calculatedNoStock += rowSubtotal;
        }

        return [
          item.product?.id || 'N/A',
          item.ean,
          item.description.toUpperCase(),
          formatCurrency(salePrice),
          `${discountStr}%`,
          formatCurrency(finalPrice),
          item.quantity,
          formatCurrency(rowSubtotal),
          hasStock ? 'OK' : 'Sem estoque'
        ];
      });

    autoTable(doc, {
      startY: currentY,
      head: [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC% \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [255, 107, 0], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 18 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 22 },
        8: { halign: 'center', cellWidth: 20 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          if (data.cell.text[0] === 'OK') data.cell.styles.textColor = [0, 150, 0];
          else { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
        }
      }
    });

    const summaryY = (doc as any).lastAutoTable.finalY + 5;
    const subtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
    const noStock = Math.round(calculatedNoStock * 100) / 100;
    const discount = Math.round(calculatedDiscount * 100) / 100;
    const total = Math.round((subtotal - noStock - discount) * 100) / 100;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SUBTOTAL', 160, summaryY, { align: 'right' });
    doc.text(formatCurrency(subtotal), 196, summaryY, { align: 'right' });
    doc.setTextColor(200, 0, 0);
    doc.text('SEM ESTOQUE', 160, summaryY + 6, { align: 'right' });
    doc.text(formatCurrency(noStock), 196, summaryY + 6, { align: 'right' });
    doc.setTextColor(0, 150, 0);
    doc.text('DESCONTO', 160, summaryY + 12, { align: 'right' });
    doc.text(`-${formatCurrency(discount)}`, 196, summaryY + 12, { align: 'right' });
    doc.setFillColor(240, 240, 240);
    doc.rect(140, summaryY + 15, 60, 8, 'F');
    doc.setFontSize(11);
    doc.setTextColor(0, 50, 100);
    doc.text('TOTAL', 160, summaryY + 21, { align: 'right' });
    doc.text(formatCurrency(total), 196, summaryY + 21, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const contactInfoFooter = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'} | Tel: ${profile?.phone || '(86) 99964-7573'} | ${profile?.email || 'leonelamorimm@gmail.com'}`;
    doc.text(`Obrigado pela preferencia! | VENDAS HBN1 | ${contactInfoFooter} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 290, { align: 'center' });

    const rawName = res.clientName || 'N/A';
    const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
    doc.save(`Pedido_${cleanName.replace(/\s+/g, '_')}.pdf`);
  };


  const exportIndividualOrderToExcel = (clientIdx: number) => {
    try {
      const res = results[clientIdx];
      const selectedItems = res.items.filter((_: any, itemIdx: number) => 
        checkedItems.has(`${clientIdx}-${itemIdx}`)
      );

      if (selectedItems.length === 0) {
        toast.error('Nenhum item selecionado para exportar');
        return;
      }

      const rawName = res.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = res.client?.tradeName || cleanName;
      const displayLegalName = res.client?.name || cleanName;
      const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';

      // Financials
      let calculatedPrecoSubtotal = 0;
      let calculatedNoStock = 0;
      let calculatedDiscount = 0;

      selectedItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        calculatedPrecoSubtotal += rowPrecoSubtotal;
        calculatedDiscount += rowDiscount;
        
        const hasStock = item.product ? item.product.stock > 0 : false;
        if (!hasStock) {
          calculatedNoStock += rowSubtotal;
        }
      });

      const orderSubtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
      const orderNoStock = Math.round(calculatedNoStock * 100) / 100;
      const orderDiscount = Math.round(calculatedDiscount * 100) / 100;
      const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

      // Define Styles
      const mainHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 24, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const subHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const sectionBarStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const labelStyle: any = { font: { bold: true }, alignment: { horizontal: "left" } };
      const valueStyle: any = { alignment: { horizontal: "left" } };
      
      const tableHeadStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "FFFFFF" } },
          bottom: { style: "thin", color: { rgb: "FFFFFF" } },
          left: { style: "thin", color: { rgb: "FFFFFF" } },
          right: { style: "thin", color: { rgb: "FFFFFF" } }
        }
      };

      const cellStyle: any = { 
        font: { sz: 8 },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } }
        },
        alignment: { horizontal: "left" }
      };

      const moneyStyle: any = { ...cellStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: "right" } };
      const centerStyle: any = { ...cellStyle, alignment: { horizontal: "center" } };
      const highlightMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "FF6B00" } } };
      const subtotalMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "C80000" } } };

      const ws_data = [
        [{ v: 'VENDAS HBN1', t: 's', s: mainHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${getRegionalLabel(selectedRegional as RegionalKey)} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${new Date().toLocaleString('pt-BR')} \u2022 1 pedido(s)`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [],
        [{ v: 'DADOS DO CLIENTE', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'Nome Fantasia', t: 's', s: labelStyle }, { v: displayTradeName.toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'ID Cliente', t: 's', s: labelStyle }, { v: res.client?.id || 'N/A', t: 's', s: valueStyle }],
        [{ v: 'Nome', t: 's', s: labelStyle }, { v: displayLegalName.toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'CNPJ', t: 's', s: labelStyle }, { v: res.cnpj || res.client?.cnpj || 'N/A', t: 's', s: valueStyle }],
        [{ v: 'Vendedor', t: 's', s: labelStyle }, { v: (profile?.name || 'Leonel Amorim').toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'Cidade/Estado', t: 's', s: labelStyle }, { v: (res.client?.city ? `${res.client.city} / ${res.client.state || 'MA'}` : 'N/A').toUpperCase(), t: 's', s: valueStyle }],
        [],
        [{ v: `FABRICANTE: ${manufacturer.toUpperCase()}`, t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null],
        [
          { v: 'COD.', t: 's', s: tableHeadStyle },
          { v: 'EAN', t: 's', s: tableHeadStyle },
          { v: 'DESCRICAO', t: 's', s: tableHeadStyle },
          { v: 'PRECO', t: 's', s: tableHeadStyle },
          { v: 'DESC%', t: 's', s: tableHeadStyle },
          { v: 'PR.FINAL', t: 's', s: tableHeadStyle },
          { v: 'QT', t: 's', s: tableHeadStyle },
          { v: 'SUBTOTAL', t: 's', s: tableHeadStyle },
          { v: 'STATUS', t: 's', s: tableHeadStyle }
        ]
      ];

      selectedItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        ws_data.push([
          { v: item.product?.id || 'N/A', t: 's', s: centerStyle },
          { v: item.ean, t: 's', s: centerStyle },
          { v: item.description.toUpperCase(), t: 's', s: cellStyle },
          { v: salePrice, t: 'n', s: moneyStyle },
          { v: `${discountStr}%`, t: 's', s: centerStyle },
          { v: finalPrice, t: 'n', s: highlightMoneyStyle },
          { v: item.quantity, t: 'n', s: centerStyle },
          { v: Math.round((finalPrice * item.quantity) * 100) / 100, t: 'n', s: subtotalMoneyStyle },
          { v: hasStock ? 'OK' : 'Sem estoque', t: 's', s: { ...centerStyle, font: { color: { rgb: hasStock ? "009600" : "C80000" }, bold: !hasStock } } }
        ]);
      });

      ws_data.push([]);
      ws_data.push([null, null, null, null, null, null, { v: 'SUBTOTAL', t: 's', s: labelStyle }, { v: orderSubtotal, t: 'n', s: moneyStyle }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'SEM ESTOQUE', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: orderNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'DESCONTO', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -orderDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'TOTAL', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, { v: orderTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, null]);

      const ws = XLSXStyle.utils.aoa_to_sheet(ws_data);

      // Merges
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Header
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } }, // Dados cliente bar
        { s: { r: 13, c: 0 }, e: { r: 13, c: 8 } } // Fabricante bar
      ];

      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 45 }, { wch: 12 }, { wch: 8 }, 
        { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSXStyle.utils.book_new();
      const sheetName = (cleanName).replace(/[\[\]\*\?:\/\\]/g, '').substring(0, 31);
      XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
      
      const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Pedido_${cleanName.substring(0, 20).replace(/\s+/g, '_')}.xlsx`;
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

  const exportAllOrdersToPDF = () => {
    const doc = new jsPDF();
    const ordersToExport = results.filter((res, cIdx) => 
      res.items.some((_: any, iIdx: number) => checkedItems.has(`${cIdx}-${iIdx}`))
    );

    if (ordersToExport.length === 0) {
      toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const totalOrders = ordersToExport.length;
    let currentOrderNum = 1;

    // Common drawing functions defined inside for access to doc
    const drawHeader = (d: jsPDF, pageNum: number, total: number, clientCode: string) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, 15, 182, 35, 'F');
      d.setFontSize(24);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('VENDAS HBN1', 105, 30, { align: 'center' });
      d.setFontSize(10);
      d.setFont('helvetica', 'normal');
      d.text('COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', 105, 38, { align: 'center' });
      const region = getRegionalLabel(selectedRegional as RegionalKey);
      d.setFontSize(8);
      const contactInfoHead = `${region} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`;
      d.text(contactInfoHead, 105, 43, { align: 'center' });
      d.text(`${new Date().toLocaleString('pt-BR')} \u2022 ${total} pedido(s)`, 105, 48, { align: 'center' });
    };

    const drawClientData = (d: jsPDF, y: number, r: any) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, y, 182, 6, 'F');
      d.setFontSize(8);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('DADOS DO CLIENTE', 105, y + 4.5, { align: 'center' });
      y += 10;
      d.setTextColor(0, 0, 0);

      const rawName = r.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = r.client?.tradeName || cleanName;
      const displayLegalName = r.client?.name || cleanName;

      const labels = ['Nome Fantasia', 'ID Cliente', 'Nome', 'CNPJ', 'Vendedor', 'Cidade/Estado'];
      const values = [
        displayTradeName.toUpperCase(),
        r.client?.id || 'N/A',
        displayLegalName.toUpperCase(),
        r.cnpj || r.client?.cnpj || 'Não informado',
        (profile?.name || 'Leonel Amorim').toUpperCase(),
        (r.client?.city ? `${r.client.city} / ${r.client.state || 'MA'}` : 'N/A').toUpperCase()
      ];
      labels.forEach((label, i) => {
        d.setFont('helvetica', 'bold');
        d.text(label, 18, y + (i * 5));
        d.setFont('helvetica', 'normal');
        d.text(String(values[i]), 50, y + (i * 5));
      });
      return y + (labels.length * 5) + 5;
    };

    ordersToExport.forEach((res, idx) => {
      if (idx > 0) doc.addPage();
      
      const clientCode = res.headerInfo?.cotacao || res.client?.id?.substring(0, 5) || String(30214 + idx);
      drawHeader(doc, currentOrderNum, totalOrders, clientCode);
      let nextY = drawClientData(doc, 55, res);
      const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
      doc.setFillColor(255, 107, 0);
      doc.rect(14, nextY, 182, 6, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`FABRICANTE: ${manufacturer.toUpperCase()}`, 105, nextY + 4.5, { align: 'center' });
      nextY += 6;

      const resIdx = results.indexOf(res);
      const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${resIdx}-${iIdx}`));
      let orderPrecoSubtotalAcc = 0;
      let orderNoStockAcc = 0;
      let orderDiscountAcc = 0;

      const tableData = selectedItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        orderPrecoSubtotalAcc += rowPrecoSubtotal;
        orderDiscountAcc += rowDiscount;
        if (!hasStock) {
          orderNoStockAcc += rowSubtotal;
        }

        return [
          item.product?.id || 'N/A',
          item.ean,
          item.description.toUpperCase(),
          formatCurrency(salePrice),
          `${discountStr}%`,
          formatCurrency(finalPrice),
          item.quantity,
          formatCurrency(rowSubtotal),
          hasStock ? 'OK' : 'Sem estoque'
        ];
      });

      autoTable(doc, {
        startY: nextY,
        head: [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC% \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 107, 0], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 18 },
          1: { halign: 'center', cellWidth: 24 },
          2: { halign: 'left', cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 18 },
          6: { halign: 'center', cellWidth: 10 },
          7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 22 },
          8: { halign: 'center', cellWidth: 20 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 8) {
            if (data.cell.text[0] === 'OK') data.cell.styles.textColor = [0, 150, 0];
            else { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });

      const orderSubtotal = Math.round(orderPrecoSubtotalAcc * 100) / 100;
      const orderNoStock = Math.round(orderNoStockAcc * 100) / 100;
      const orderDiscount = Math.round(orderDiscountAcc * 100) / 100;
      const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

      const currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('SUBTOTAL', 160, currentY, { align: 'right' });
      doc.text(formatCurrency(orderSubtotal), 196, currentY, { align: 'right' });
      doc.setTextColor(200, 0, 0);
      doc.text('SEM ESTOQUE', 160, currentY + 6, { align: 'right' });
      doc.text(formatCurrency(orderNoStock), 196, currentY + 6, { align: 'right' });
      doc.setTextColor(0, 150, 0);
      doc.text('DESCONTO', 160, currentY + 12, { align: 'right' });
      doc.text(`-${formatCurrency(orderDiscount)}`, 196, currentY + 12, { align: 'right' });
      doc.setFillColor(240, 240, 240);
      doc.rect(140, currentY + 15, 60, 8, 'F');
      doc.setFontSize(11);
      doc.setTextColor(0, 50, 100);
      doc.text('TOTAL', 160, currentY + 21, { align: 'right' });
      doc.text(formatCurrency(orderTotal), 196, currentY + 21, { align: 'right' });

      currentOrderNum++;
    });

    // Final Global Summary Page
    doc.addPage();
    const finalGlobalY = 40;
    doc.setFillColor(255, 107, 0);
    doc.rect(14, finalGlobalY, 182, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL GERAL \u2014 ${totalOrders} PEDIDO(S)`, 105, finalGlobalY + 7, { align: 'center' });

    let summaryY = finalGlobalY + 25;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    
    // Calculate global stats correctly
    let globalPrecoSubtotal = 0;
    let globalNoStock = 0;
    let globalDiscount = 0;
    ordersToExport.forEach(res => {
      const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${results.indexOf(res)}-${iIdx}`));
      selectedItems.forEach(item => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        globalPrecoSubtotal += rowPrecoSubtotal;
        globalDiscount += rowDiscount;
        
        const hasStock = item.product ? item.product.stock > 0 : false;
        if (!hasStock) globalNoStock += rowSubtotal;
      });
    });
    const globalSubtotalRounded = Math.round(globalPrecoSubtotal * 100) / 100;
    const globalNoStockRounded = Math.round(globalNoStock * 100) / 100;
    const globalDiscountRounded = Math.round(globalDiscount * 100) / 100;
    const globalTotal = Math.round((globalSubtotalRounded - globalNoStockRounded - globalDiscountRounded) * 100) / 100;

    doc.text('SUBTOTAL', 100, summaryY, { align: 'right' });
    doc.text(formatCurrency(globalSubtotalRounded), 150, summaryY, { align: 'right' });
    
    doc.setTextColor(200, 0, 0);
    doc.text('SEM ESTOQUE', 100, summaryY + 10, { align: 'right' });
    doc.text(formatCurrency(globalNoStockRounded), 150, summaryY + 10, { align: 'right' });
    
    doc.setTextColor(0, 150, 0);
    doc.text('DESCONTO', 100, summaryY + 20, { align: 'right' });
    doc.text(`-${formatCurrency(globalDiscountRounded)}`, 150, summaryY + 20, { align: 'right' });
    
    doc.setFillColor(255, 107, 0);
    doc.rect(50, summaryY + 28, 110, 12, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL GERAL DOS PEDIDOS', 100, summaryY + 36, { align: 'right' });
    doc.text(formatCurrency(globalTotal), 155, summaryY + 36, { align: 'right' });

    // Footer for all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const contactFooterAll = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'} | Tel: ${profile?.phone || '(86) 99964-7573'} | ${profile?.email || 'leonelamorimm@gmail.com'}`;
        doc.text(`Obrigado pela preferencia! | VENDAS HBN1 | ${contactFooterAll} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 290, { align: 'center' });
    }

    doc.save('Relatorio_Importacao_Compilado.pdf');
  };

  const exportAllOrdersToExcel = () => {
    try {
      const ordersToExport = results.filter((res, cIdx) => 
        res.items.some((_: any, iIdx: number) => checkedItems.has(`${cIdx}-${iIdx}`))
      );

      if (ordersToExport.length === 0) {
        toast.error('Nenhum item selecionado para exportar');
        return;
      }

      // Define Styles
      const mainHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 20, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const subHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const sectionBarStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const labelStyle: any = { font: { bold: true }, alignment: { horizontal: "left" } };
      const valueStyle: any = { alignment: { horizontal: "left" } };
      
      const tableHeadStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const cellStyle: any = { font: { sz: 8 }, alignment: { horizontal: "left" } };
      const moneyStyle: any = { ...cellStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: "right" } };
      const centerStyle: any = { ...cellStyle, alignment: { horizontal: "center" } };
      const highlightMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "FF6B00" } } };
      const subtotalMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "C80000" } } };

      const ws_data: any[] = [
        [{ v: 'VENDAS HBN1', t: 's', s: mainHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${getRegionalLabel(selectedRegional as RegionalKey)} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${new Date().toLocaleString('pt-BR')} \u2022 ${ordersToExport.length} pedido(s)`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        []
      ];

      const merges: any[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }
      ];

      ordersToExport.forEach((res, cIdx) => {
        const startRow = ws_data.length;
        const resIdxInResults = results.indexOf(res);
        const selectedItems = res.items.filter((_: any, iIdx: number) => 
          checkedItems.has(`${resIdxInResults}-${iIdx}`)
        );

        const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
        const rawName = res.clientName || 'N/A';
        const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
        const displayTradeName = res.client?.tradeName || cleanName;
        const displayLegalName = res.client?.name || cleanName;

        ws_data.push([{ v: 'DADOS DO CLIENTE', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
        merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 8 } });

        ws_data.push([{ v: 'Nome Fantasia', t: 's', s: labelStyle }, { v: displayTradeName.toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'ID Cliente', t: 's', s: labelStyle }, { v: res.client?.id || 'N/A', t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Nome', t: 's', s: labelStyle }, { v: displayLegalName.toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'CNPJ', t: 's', s: labelStyle }, { v: res.cnpj || res.client?.cnpj || 'N/A', t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Vendedor', t: 's', s: labelStyle }, { v: (profile?.name || 'Leonel Amorim').toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Cidade/Estado', t: 's', s: labelStyle }, { v: (res.client?.city ? `${res.client.city} / ${res.client.state || 'MA'}` : 'N/A').toUpperCase(), t: 's', s: valueStyle }]);
        
        ws_data.push([{ v: `FABRICANTE: ${manufacturer.toUpperCase()}`, t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
        merges.push({ s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 8 } });

        ws_data.push([
          { v: 'COD.', t: 's', s: tableHeadStyle },
          { v: 'EAN', t: 's', s: tableHeadStyle },
          { v: 'DESCRICAO', t: 's', s: tableHeadStyle },
          { v: 'PRECO', t: 's', s: tableHeadStyle },
          { v: 'DESC%', t: 's', s: tableHeadStyle },
          { v: 'PR.FINAL', t: 's', s: tableHeadStyle },
          { v: 'QT', t: 's', s: tableHeadStyle },
          { v: 'SUBTOTAL', t: 's', s: tableHeadStyle },
          { v: 'STATUS', t: 's', s: tableHeadStyle }
        ]);

        let orderPrecoSubtotal = 0;
        let orderNoStock = 0;
        let orderDiscount = 0;

        selectedItems.forEach((item: any) => {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const subtotal = Math.round((finalPrice * item.quantity) * 100) / 100;
          const rowPrecoSubtotal = Math.round((salePrice * item.quantity) * 100) / 100;
          const rowDiscount = Math.round(((salePrice - finalPrice) * item.quantity) * 100) / 100;
          const hasStock = item.product ? item.product.stock > 0 : false;
          
          orderPrecoSubtotal = Math.round((orderPrecoSubtotal + rowPrecoSubtotal) * 100) / 100;
          orderDiscount = Math.round((orderDiscount + rowDiscount) * 100) / 100;
          if (!hasStock) orderNoStock = Math.round((orderNoStock + subtotal) * 100) / 100;

          ws_data.push([
            { v: item.product?.id || 'N/A', t: 's', s: centerStyle },
            { v: item.ean, t: 's', s: centerStyle },
            { v: item.description.toUpperCase(), t: 's', s: cellStyle },
            { v: salePrice, t: 'n', s: moneyStyle },
            { v: `${salePrice > 0 ? Math.round((1 - finalPrice / salePrice) * 100) : 0}%`, t: 's', s: centerStyle },
            { v: finalPrice, t: 'n', s: highlightMoneyStyle },
            { v: item.quantity, t: 'n', s: centerStyle },
            { v: subtotal, t: 'n', s: subtotalMoneyStyle },
            { v: hasStock ? 'OK' : 'Sem estoque', t: 's', s: { ...centerStyle, font: { color: { rgb: hasStock ? "009600" : "C80000" }, bold: !hasStock } } }
          ]);
        });

        const orderSubtotal = Math.round(orderPrecoSubtotal * 100) / 100;
        const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

        ws_data.push([null, null, null, null, null, null, { v: 'SUBTOTAL', t: 's', s: labelStyle }, { v: orderSubtotal, t: 'n', s: moneyStyle }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'SEM ESTOQUE', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: orderNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'DESCONTO', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -orderDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'TOTAL', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, bold: true } } }, { v: orderTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, bold: true } } }, null]);
        ws_data.push([]); // Spacer
      });

      // Global Summary at the bottom
      let globalPrecoSubtotal = 0;
      let globalNoStock = 0;
      let globalDiscount = 0;
      ordersToExport.forEach(res => {
        const resIdx = results.indexOf(res);
        const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${resIdx}-${iIdx}`));
        selectedItems.forEach(item => {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const subtotal = Math.round((finalPrice * item.quantity) * 100) / 100;
          const rowPrecoSubtotal = Math.round((salePrice * item.quantity) * 100) / 100;
          const rowDiscount = Math.round(((salePrice - finalPrice) * item.quantity) * 100) / 100;
          const hasStock = item.product ? item.product.stock > 0 : false;
          
          globalPrecoSubtotal = Math.round((globalPrecoSubtotal + rowPrecoSubtotal) * 100) / 100;
          globalDiscount = Math.round((globalDiscount + rowDiscount) * 100) / 100;
          if (!hasStock) {
            globalNoStock = Math.round((globalNoStock + subtotal) * 100) / 100;
          }
        });
      });
      const globalSubtotal = Math.round(globalPrecoSubtotal * 100) / 100;
      const globalTotal = Math.round((globalSubtotal - globalNoStock - globalDiscount) * 100) / 100;

      ws_data.push([]);
      ws_data.push([{ v: 'RESUMO FINANCEIRO GERAL', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
      merges.push({ s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 8 } });
      
      ws_data.push([{ v: 'TOTAL DE PEDIDOS:', t: 's', s: labelStyle }, { v: ordersToExport.length, t: 'n', s: valueStyle }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'SUBTOTAL GERAL:', t: 's', s: labelStyle }, { v: globalSubtotal, t: 'n', s: moneyStyle }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'SEM ESTOQUE GERAL:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: globalNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'DESCONTO TOTAL:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -globalDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'TOTAL GERAL DOS PEDIDOS:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, { v: globalTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, null, null, null, null, null, null, null]);

      const ws = XLSXStyle.utils.aoa_to_sheet(ws_data);
      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 45 }, { wch: 12 }, { wch: 8 }, 
        { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSXStyle.utils.book_new();
      XLSXStyle.utils.book_append_sheet(wb, ws, 'Relatório_Consolidado');
      
      const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_Importacao_Consolidado_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório Excel consolidado gerado com sucesso');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Erro ao exportar Excel geral');
    }
  };


  const toggleItem = (clientIdx: number, itemIdx: number) => {
    const key = `${clientIdx}-${itemIdx}`;
    const newChecked = new Set(checkedItems);
    if (newChecked.has(key)) newChecked.delete(key);
    else newChecked.add(key);
    setCheckedItems(newChecked);
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
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let targetSheetName = workbook.SheetNames[0];
          if (industry === 'DANONE') {
            // Mais flexível na busca da aba
            const danoneSheet = workbook.SheetNames.find(name => {
              const normalized = name.trim().toUpperCase().replace(/\s/g, '');
              return normalized.includes('FAT.MIN.1.000,00') || normalized.includes('1.000');
            });
            
            if (danoneSheet) {
              targetSheetName = danoneSheet;
            } else {
              toast.error('Aba "FAT. MIN. 1.000,00" não encontrada. Usando a primeira aba disponível.');
            }
          }
          
          const targetSheet = workbook.Sheets[targetSheetName];
          const rows = XLSX.utils.sheet_to_json(targetSheet, { header: 1 });
          
          toast.loading(`Atualizando catálogo ${industry} para ${getRegionalLabel(selectedRegional)}...`, { id: 'catalog-update' });
          const result = await dataService.updateCatalogInSheets(industry, rows, defaultExpiryDate || null);
          
          if (result && result.sucesso) {
            setCatalogUpdateResult(result);
            toast.success('Catálogo atualizado com sucesso!', { id: 'catalog-update' });
          } else {
            // Error is already handled in dataService.ts with a specific toast
            toast.dismiss('catalog-update');
          }
        } catch (err) {
          console.error('Catalog parse error:', err);
          toast.error('Erro ao processar planilha de catálogo');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(catalogFile);
    } catch (error) {
      console.error('Catalog update error:', error);
      toast.error('Erro ao ler arquivo');
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
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileSelect}
            />
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600">
              {loading ? <RefreshCw size={40} className="animate-spin" /> : <FileUp size={40} />}
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white">Importar Pedido</h3>
              <p className="text-sm text-gray-500 mt-2">
                PDF (A7 Pharma) ou Excel/CSV<br />com EAN + Quantidade
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
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(REGIONALS).filter(reg => {
                        if (profile?.role !== 'vendedor') return true;
                        if (!profile.regional) return false;
                        const userReg = profile.regional.toUpperCase();
                        if (reg === 'TIMON-MA') return userReg.includes('TIMON') || userReg.includes('TIMAO');
                        if (reg === 'THE') return userReg.includes('THE') || userReg.includes('TERESINA');
                        if (reg === 'IMP') return userReg.includes('IMP') || userReg.includes('IMPERATRIZ');
                        return false;
                      }).map((reg) => (
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
                              {res.headerInfo.fornecedor && <span>FORNECEDOR: {res.headerInfo.fornecedor}</span>}
                              {res.headerInfo.condPgto && <span>COND. PGTO: {res.headerInfo.condPgto}</span>}
                              {res.headerInfo.status && <span>STATUS: {res.headerInfo.status}</span>}
                              {res.headerInfo.dataEntrega && <span>DATA ENTREGA: {res.headerInfo.dataEntrega}</span>}
                              {res.headerInfo.cotacao && <span>COTAÇÃO: {res.headerInfo.cotacao}</span>}
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
                        
                        <div className="flex gap-3 shrink-0">
                          <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => exportIndividualOrderToExcel(clientIdx)}
                            className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
                            title="Exportar Excel"
                          >
                            <Table size={24} />
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => exportIndividualOrderToPDF(clientIdx)}
                            className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
                            title="Exportar PDF"
                          >
                            <FileText size={24} />
                          </motion.button>
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
                              "p-4 flex items-center gap-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                              !isChecked && "opacity-50"
                            )}
                          >
                            <button 
                              onClick={() => toggleItem(clientIdx, itemIdx)}
                              className={cn(
                                "w-6 h-6 rounded flex items-center justify-center transition-all shrink-0",
                                isChecked ? "bg-green-500 text-white" : "border-2 border-gray-200 dark:border-gray-700"
                              )}
                            >
                              {isChecked && <CheckCircle2 size={16} />}
                            </button>

                            {item.product?.photo && (
                              <div 
                                className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-1 shrink-0 cursor-zoom-in"
                                onClick={() => setSelectedImage(item.product.photo)}
                              >
                                <img 
                                  src={item.product.photo} 
                                  alt={item.description} 
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 dark:text-white truncate uppercase text-sm leading-tight">
                                {item.description}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-gray-400">EAN: {item.ean}</span>
                                {item.product?.industry && (
                                  <span className="text-[10px] font-bold text-[#F06292] uppercase">{item.product.industry}</span>
                                )}
                              </div>
                              {item.found && (
                                <div className="mt-2 flex gap-2">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                    item.product?.stock > 10 ? "bg-green-100 text-green-600" : 
                                    item.product?.stock > 0 ? "bg-yellow-100 text-yellow-600" : 
                                    "bg-red-100 text-red-600"
                                  )}>
                                    {item.product?.stock > 10 ? 'Em Estoque' : 
                                     item.product?.stock > 0 ? 'Estoque Baixo' : 
                                     'Sem Estoque'}: {item.product?.stock || 0}
                                  </span>
                                  {item.product?.type === 'offer' && (
                                    <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 text-orange-600 rounded uppercase">Oferta</span>
                                  )}
                                </div>
                              )}
                              {!item.found && (
                                <div className="mt-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-100 text-red-600">
                                    Não encontrado no catálogo
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-gray-400 uppercase">Qtd:</span>
                              <span className="text-lg font-black text-gray-900 dark:text-white ml-1">{item.quantity}</span>
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

              {/* Global Financial Summary - Matches Image 3 with large border and rounded font */}
              <div className="bg-white dark:bg-[#1E1E1E] rounded-[3.5rem] p-10 shadow-2xl border-[10px] border-[#FF6B00] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -mr-32 -mt-32" />
                
                <h3 className="text-[2.5rem] font-black italic uppercase tracking-tighter flex items-center gap-4 mb-12 font-display leading-none">
                  <span className="text-3xl">📄</span> 
                  <span className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] bg-clip-text text-transparent">TOTAL GERAL – {results.length} pedidos</span>
                </h3>

                <div className="space-y-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="font-bold text-gray-400 text-2xl uppercase tracking-widest font-display">Subtotal</span>
                    <span className="font-black text-gray-900 dark:text-white text-3xl">{formatCurrency(financialSummary.subtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                      <span className="font-bold text-red-500 text-2xl uppercase tracking-widest font-display">Sem Estoque</span>
                    </div>
                    <span className="font-black text-red-500 text-3xl">{formatCurrency(financialSummary.noStock)}</span>
                  </div>

                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      <span className="font-bold text-green-500 text-2xl uppercase tracking-widest font-display">Descontos</span>
                    </div>
                    <span className="font-black text-green-500 text-3xl">- {formatCurrency(financialSummary.discount)}</span>
                  </div>
                  
                  <div className="pt-10 border-t-2 border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-3xl flex items-center justify-center text-orange-600 shadow-lg">
                        <ShoppingCart size={32} />
                      </div>
                      <span className="text-3xl font-black text-[#FF6B00] uppercase tracking-tighter italic font-display">Total Geral Estimado</span>
                    </div>
                    <div className="bg-[#FFF5F0] dark:bg-orange-900/10 px-16 py-8 rounded-[3rem] border-2 border-[#FFE0D1] dark:border-orange-900/20 shadow-inner flex items-center justify-center min-w-[300px]">
                      <span className="text-7xl font-black text-[#FF6B00] drop-shadow-sm">{formatCurrency(financialSummary.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-14 flex flex-col lg:flex-row items-center justify-between gap-8">
                  <button 
                    onClick={() => {
                      setResults([]);
                      toast.success('Importação cancelada.');
                    }}
                    className="order-4 lg:order-1 text-gray-400 hover:text-red-500 font-black uppercase tracking-widest text-xs transition-all hover:scale-105"
                  >
                    CANCELAR IMPORTAÇÃO
                  </button>
                  
                  <div className="order-2 lg:order-2 flex gap-4 w-full lg:w-auto">
                    <motion.button 
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={exportAllOrdersToExcel}
                      className="flex-1 lg:flex-none px-8 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-black flex items-center justify-center gap-3 text-gray-500 hover:bg-gray-50 transition-all shadow-sm group"
                    >
                      <Download size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="uppercase text-xs tracking-widest">EXCEL GERAL</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={exportAllOrdersToPDF}
                      className="flex-1 lg:flex-none px-8 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-black flex items-center justify-center gap-3 text-gray-500 hover:bg-gray-50 transition-all shadow-sm group"
                    >
                      <Download size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="uppercase text-xs tracking-widest">PDF GERAL</span>
                    </motion.button>
                  </div>

                  <motion.button 
                    whileHover={{ scale: 1.05, shadow: "0 25px 50px rgba(255,107,0,0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMakeAllOrders}
                    disabled={isProcessing}
                    className="order-1 lg:order-3 w-full lg:w-auto bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-12 py-7 rounded-[2.5rem] font-black text-2xl shadow-[0_20px_40px_rgba(255,107,0,0.3)] flex items-center justify-center gap-4 group border-b-4 border-black/10 disabled:opacity-50"
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" size={32} /> : <Sparkles size={32} className="group-hover:rotate-12 transition-transform" />}
                    <span>FAZER TODOS OS PEDIDOS</span>
                  </motion.button>
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
      </main>
    </div>
  );
}
