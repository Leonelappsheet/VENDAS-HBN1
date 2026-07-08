import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, 
  Calendar, ArrowLeft, Download, Filter,
  Layers, Package, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { Order, Product, Client } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const allOrders = await dataService.getOrders();
        setOrders(allOrders);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Analytics Logic
  const filteredOrders = orders.filter(order => {
    if (profile?.role === 'vendedor' || profile?.role === 'promotor') {
      return order.seller === profile.name;
    }
    return true;
  });

  const totalSales = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const orderCount = filteredOrders.length;
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  
  // Daily Sales Analysis
  const salesByDate = filteredOrders.reduce((acc: any, curr) => {
    const date = new Date(curr.date).toLocaleDateString('pt-BR');
    acc[date] = (acc[date] || 0) + curr.total;
    return acc;
  }, {});

  const salesData = Object.keys(salesByDate).map(date => ({
    date,
    total: Math.round(salesByDate[date] * 100) / 100
  })).slice(-15);

  // Category Distribution
  const categoryData = filteredOrders.reduce((acc: any, order) => {
    order.items.forEach(item => {
      const cat = item.category || 'Outros';
      acc[cat] = (acc[cat] || 0) + (item.finalPrice * item.quantity);
    });
    return acc;
  }, {});

  const pieData = Object.keys(categoryData).map(name => ({
    name,
    value: Math.round(categoryData[name] * 100) / 100
  }));

  const COLORS = ['#FF6B00', '#F06292', '#4CAF50', '#2196F3', '#9C27B0', '#FFEB3B'];

  // Regional Sales (for Admin)
  const regionalSales = filteredOrders.reduce((acc: any, curr) => {
    const regional = curr.pdfUrl ? curr.seller : 'Desconhecido'; // Using seller as proxy for now if regional not in order
    acc[regional] = (acc[regional] || 0) + curr.total;
    return acc;
  }, {});

  const regionalData = Object.keys(regionalSales).map(name => ({
    name,
    total: Math.round(regionalSales[name] * 0.1) // Mocking some value for variety
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF6F0] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-orange-600 font-bold animate-pulse uppercase tracking-widest text-sm">CARREGANDO ANALYTICS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-3 hover:bg-brand-orange/10 rounded-2xl text-brand-orange transition-colors shrink-0"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="w-10 h-10 bg-brand-orange text-white rounded-xl flex items-center justify-center p-1.5 shadow-md shadow-brand-orange/20 shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-brand-blue tracking-tight leading-none">PAINEL ANALÍTICO</h1>
              <p className="text-xs text-gray-500 font-medium mt-1">{profile?.role === 'admin' ? 'Visão Geral da Empresa' : `Minhas Vendas: ${profile?.name}`}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-gray-100 p-1 rounded-2xl">
              {(['7d', '30d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    timeRange === range ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {range === '7d' ? '7 DIAS' : range === '30d' ? '30 DIAS' : 'TUDO'}
                </button>
              ))}
            </div>
            <button className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
              <Download size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Faturamento Total', value: totalSales, icon: <DollarSign size={24} />, color: 'bg-orange-500', isCurrency: true },
            { label: 'Total de Pedidos', value: orderCount, icon: <ShoppingBag size={24} />, color: 'bg-pink-500', isCurrency: false },
            { label: 'Ticket M\u00E9dio', value: avgOrderValue, icon: <TrendingUp size={24} />, color: 'bg-blue-500', isCurrency: true },
            { label: 'Clientes Atendidos', value: Array.from(new Set(filteredOrders.map(o => o.clientId))).length, icon: <Users size={24} />, color: 'bg-green-500', isCurrency: false },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-orange-900/5 border border-white flex items-center justify-between group overflow-hidden relative"
            >
              <div className="relative z-10">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900 leading-none">
                  {stat.isCurrency ? `R$ ${stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : stat.value}
                </p>
              </div>
              <div className={`p-4 ${stat.color} text-white rounded-3xl group-hover:scale-110 transition-transform relative z-10`}>
                {stat.icon}
              </div>
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${stat.color} opacity-5 rounded-full blur-2xl group-hover:scale-150 transition-transform`} />
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Sales Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                  <TrendingUp size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Evolu\u00E7\u00E3o de Vendas</h3>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                    itemStyle={{ fontWeight: 800, color: '#FF6B00' }}
                    cursor={{ stroke: '#FF6B00', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#FF6B00" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-pink-100 text-pink-600 rounded-2xl">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Por Categoria</h3>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
             <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Produtos Top</h3>
              </div>
            </div>
            <div className="space-y-4">
              {filteredOrders.flatMap(o => o.items)
                .reduce((acc: any, item) => {
                  const existing = acc.find((i: any) => i.id === item.id);
                  if (existing) {
                    existing.quantity += item.quantity;
                    existing.total += (item.finalPrice * item.quantity);
                  } else {
                    acc.push({ ...item, total: item.finalPrice * item.quantity });
                  }
                  return acc;
                }, [])
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 5)
                .map((product: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-orange-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-gray-400 group-hover:text-orange-500 transition-colors">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800 line-clamp-1">{product.description}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase">{product.quantity} unidades</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-orange-600">
                      R$ {product.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
            </div>
          </div>

           {/* Regional distribution or similar */}
           <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
             <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
                   <MapPin size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Status de Pedidos</h3>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Novo', count: filteredOrders.filter(o => o.status === 'Novo').length },
                    { name: 'Confirmado', count: filteredOrders.filter(o => o.status === 'Confirmado').length },
                    { name: 'Entregue', count: filteredOrders.filter(o => o.status === 'Entregue').length },
                    { name: 'Cancelado', count: filteredOrders.filter(o => o.status === 'Cancelado').length },
                  ]}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]} fill="#F06292" barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
