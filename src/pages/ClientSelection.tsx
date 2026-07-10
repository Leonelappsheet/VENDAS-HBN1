import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Client } from '../types';
import { Search, LogOut, LayoutDashboard, FileUp, MapPin, User, Moon, Sun, ChevronRight, Store, Calendar, Settings, Lock, Eye, EyeOff, Navigation, ShoppingCart, RefreshCw, Camera, Phone, Mail, FileText, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Visit } from '../types';
import { getRegionalLabel } from '../constants/regionals';

import { ConfigWarning } from '../components/ConfigWarning';

export default function ClientSelection() {
  const { profile, logout, selectedClient, setSelectedClient } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [sheetCarts, setSheetCarts] = useState<any[]>([]);
  const [firestoreCarts, setFirestoreCarts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [showProfile, setShowProfile] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState<Client | null>(null);
  const [showMapModal, setShowMapModal] = useState<Client | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<Client | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    if (profile?.role === 'promotor') {
      navigate('/catalog');
    }
  }, [profile, navigate]);

  // Sync navigation on external/real-time client selection
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
      navigate('/catalog');
    }
  }, [selectedClient, navigate]);

  useEffect(() => {
    if (!profile) return;
    
    setLoading(true);
    const fetchSheetCarts = async () => {
      try {
        const sheetC = await dataService.getCartsFromSheets();
        setSheetCarts(sheetC || []);
      } catch (e) {
        console.error('Error fetching sheet carts:', e);
      }
    };
    fetchSheetCarts();

    const cartInterval = setInterval(fetchSheetCarts, 30000);

    const unsubFirestoreCarts = dataService.subscribeAllCarts(profile.uid, (carts) => {
      setFirestoreCarts(carts || []);
    });

    const unsubscribe = dataService.subscribeClients(
      profile.name, 
      profile.role === 'admin',
      (data) => {
        setClients(data);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unsubFirestoreCarts();
      clearInterval(cartInterval);
    };
  }, [profile]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('VENDAS_dark', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('VENDAS_dark', '0');
    }
  }, [darkMode]);

  const filteredClients = clients.filter(c => {
    if (!c) return false;
    const query = search.toLowerCase();
    const name = String(c.name || '').toLowerCase();
    const tradeName = String(c.tradeName || '').toLowerCase();
    const cnpj = String(c.cnpj || '');
    const city = String(c.city || '').toLowerCase();
    const seller = String(c.seller || '').toLowerCase();
    return (
      name.includes(query) ||
      tradeName.includes(query) ||
      cnpj.includes(query) ||
      city.includes(query) ||
      seller.includes(query)
    );
  });

  const handleSelectClient = async (client: Client) => {
    localStorage.setItem('selectedClient', JSON.stringify(client));
    await setSelectedClient(client);
    navigate('/catalog');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, client: Client) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512000) {
      toast.error("Por favor, escolha uma foto menor que 500KB para melhor desempenho.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const toastId = toast.loading("Salvando foto do cliente...");
      const success = await dataService.updateClientPhoto(client.id, base64String);
      if (success) {
        toast.success("Foto salva com sucesso!", { id: toastId });
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, photo: base64String } : c));
        setShowDetailsModal(prev => prev && prev.id === client.id ? { ...prev, photo: base64String } : prev);
      } else {
        toast.error("Erro ao salvar a foto.", { id: toastId });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="bg-brand-blue p-4 pt-safe sticky top-0 z-50 shadow-lg border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {/* Star-like logo icon */}
              <div className="w-10 h-10 bg-brand-orange text-white rounded-xl flex items-center justify-center p-1.5 shadow-md shadow-brand-orange/20">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-display font-bold text-base leading-tight tracking-tight uppercase">
                  Olá, {profile?.name}
                </h2>
                <span className="bg-white/15 text-white/90 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {getRegionalLabel(profile?.regional)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowProfile(true)}
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <Settings size={20} />
              </motion.button>
              {profile?.role === 'admin' && (
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/admin')} 
                  className="p-2 bg-white/15 rounded-full text-white transition-colors"
                >
                  <LayoutDashboard size={20} />
                </motion.button>
              )}
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/import')} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <FileUp size={20} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setDarkMode(!darkMode)} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  setLoading(true);
                  const [c, cr] = await Promise.all([
                    dataService.getClients(profile?.name, profile?.role === 'admin'),
                    dataService.getCartsFromSheets()
                  ]);
                  setClients(c || []);
                  setSheetCarts(cr || []);
                  setLoading(false);
                  toast.success('Dados sincronizados!');
                }}
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
                title="Sincronizar com Planilha"
              >
                <RefreshCw size={20} className={cn(loading && "animate-spin")} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={logout} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={18} />
            <input
              type="search"
              placeholder="Buscar por nome, CNPJ, cidade, vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/15 border border-white/30 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/25 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        <ConfigWarning />
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin"></div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
                {filteredClients.map((client, index) => {
                  const cartForClientSheet = sheetCarts?.find(cart => {
                    if (!cart) return false;
                    
                    const cartIdStr = cart.id ? String(cart.id).trim().toLowerCase() : '';
                    const clientIdStr = client.id ? String(client.id).trim().toLowerCase() : '';
                    if (cartIdStr && clientIdStr && cartIdStr === clientIdStr) {
                      return true;
                    }
                    
                    if (cart.clientName) {
                      const cartNameStr = String(cart.clientName).trim().toLowerCase();
                      const clientNameStr = client.name ? String(client.name).trim().toLowerCase() : '';
                      const clientTradeStr = client.tradeName ? String(client.tradeName).trim().toLowerCase() : '';
                      
                      if (clientNameStr && cartNameStr === clientNameStr) return true;
                      if (clientTradeStr && cartNameStr === clientTradeStr) return true;
                    }
                    
                    return false;
                  });

                  const cartForClientFirestore = firestoreCarts?.find(cart => {
                    if (!cart || !cart.clientId) return false;
                    const cartClientIdStr = String(cart.clientId).trim().toLowerCase();
                    const clientIdStr = client.id ? String(client.id).trim().toLowerCase() : '';
                    return cartClientIdStr && clientIdStr && cartClientIdStr === clientIdStr;
                  });
                  const sheetItemCount = Number(cartForClientSheet?.itemsCount) || 0;
                  const firestoreItemCount = Number(cartForClientFirestore?.items?.length) || 0;
                  const itemCount = sheetItemCount + firestoreItemCount;
                  const hasCart = itemCount > 0;

                  return (
                    <motion.div
                      key={`${client.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setShowDetailsModal(client)}
                      whileHover={{ scale: 1.01, backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)" }}
                      whileTap={{ scale: 0.99 }}
                      className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-brand-orange transition-all cursor-pointer flex items-start gap-4 group"
                    >
                      <div className="w-12 h-12 bg-brand-orange/5 dark:bg-brand-orange/10 rounded-xl flex items-center justify-center text-brand-orange shrink-0 relative overflow-hidden">
                        {client.photo ? (
                          <img src={client.photo} alt={client.tradeName || client.name} className="w-full h-full object-cover" />
                        ) : (
                          <Store size={22} />
                        )}
                        {hasCart && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg animate-pulse z-10" title="Venda Iniciada">
                            <ShoppingCart size={11} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-slate-900 dark:text-white truncate text-base">
                            {client.tradeName || client.name}
                          </h3>
                          {hasCart && (
                            <span className="bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-in fade-in zoom-in">
                              <ShoppingCart size={10} /> {itemCount}
                            </span>
                          )}
                        </div>
                    {client.tradeName && client.name !== client.tradeName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{client.name}</p>
                    )}
                    {client.address && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-brand-blue/5 dark:bg-brand-blue/20 text-brand-blue dark:text-brand-blue-light rounded-md">
                        ID {client.id}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-brand-orange/5 dark:bg-brand-orange/20 text-brand-orange rounded-md">
                        {client.cnpj}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                        {client.seller}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-md">
                        {client.city}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVisitModal(client);
                      }}
                      className="p-2 bg-brand-orange/5 dark:bg-brand-orange/10 text-brand-orange rounded-full hover:bg-brand-orange/10 transition-colors"
                      title="Registrar Visita"
                    >
                      <Calendar size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMapModal(client);
                      }}
                      className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                      title="Ver no Mapa"
                    >
                      <MapPin size={18} />
                    </button>
                  </div>
                  <ChevronRight className="self-center text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Visit Modal */}
      <AnimatePresence>
        {showVisitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto text-orange-600">
                  <Calendar size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Registrar Visita</h3>
                <p className="text-sm text-gray-500">{showVisitModal.tradeName || showVisitModal.name}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <MapPin size={14} />
                  <span>Localização Automática</span>
                </div>
                <p className="text-[10px] text-gray-400 italic">Coordenadas GPS serão salvas com o registro da visita para auditoria.</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowVisitModal(null)}
                  className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    if (!profile) return;
                    setLoading(true);
                    
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      const visit: Visit = {
                        id: 'VIS' + Date.now(),
                        name: showVisitModal.tradeName || showVisitModal.name,
                        cnpj: showVisitModal.cnpj,
                        address: showVisitModal.address,
                        city: showVisitModal.city,
                        state: showVisitModal.state,
                        timestamp: Date.now(),
                        seller: profile.name,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                      };
                      
                      await dataService.saveVisit(visit);
                      toast.success('Visita registrada com sucesso!');
                      setShowVisitModal(null);
                      setLoading(false);
                    }, (err) => {
                      console.error('Geolocation error:', err);
                      toast.error('Erro ao obter localização. Verifique as permissões.');
                      setLoading(false);
                    });
                  }}
                  className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-transform"
                >
                  Confirmar
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {showMapModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-black text-lg">Localização do Cliente</h3>
                  <p className="text-xs opacity-80">{showMapModal.tradeName || showMapModal.name}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMapModal(null)} 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </motion.button>
              </div>
              
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(`${showMapModal.address}, ${showMapModal.city}, ${showMapModal.state}`)}`}
                  allowFullScreen
                ></iframe>
                <div className="absolute inset-0 bg-black/5 pointer-events-none" />
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-blue-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{showMapModal.address}</p>
                    <p className="text-xs text-gray-500">{showMapModal.city} - {showMapModal.state}</p>
                  </div>
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${showMapModal.address}, ${showMapModal.city}, ${showMapModal.state}`)}`;
                    window.open(url, '_blank');
                  }}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-transform"
                >
                  <Navigation size={20} /> Traçar Rota
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-gradient-to-r from-orange-500 to-pink-500 text-white flex justify-between items-center">
                <h3 className="font-black text-lg">Meu Perfil</h3>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowProfile(false); setIsChangingPassword(false); }} 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </motion.button>
              </div>

              <div className="p-6 space-y-6">
                {!isChangingPassword ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600">
                        <User size={32} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{profile?.name}</p>
                        <p className="text-sm text-gray-500">{profile?.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                          {profile?.role}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "white") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(true)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <Lock size={20} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Alterar Senha</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(239,68,68,0.1)" : "#fef2f2") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={logout}
                        className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold text-red-600">Sair da Conta</span>
                        </div>
                        <ChevronRight size={18} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Lock size={18} /> Alterar Senha
                    </h4>
                    
                    <div className="space-y-3">
                      {['current', 'new', 'confirm'].map((field) => (
                        <div key={field} className="relative">
                          <input
                            type={showPasswords[field as keyof typeof showPasswords] ? 'text' : 'password'}
                            placeholder={field === 'current' ? 'Senha Atual' : field === 'new' ? 'Nova Senha' : 'Confirmar Nova Senha'}
                            value={passwordData[field as keyof typeof passwordData]}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                          />
                          <motion.button 
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => setShowPasswords(prev => ({ ...prev, [field]: !prev[field as keyof typeof showPasswords] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPasswords[field as keyof typeof showPasswords] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </motion.button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(false)}
                        className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl transition-colors"
                      >
                        Voltar
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (passwordData.new !== passwordData.confirm) {
                            toast.error('As senhas não coincidem');
                            return;
                          }
                          toast.success('Senha alterada com sucesso!');
                          setIsChangingPassword(false);
                        }}
                        className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg"
                      >
                        Salvar
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Details Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-8"
            >
              {/* Header with gradient or cover */}
              <div className="relative p-6 bg-brand-blue text-white flex flex-col items-center pt-10">
                <button 
                  onClick={() => setShowDetailsModal(null)}
                  className="absolute right-4 top-4 w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
                
                {/* Client Photo upload/view */}
                <div className="relative group mb-4">
                  <div className="w-28 h-28 rounded-full border-4 border-white overflow-hidden bg-white/10 flex items-center justify-center text-white shadow-xl">
                    {showDetailsModal.photo ? (
                      <img src={showDetailsModal.photo} alt={showDetailsModal.tradeName || showDetailsModal.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store size={48} className="opacity-95" />
                    )}
                  </div>
                  
                  {/* Edit/Upload trigger */}
                  <label className="absolute bottom-0 right-0 p-2 bg-brand-orange text-white rounded-full shadow-lg border-2 border-white cursor-pointer hover:bg-brand-orange-light transition-colors flex items-center justify-center">
                    <Camera size={16} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handlePhotoChange(e, showDetailsModal)} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <h3 className="font-display font-black text-xl text-center leading-tight">
                  {showDetailsModal.tradeName || showDetailsModal.name}
                </h3>
                {showDetailsModal.tradeName && showDetailsModal.name !== showDetailsModal.tradeName && (
                  <p className="text-xs opacity-90 text-center mt-1 font-medium">{showDetailsModal.name}</p>
                )}
                <span className="bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mt-3 font-mono">
                  Código: {showDetailsModal.id}
                </span>
              </div>

              {/* Client Info Body */}
              <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {showDetailsModal.cnpj && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CNPJ / CPF</p>
                      <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">{showDetailsModal.cnpj}</p>
                    </div>
                  )}

                  {showDetailsModal.phone && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                        <Phone size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telefone</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{showDetailsModal.phone}</p>
                      </div>
                    </div>
                  )}

                  {showDetailsModal.email && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl flex items-center gap-3 col-span-1 sm:col-span-2">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                        <Mail size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 break-all">{showDetailsModal.email}</p>
                      </div>
                    </div>
                  )}

                  {showDetailsModal.buyer && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl col-span-1 sm:col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comprador / Contato</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{showDetailsModal.buyer}</p>
                    </div>
                  )}

                  {showDetailsModal.address && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl flex items-start gap-3 col-span-1 sm:col-span-2">
                      <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl mt-0.5">
                        <MapPin size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{showDetailsModal.address}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{showDetailsModal.city} - {showDetailsModal.state}</p>
                      </div>
                    </div>
                  )}

                  {showDetailsModal.seller && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vendedor Responsável</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{showDetailsModal.seller}</p>
                    </div>
                  )}

                  {showDetailsModal.regional && (
                    <div className="bg-slate-50 dark:bg-gray-800/40 p-3 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Regional</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{getRegionalLabel(showDetailsModal.regional)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row gap-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDetailsModal(null)}
                  className="flex-1 py-3 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl shadow-sm transition-all"
                >
                  Fechar
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleSelectClient(showDetailsModal);
                    setShowDetailsModal(null);
                  }}
                  className="flex-1 py-3 bg-brand-orange hover:bg-brand-orange-light text-white font-black rounded-xl shadow-lg shadow-brand-orange/25 flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={18} /> Fazer Pedido
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
