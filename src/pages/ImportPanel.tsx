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
  Sparkles
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
import { safeLocalStorage, safeSessionStorage } from '../lib/storage';

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
      const saved = safeLocalStorage.getItem(cartKey);
      let cartItems: any[] = saved ? JSON.parse(saved) : [];

      selectedItems.forEach((item: any) => {
        const existing = cartItems.find(i => i.id === item.product.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          cartItems.push({ ...item.product, quantity: item.quantity, ean: item.ean });
        }
      });

      safeLocalStorage.setItem(cartKey, JSON.stringify(cartItems));
      await dataService.saveCart(client.id, cartItems);
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
    const saved = safeSessionStorage.getItem('selectedClient');
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
            let fullText = '';
            
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
              fullText += pageText + '\n';
            }

            const lines = fullText.split('\n');
            const importResults: any[] = [];
            let currentClient: any = null;

            // 1. First pass: Identify clients and their positions in the text
            const clientMatches = Array.from(fullText.matchAll(/Unidade:\s*(.*?)(?=Usuário:|CNPJ:|$)/gi));

            // 2. Second pass: Identify all products with EAN, Description, Quantity and Price
            // Using a resilient, high-precision regex matching the percent column (%) which is highly reliable in A7 Pharma reports
            // Format: [EAN 8-14 digits] [Description] [% Discount or numeric percent value] [Quantity] [Total]
            const productRegexPercent = /(\d{8,14})\s+([^\n]*?)\s+([\d\.,]+\s*%)\s+([\d\.]+)\s+([\d\.]+,\d{2})/g;
            let allProductsFound = Array.from(fullText.matchAll(productRegexPercent)).map(m => {
              const ean = normalizeEAN(m[1]);
              const rawDesc = m[2].trim();
              const quantityStr = m[4].replace(/\./g, '');
              const quantity = parseInt(quantityStr);
              
              // Extract unit price from the end of raw description if present
              const priceMatch = rawDesc.match(/([\d\.]+,\d{2})\s*$/);
              let priceStr = '0,00';
              let description = rawDesc;
              if (priceMatch) {
                priceStr = priceMatch[1];
                description = rawDesc.substring(0, priceMatch.index).trim();
              } else {
                // Heuristic breakdown of total & quantity
                const totalStr = m[5].replace(/\./g, '').replace(',', '.');
                const totalVal = parseFloat(totalStr);
                if (!isNaN(totalVal) && quantity > 0) {
                  priceStr = (totalVal / quantity).toFixed(2).replace('.', ',');
                }
              }
              
              const entry = [m[0], ean, description, String(quantity), priceStr] as any;
              entry.index = m.index;
              return entry;
            });

            // Fallback matching if percent-based regex produced no matches
            if (allProductsFound.length === 0) {
              const productRegex = /(\d{8,14})\s+([^\n]*?)\s+([\d\.]+)\s+([\d\.]+,\d{2})/g;
              const matches = Array.from(fullText.matchAll(productRegex));
              
              if (matches.length > 0) {
                allProductsFound = matches.map(m => {
                  const ean = normalizeEAN(m[1]);
                  const desc = m[2].trim();
                  const qty = parseInt(m[3].replace(/\./g, ''));
                  const priceStr = m[4];
                  const entry = [m[0], ean, desc, String(qty), priceStr] as any;
                  entry.index = m.index;
                  return entry;
                });
              } else {
                // Extract individual EAN elements and scan surrounding blocks
                const eanRegex = /\b\d{8,14}\b/g;
                const eanMatches = Array.from(fullText.matchAll(eanRegex));
                
                eanMatches.forEach((match, idx) => {
                  const rawEan = match[0];
                  const ean = normalizeEAN(rawEan);
                  const startPos = match.index || 0;
                  const endPos = eanMatches[idx + 1] ? eanMatches[idx + 1].index : fullText.length;
                  const blockText = fullText.substring(startPos, endPos).trim();
                  
                  const qpMatch = blockText.match(/([\d\.]+)\s+([\d\.]+,\d{2})/);
                  if (qpMatch) {
                    const quantity = parseInt(qpMatch[1].replace(/\./g, ''));
                    const price = qpMatch[2];
                    const description = blockText.substring(rawEan.length, qpMatch.index).trim();
                    const entry = [match[0], ean, description, String(quantity), price] as any;
                    entry.index = match.index;
                    allProductsFound.push(entry);
                  } else {
                    const qMatch = blockText.match(/([\d\.]+)\s*$/);
                    if (qMatch) {
                      const quantity = parseInt(qMatch[1].replace(/\./g, ''));
                      const description = blockText.substring(rawEan.length, qMatch.index).trim();
                      const entry = [match[0], ean, description, String(quantity), "0,00"] as any;
                      entry.index = match.index;
                      allProductsFound.push(entry);
                    }
                  }
                });
              }
            }

            // 3. Group products by client based on their position in the text
            if (clientMatches.length > 0) {
              clientMatches.forEach((match, index) => {
                const name = match[1].trim();
                if (name.toUpperCase().includes('ESCRITÓRIO')) return;

                const startPos = match.index || 0;
                const endPos = clientMatches[index + 1] ? clientMatches[index + 1].index : fullText.length;
                const clientText = fullText.substring(startPos, endPos || fullText.length);

                const cnpjMatch = clientText.match(/CNPJ:\s*([\d\.\/\-]+)/i);
                const cnpj = cnpjMatch ? cnpjMatch[1].trim().replace(/[^\d]/g, '') : '';

                // Extract extra header info for A7 Pharma
                const fornecedorMatch = clientText.match(/Fornecedor:\s*(.*?)(?=Cond\.|$)/i);
                const condPgtoMatch = clientText.match(/Cond\. Pgto:\s*(.*?)(?=Status|$)/i);
                const statusMatch = clientText.match(/Status:\s*(.*?)(?=Data|$)/i);
                const dataEntregaMatch = clientText.match(/Data Entrega:\s*([\d/]+\s*[\d:]*)/i);
                const cotacaoMatch = clientText.match(/Cotação:\s*(.*?)(?=\n|$)/i);

                const clientObj: any = {
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

                // Find client in system
                const matchedClient = allClients.find(c => 
                  (cnpj && c.cnpj.replace(/[^\d]/g, '') === cnpj) ||
                  c.name.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(c.name.toLowerCase())
                );
                if (matchedClient) clientObj.client = matchedClient;

                // Find products that belong to this client block
                allProductsFound.forEach(pMatch => {
                  const pPos = pMatch.index || 0;
                  if (pPos >= startPos && pPos < (endPos || fullText.length)) {
                    const ean = normalizeEAN(pMatch[1]);
                    const description = pMatch[2].trim();
                    const quantity = parseInt(pMatch[3]);
                    const priceStr = pMatch[4] ? pMatch[4].replace(/\./g, '').replace(',', '.') : '0';
                    const price = parseFloat(priceStr);
                    
                    const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                    
                    if (!clientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                      clientObj.items.push({
                        ean,
                        quantity: isNaN(quantity) ? 1 : quantity,
                        description: product?.description || description,
                        found: !!product,
                        product: product,
                        price: price
                      });
                    }
                  }
                });

                if (clientObj.items.length > 0) {
                  importResults.push(clientObj);
                }
              });
            } else {
              // No client headers found, put everything in a default client
              currentClient = { clientName: 'Cliente Não Identificado', cnpj: '', items: [] };
              allProductsFound.forEach(pMatch => {
                const ean = normalizeEAN(pMatch[1]);
                const description = pMatch[2].trim();
                const quantity = parseInt(pMatch[3]);
                const priceStr = pMatch[4] ? pMatch[4].replace(/\./g, '').replace(',', '.') : '0';
                const price = parseFloat(priceStr);
                const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                
                if (!currentClient.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                  currentClient.items.push({
                    ean,
                    quantity: isNaN(quantity) ? 1 : quantity,
                    description: product?.description || description,
                    found: !!product,
                    product: product,
                    price: price
                  });
                }
              });
              if (currentClient.items.length > 0) {
                importResults.push(currentClient);
              }
            }

            // Filter out clients with no items
            const finalResults = importResults.filter(r => r.items.length > 0);

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
          const saved = safeLocalStorage.getItem(cartKey);
          let cartItems: any[] = saved ? JSON.parse(saved) : [];

          selectedItems.forEach((item: any) => {
            const existing = cartItems.find(i => i.id === item.product.id);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              cartItems.push({ ...item.product, quantity: item.quantity });
            }
          });

          safeLocalStorage.setItem(cartKey, JSON.stringify(cartItems));
          await dataService.saveCart(client.id, cartItems);
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
            safeSessionStorage.setItem('selectedClient', JSON.stringify(firstClient));
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
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 12 },
        5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 20 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 25 },
        8: { halign: 'center', cellWidth: 15 }
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
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'left', cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 10 },
          5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 20 },
          6: { halign: 'center', cellWidth: 10 },
          7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 25 },
          8: { halign: 'center', cellWidth: 15 }
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
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212]">
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-white/20 rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
          <img src="/logo.svg" alt="Logo" className="w-8 h-8 brightness-0 invert" />
          <h1 className="text-white font-bold text-lg">Importar Pedido</h1>
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
          className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
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
            <button className="mt-4 bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg">
              Escolher arquivo
            </button>
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
      </main>
    </div>
  );
}
