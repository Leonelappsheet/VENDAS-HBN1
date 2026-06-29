import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService, getApiUrl } from '../services/dataService';
import { Order, Client } from '../types';
import { 
  ChevronLeft, 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  Trophy, 
  Target,
  Download,
  Share2,
  RefreshCw,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { REGIONALS, getRegionalLabel } from '../constants/regionals';
import { ClientSchema } from '../lib/schemas';

export default function AdminPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [activeTab, setActiveTab] = useState<'relatorio' | 'inativos' | 'produtos' | 'ranking' | 'metas' | 'regional' | 'sincronizacao' | 'carrinhos'>('relatorio');
  const [orders, setOrders] = useState<Order[]>([]);
  const [sheetOrders, setSheetOrders] = useState<Order[]>([]);
  const [sheetCarts, setSheetCarts] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<{ valor: number } | null>(null);
  const [allMetas, setAllMetas] = useState<any[]>([]);
  const [sheetsStatus, setSheetsStatus] = useState<any>(null);
  const [adminCustomId, setAdminCustomId] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    try {
      return localStorage.getItem('CUSTOM_API_URL') || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (!profile) return;

    const unsubOrders = dataService.subscribeOrders(null, profile.name, profile.role === 'admin', (data) => {
      setOrders(data);
    });

    const fetchData = async () => {
      const [clientsData, metaData, allMetasData, sheetOrdersData, sheetCartsData] = await Promise.all([
        dataService.getClients(profile.name, profile.role === 'admin'),
        dataService.getMetas(profile.name),
        profile.role === 'admin' ? dataService.getAllMetas() : Promise.resolve([]),
        dataService.getOrdersFromSheets(),
        dataService.getCartsFromSheets()
      ]);
      setClients(clientsData || []);
      setMeta(metaData);
      setAllMetas(allMetasData);
      setSheetOrders(sheetOrdersData || []);
      setSheetCarts(sheetCartsData || []);

      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        setSheetsStatus(status);
      } catch (e) {}

      try {
        const savedId = localStorage.getItem(`CUSTOM_SPREADSHEET_ID_${profile.regional || 'TIMON-MA'}`);
        if (savedId) {
          setAdminCustomId(savedId);
        }
      } catch (e) {}

      setLoading(false);
    };

    fetchData();
    return () => unsubOrders();
  }, [profile]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      // Validate client data
      ClientSchema.parse({
        name: updatedClient.name,
        tradeName: updatedClient.tradeName,
        cnpj: updatedClient.cnpj,
        email: updatedClient.email,
        phone: updatedClient.phone,
        city: updatedClient.city,
        state: updatedClient.state,
        regional: updatedClient.regional,
      });

      toast.loading('Sincronizando com Google Sheets...', { id: 'update-client' });
      const result = await dataService.updateClientInSheet(updatedClient);
      if (result) {
        toast.success('Cliente atualizado na planilha!', { id: 'update-client' });
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setEditingClient(null);
      }
    } catch (error) {
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        const firstError = (error as any).errors[0]?.message || 'Erro de valida\u00E7\u00E3o';
        toast.error(`Falha na valida\u00E7\u00E3o: ${firstError}`, { id: 'update-client' });
      } else {
        console.error('Update client error:', error);
        toast.error('Erro ao atualizar cliente', { id: 'update-client' });
      }
    }
  };

  const handleSyncManual = async () => {
    setLoading(true);
    toast.loading('Puxando dados da planilha...', { id: 'sync-manual' });
    try {
      const [p, c, o, m, cr] = await Promise.all([
        dataService.getAllProducts(),
        dataService.getClients(profile?.name, profile?.role === 'admin'),
        dataService.getOrdersFromSheets(),
        dataService.getMetas(profile?.name || ''),
        dataService.getCartsFromSheets()
      ]);
      setClients(c || []);
      setSheetOrders(o || []);
      setSheetCarts(cr || []);
      setMeta(m);
      toast.success('Sincronização concluída!', { id: 'sync-manual' });
    } catch (e) {
      toast.error('Erro na sincronização', { id: 'sync-manual' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdminCustomId = () => {
    if (!profile) return;
    let cleaned = adminCustomId.trim();
    const match = cleaned.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      cleaned = match[1];
    }

    try {
      if (cleaned) {
        localStorage.setItem(`CUSTOM_SPREADSHEET_ID_${profile.regional || 'TIMON-MA'}`, cleaned);
        toast.success('ID da Planilha personalizado salvo com sucesso!');
      } else {
        localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${profile.regional || 'TIMON-MA'}`);
        toast.success('Restaurado para a planilha padrão!');
      }
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar ID personalizado.');
    }
  };

  const handleResetAdminCustomId = () => {
    if (!profile) return;
    try {
      localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${profile.regional || 'TIMON-MA'}`);
      setAdminCustomId('');
      toast.success('Restaurado para a planilha padrão!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCustomApiUrl = () => {
    let cleaned = customApiUrl.trim().replace(/\/$/, '');
    try {
      if (cleaned) {
        localStorage.setItem('CUSTOM_API_URL', cleaned);
        toast.success('URL da API personalizada salva com sucesso!');
      } else {
        localStorage.removeItem('CUSTOM_API_URL');
        toast.success('Restaurado para a API padrão!');
      }
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar URL da API.');
    }
  };

  const handleResetCustomApiUrl = () => {
    try {
      localStorage.removeItem('CUSTOM_API_URL');
      setCustomApiUrl('');
      toast.success('Restaurado para a API padrão!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportOrder = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    
    // Group items by manufacturer
    const grouped: Record<string, any[]> = {};
    order.items.forEach(item => {
      const mfg = item.manufacturer || 'Outros';
      if (!grouped[mfg]) grouped[mfg] = [];
      grouped[mfg].push(item);
    });

    const data: any[] = [
      ['PEDIDO Nº', order.id],
      ['CLIENTE', client?.name || 'Não Identificado'],
      ['CNPJ', client?.cnpj || ''],
      ['DATA', new Date(order.date).toLocaleString()],
      ['TOTAL', formatCurrency(order.total)],
      [],
      ['FABRICANTE', 'PRODUTO', 'QUANTIDADE', 'PREÇO UN.', 'TOTAL']
    ];

    Object.entries(grouped).forEach(([mfg, items]) => {
      items.forEach(item => {
        data.push([
          mfg,
          item.description,
          item.quantity,
          item.finalPrice,
          item.quantity * item.finalPrice
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `Pedido_${order.id}.xlsx`);
    toast.success('Excel gerado com sucesso!');
  };

  const refreshData = async () => {
    setLoading(true);
    const [clientsData, metaData, allMetasData, sheetOrdersData, sheetCartsData] = await Promise.all([
      dataService.getClients(profile?.name, profile?.role === 'admin'),
      dataService.getMetas(profile?.name || ''),
      profile?.role === 'admin' ? dataService.getAllMetas() : Promise.resolve([]),
      dataService.getOrdersFromSheets(),
      dataService.getCartsFromSheets()
    ]);
    setClients(clientsData || []);
    setMeta(metaData);
    setAllMetas(allMetasData);
    setSheetOrders(sheetOrdersData || []);
    setSheetCarts(sheetCartsData || []);
    setLoading(false);
    toast.success('Dados atualizados!');
  };

  const stats = {
    totalOrders: orders.length,
    totalVendido: orders.reduce((sum, o) => sum + o.total, 0),
    activeClients: clients.length,
    meta: meta?.valor || 5000,
  };

  const progress = Math.min(100, (stats.totalVendido / stats.meta) * 100);

  // Ranking calculation
  const ranking = useMemo(() => {
    const sellers: Record<string, { name: string, total: number, orders: number }> = {};
    orders.forEach(o => {
      if (!sellers[o.seller]) {
        sellers[o.seller] = { name: o.seller, total: 0, orders: 0 };
      }
      sellers[o.seller].total += o.total;
      sellers[o.seller].orders += 1;
    });
    return Object.values(sellers).sort((a, b) => b.total - a.total);
  }, [orders]);

  // Regional calculation
  const regionalStats = useMemo(() => {
    const regionals: Record<string, { name: string, total: number, orders: number, clients: Set<string> }> = {};
    orders.forEach(o => {
      const client = clients.find(c => c.id === o.clientId);
      const reg = getRegionalLabel(client?.regional);
      if (!regionals[reg]) {
        regionals[reg] = { name: reg, total: 0, orders: 0, clients: new Set() };
      }
      regionals[reg].total += o.total;
      regionals[reg].orders += 1;
      regionals[reg].clients.add(o.clientId);
    });
    return Object.values(regionals).sort((a, b) => b.total - a.total);
  }, [orders, clients]);

  // Top products calculation
  const topProducts = useMemo(() => {
    const products: Record<string, { description: string, total: number, quantity: number }> = {};
    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          if (!products[item.description]) {
            products[item.description] = { description: item.description, total: 0, quantity: 0 };
          }
          products[item.description].total += (item.quantity * item.finalPrice);
          products[item.description].quantity += item.quantity;
        });
      }
    });
    return Object.values(products).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [orders]);

  const productsInOffers = useMemo(() => {
    // This would ideally come from dataService, but we'll filter from products if available
    // For now, we'll use the items from orders that are marked as offers
    const offers = new Set<string>();
    orders.forEach(o => {
      o.items.forEach(item => {
        if (item.type === 'offer') offers.add(item.description);
      });
    });
    return Array.from(offers);
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/')} 
              className="p-2 bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </motion.button>
            <img src="/logo.svg" alt="Logo" className="w-8 h-8 brightness-0 invert" />
            <h1 className="text-white font-bold text-lg">
              {profile?.role === 'admin' ? 'Painel Administrativo' : 'Meu Painel'}
            </h1>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
            whileTap={{ scale: 0.9 }}
            onClick={refreshData} 
            className="p-2 bg-white/20 rounded-full text-white transition-colors"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </motion.button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1E1E1E] sticky top-[72px] z-30 shadow-sm overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex min-w-max">
          {[
            { id: 'relatorio', label: '📈 Relatório', icon: TrendingUp },
            { id: 'inativos', label: '⚠️ Inativos', icon: AlertTriangle },
            { id: 'produtos', label: '🏆 Produtos', icon: Package },
            { id: 'regional', label: '🌍 Regional', icon: MapPin, adminOnly: true },
            { id: 'ranking', label: '🥇 Ranking', icon: Trophy, adminOnly: true },
            { id: 'metas', label: '🎯 Metas', icon: Target, adminOnly: true },
            { id: 'carrinhos', label: '🛒 Carrinhos', icon: Sparkles },
            { id: 'sincronizacao', label: '🔄 Sincronização', icon: RefreshCw },
          ].map(tab => {
            if (tab.adminOnly && profile?.role !== 'admin') return null;
            return (
              <motion.button 
                key={tab.id}
                whileHover={{ backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)") }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
                  activeTab === tab.id ? "text-orange-600 border-orange-600" : "text-gray-400 border-transparent"
                )}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <main className="p-4 max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Gerando relatório...</p>
          </div>
        ) : (
          <>
            {activeTab === 'relatorio' && (
              <div className="space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-2xl font-black text-orange-600">{stats.totalOrders}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Pedidos no Mês</p>
                  </div>
                  <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-2xl font-black text-orange-600">{formatCurrency(stats.totalVendido)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Total Vendido</p>
                  </div>
                </div>

                {/* Meta Progress */}
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Meta do Mês</h3>
                      <p className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(stats.meta)}</p>
                    </div>
                    <p className="text-2xl font-black text-orange-600">{progress.toFixed(0)}%</p>
                  </div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] rounded-full"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB") }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                  >
                    <Share2 size={18} /> WhatsApp
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB") }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                  >
                    <Download size={18} /> Copiar
                  </motion.button>
                </div>

                {/* Recent Orders */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pedidos Recentes</h3>
                    <motion.button whileHover={{ x: 3 }} whileTap={{ scale: 0.95 }} className="text-orange-600 text-xs font-bold transition-transform">Ver todos</motion.button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {orders.slice(0, 10).map((order, index) => (
                      <motion.div 
                        key={`${order.id}-${index}`} 
                        whileHover={{ backgroundColor: (darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)") }}
                        onClick={() => setSelectedOrder(order)}
                        className="p-4 flex justify-between items-center cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{order.clientName}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(order.date).toLocaleDateString('pt-BR')} • {order.seller}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-600">{formatCurrency(order.total)}</p>
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                            order.status === 'Novo' ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                          )}>
                            {order.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ranking' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ranking de Vendedores</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {ranking.map((seller, index) => (
                    <div key={index} className="p-4 flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                        index === 0 ? "bg-yellow-100 text-yellow-600" : 
                        index === 1 ? "bg-gray-100 text-gray-600" :
                        index === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-50 text-gray-400"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{seller.name}</p>
                        <p className="text-[10px] text-gray-400">{seller.orders} pedidos</p>
                      </div>
                      <p className="text-sm font-black text-orange-600">{formatCurrency(seller.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'metas' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Acompanhamento de Metas</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {allMetas.map((m, index) => {
                    const sellerTotal = orders.filter(o => o.seller.toLowerCase() === m.vendedor.toLowerCase()).reduce((sum, o) => sum + o.total, 0);
                    const prog = Math.min(100, (sellerTotal / m.valor) * 100);
                    return (
                      <div key={index} className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{m.vendedor}</p>
                          <p className="text-xs font-black text-orange-600">{prog.toFixed(1)}%</p>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>{formatCurrency(sellerTotal)}</span>
                          <span>Meta: {formatCurrency(m.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'regional' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Desempenho por Regional</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {regionalStats.map((reg, index) => (
                    <div key={index} className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{reg.name}</p>
                          <p className="text-[10px] text-gray-400">{reg.orders} pedidos • {reg.clients.size} clientes</p>
                        </div>
                        <p className="text-sm font-black text-orange-600">{formatCurrency(reg.total)}</p>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(reg.total / stats.totalVendido) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'produtos' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Top 20 Produtos Mais Vendidos</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {topProducts.map((prod, index) => (
                    <div key={index} className="p-4 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{prod.description}</p>
                        <p className="text-[10px] text-gray-400">{prod.quantity} unidades</p>
                      </div>
                      <p className="text-sm font-black text-orange-600">{formatCurrency(prod.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client Edit Modal */}
            <AnimatePresence>
              {editingClient && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-lg">Editar Cliente</h3>
                      <button onClick={() => setEditingClient(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nome Fantasia</label>
                        <input 
                          type="text" 
                          value={editingClient.tradeName || ''} 
                          onChange={(e) => setEditingClient({...editingClient, tradeName: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 placeholder:font-normal"
                          placeholder="Nome da Loja"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">CNPJ</label>
                        <input 
                          type="text" 
                          value={editingClient.cnpj || ''} 
                          onChange={(e) => setEditingClient({...editingClient, cnpj: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cidade</label>
                          <input 
                            type="text" 
                            value={editingClient.city || ''} 
                            onChange={(e) => setEditingClient({...editingClient, city: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Estado</label>
                          <input 
                            type="text" 
                            value={editingClient.state || ''} 
                            onChange={(e) => setEditingClient({...editingClient, state: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vendedor Responsável</label>
                        <input 
                          type="text" 
                          value={editingClient.seller || ''} 
                          onChange={(e) => setEditingClient({...editingClient, seller: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Email</label>
                        <input 
                          type="email" 
                          value={editingClient.email || ''} 
                          onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Celular / WhatsApp</label>
                        <input 
                          type="text" 
                          value={editingClient.phone || ''} 
                          onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setEditingClient(null)}
                        className="flex-1 py-4 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleUpdateClient(editingClient)}
                        className="flex-1 py-4 text-sm font-black text-white bg-gradient-to-r from-[#FF6B00] to-[#F06292] rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Salvar na Planilha
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Order Details Modal */}
            <AnimatePresence>
              {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                  >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleExportOrder(selectedOrder)}
                          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                          title="Exportar Excel"
                        >
                          <Download size={20} />
                        </button>
                        <div>
                          <h3 className="font-black text-lg">Detalhes do Pedido</h3>
                          <p className="text-xs opacity-80">#{selectedOrder.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedOrder(null)}
                        className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedOrder.clientName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {new Date(selectedOrder.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendedor</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedOrder.seller}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                          <span className="text-[10px] font-black px-2 py-1 bg-orange-100 text-orange-600 rounded-full uppercase">
                            {selectedOrder.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens do Pedido</p>
                        <div className="space-y-3">
                          {selectedOrder.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                              <div className="min-w-0 flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.description}</p>
                                  {item.type === 'offer' && (
                                    <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Oferta</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500">{item.quantity}x {formatCurrency(item.finalPrice)}</p>
                              </div>
                              <p className="text-xs font-black text-orange-600 whitespace-nowrap">
                                {formatCurrency(item.quantity * item.finalPrice)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Offer Checklist */}
                      {productsInOffers.length > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                          <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Sparkles size={12} /> Checklist de Ofertas
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {productsInOffers.slice(0, 5).map((offerDesc, i) => {
                              const bought = selectedOrder.items.some(item => item.description === offerDesc);
                              return (
                                <div key={i} className="flex items-center justify-between text-[10px]">
                                  <span className={cn("truncate pr-4", bought ? "text-gray-900 dark:text-white font-bold" : "text-gray-400")}>
                                    {offerDesc}
                                  </span>
                                  {bought ? (
                                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                  ) : (
                                    <AlertCircle size={14} className="text-gray-300 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {selectedOrder.observation && (
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Observação</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl italic">
                            "{selectedOrder.observation}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Total do Pedido</p>
                        <p className="text-2xl font-black text-orange-600">{formatCurrency(selectedOrder.total)}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {activeTab === 'inativos' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Clientes sem Pedidos (30+ dias)</h3>
                </div>
                <div className="p-8 text-center text-gray-400">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Todos os clientes estão ativos!</p>
                </div>
              </div>
            )}

            {activeTab === 'sincronizacao' && (
              <div className="space-y-6">
                {/* Status Sheet */}
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-black text-lg text-gray-900 dark:text-white">Status da Conexão</h3>
                      <p className="text-xs text-gray-500">Google Sheets API</p>
                    </div>
                    {sheetsStatus?.connected || sheetsStatus?.ok ? (
                      <div className="flex items-center gap-2 bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} /> Conectado
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <AlertCircle size={12} /> Desconectado
                      </div>
                    )}
                  </div>

                  {sheetsStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Spreadsheet ID</p>
                        <p className="text-xs font-mono break-all">{sheetsStatus.spreadsheetId}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Célula de Teste</p>
                        <p className="text-xs">{sheetsStatus.testValue || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {sheetsStatus?.spreadsheetInfo?.sheets && (
                    <div className="mb-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Abas Detectadas na Planilha</p>
                      <div className="flex flex-wrap gap-2">
                        {sheetsStatus.spreadsheetInfo.sheets.map((s: string) => (
                          <span key={s} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-[9px] font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personalizar Planilha da Regional */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800/80 mb-6">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">🔌 Conectar sua própria planilha ({profile?.regional || 'TIMON-MA'})</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                      Se você quer que este aplicativo se conecte à sua própria cópia da planilha, cole o link ou ID dela abaixo. Lembre-se de compartilhá-la com o e-mail do robô como "Editor".
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="ID ou Link do Google Sheets"
                        value={adminCustomId}
                        onChange={(e) => setAdminCustomId(e.target.value)}
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveAdminCustomId}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                        >
                          Salvar
                        </button>
                        {localStorage.getItem(`CUSTOM_SPREADSHEET_ID_${profile?.regional || 'TIMON-MA'}`) && (
                          <button
                            onClick={handleResetAdminCustomId}
                            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                          >
                            Resetar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personalizar URL do Servidor Backend */}
                  <div className="bg-orange-50/50 dark:bg-orange-950/10 p-5 rounded-2xl border border-orange-100/50 dark:border-orange-900/30 mb-6 font-sans">
                    <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase mb-1">⚙️ Servidor Backend & Integração de Fotos (Evita Erro 405)</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                      Se o seu site está hospedado de forma estática (como o link <code>workers.dev</code>), ele não possui servidor para processar gravação direta de imagens na planilha. 
                      Para resolver isso de forma 100% transparente, o sistema agora <strong>faz um redirecionamento inteligente automático</strong> para o servidor ativo na Cloud Run da AI Studio, garantindo que o envio de imagens funcione perfeitamente!
                    </p>
                    <div className="text-[10px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2.5 rounded-xl mb-3 flex flex-col gap-1">
                      <span className="font-bold text-gray-500">API Ativa no Momento:</span>
                      <code className="text-orange-600 dark:text-orange-400 select-all break-all">{getApiUrl() || '(Mesma Origem / Localhost)'}</code>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Ex: https://vendas-hbn1.netlify.app (Se desejar usar Netlify próprio)"
                        value={customApiUrl}
                        onChange={(e) => setCustomApiUrl(e.target.value)}
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveCustomApiUrl}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Salvar URL
                        </button>
                        {localStorage.getItem('CUSTOM_API_URL') && (
                          <button
                            onClick={handleResetCustomApiUrl}
                            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
                          >
                            Resetar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSyncManual}
                    className="w-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                  >
                    <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                    SINCRONIZAR TUDO AGORA
                  </button>
                </div>

                {/* Sheets Orders */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pedidos na Planilha ({sheetOrders.length})</h3>
                    <button onClick={() => toast.info(`Total de ${sheetOrders.length} pedidos encontrados.`)} className="text-[10px] text-orange-600 font-bold hover:underline">Ver Detalhes</button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
                    {sheetOrders.length === 0 ? (
                      <div className="p-10 text-center text-gray-400 italic">Nenhum pedido encontrado na planilha.</div>
                    ) : (
                      sheetOrders.map((o, idx) => (
                        <div key={idx} className="p-4 flex justify-between items-center bg-gray-50/30 dark:bg-gray-800/10 hover:bg-gray-100/50 transition-colors">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{o.clientName}</p>
                            <p className="text-[10px] text-gray-400">{o.date} • {o.seller}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-orange-600">{formatCurrency(o.total)}</p>
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded uppercase">{o.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Client List for Quick Edit */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Lista de Clientes (Planilha)</h3>
                    <p className="text-[10px] font-bold text-gray-400">{clients.length} cadastrados</p>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {clients.map((c) => (
                      <div key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{c.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase line-clamp-1">{c.city} - {c.state} • {c.seller}</p>
                        </div>
                        <button 
                          onClick={() => setEditingClient(c)}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        >
                          <MapPin size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'carrinhos' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-sm border border-orange-100 dark:border-orange-900/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 dark:text-white">Clientes com Carrinho</h3>
                      <p className="text-xs text-gray-500">Puxado diretamente da planilha ({sheetCarts.length} encontrados)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {sheetCarts.length === 0 ? (
                      <div className="p-16 text-center">
                        <Package size={48} className="mx-auto mb-4 text-gray-200" />
                        <p className="text-gray-400 italic">Nenhum carrinho pendente encontrado na planilha.</p>
                      </div>
                    ) : (
                      sheetCarts.map((cart, idx) => (
                        <div key={idx} className="p-5 flex justify-between items-center bg-gray-50/30 dark:bg-gray-800/10">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{cart.clientName}</p>
                            <div className="flex items-center gap-4">
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Package size={10} /> {cart.itemsCount} itens
                              </p>
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <RefreshCw size={10} /> {cart.updatedAt}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-orange-600">{formatCurrency(cart.total)}</p>
                            <button className="mt-2 text-[10px] font-black text-white bg-orange-500 px-3 py-1 rounded-full uppercase shadow-sm">
                              Ver Detalhes
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
