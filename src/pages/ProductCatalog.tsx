import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Product, Client, OrderItem, Favorite, Order, BannerMessage } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  Search, 
  ChevronLeft, 
  ShoppingCart, 
  Star, 
  Flame, 
  Sparkles, 
  Package, 
  X, 
  Plus, 
  Minus,
  Filter as FilterIcon,
  SlidersHorizontal,
  ArrowUpDown,
  History,
  Zap,
  Bell,
  CheckCircle2,
  AlertCircle,
  Camera,
  Globe,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  MessageCircle,
  Key,
  Hash,
  LogOut,
  TrendingUp,
  Settings,
  User,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  ClipboardList,
  ListPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { Toaster, toast } from 'sonner';
import { ConfigWarning } from '../components/ConfigWarning';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { OrderSchema } from '../lib/schemas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { getRegionalLabel } from '../constants/regionals';

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

const getManufacturerLogo = (name: string): string | null => {
  const normName = name.trim().toLowerCase();
  if (normName.includes('danone')) {
    return 'https://logos-world.net/wp-content/uploads/2020/07/Danone-Logo-2013.png';
  }
  if (normName.includes('unilever')) {
    return 'https://upload.wikimedia.org/wikipedia/pt/thumb/5/59/Logo_Unilever.svg/1920px-Logo_Unilever.svg.png';
  }
  if (normName.includes('kenvue') || normName.includes('johnson') || normName.includes('j&j')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Kenvue_logo.svg';
  }
  if (normName.includes('kimberly')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Kimberly-Clark_logo.svg/1280px-Kimberly-Clark_logo.svg.png';
  }
  if (normName.includes('omron')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/OMRON_Logo.svg/3840px-OMRON_Logo.svg.png';
  }
  return null;
};

const getProductImageUrl = (photoUrl: string | undefined | null): string => {
  if (!photoUrl) return `https://placehold.co/400x400/FFFFFF/CCCCCC?text=Sem+Foto`;
  let url = String(photoUrl).trim();
  if (!url || url === "" || url === "-" || url.toLowerCase() === "sem foto" || url.toLowerCase() === "sem_foto") {
    return `https://placehold.co/400x400/FFFFFF/CCCCCC?text=Sem+Foto`;
  }

  // Fix double schema prefixes (e.g., https://https://)
  url = url.replace(/^(https?:\/\/)+https?:\/\//i, 'https://');
  url = url.replace(/^https?:\/\/https?:\/\//i, 'https://');

  // Google Drive conversion (very common for shared assets)
  const driveMatch = url.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/uc\?(?:export=download&)?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  // Dropbox conversion
  if (url.includes('dropbox.com') && !url.includes('dl.dropboxusercontent.com')) {
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '?dl=1');
  }

  // Mixed content check: if on HTTPS but image is HTTP, proxy through weserv.nl
  if (url.startsWith('http://')) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=90&bg=white&fit=contain&w=500&h=500`;
  }

  return url;
};

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  isFavorite: boolean;
  isSold: boolean;
  profileRole?: string;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantityDirectly: (id: string, value: number) => void;
  onToggleFavorite: (product: Product) => void;
  onSetZoomImage: (product: Product) => void;
  onSetUpdatingImageProduct: (product: Product) => void;
}

const ProductCard = React.memo<ProductCardProps>(({
  product,
  cartQuantity,
  isFavorite,
  isSold,
  profileRole,
  onAddToCart,
  onUpdateQuantity,
  onSetQuantityDirectly,
  onToggleFavorite,
  onSetZoomImage,
  onSetUpdatingImageProduct,
}) => {
  const hasStock = product.stock > 0;
  const economy = product.salePrice - product.finalPrice;
  
  // Standardize discount using user's rule: 3rd digit 6+ rounds up, 5- stays down
  const calculatedDiscount = product.salePrice > 0 ? (economy / product.salePrice) * 100 : 0;
  const finalDiscount = applyCustomRounding(product.discount || calculatedDiscount);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className={cn(
        "bg-white dark:bg-[#1E1E1E] rounded-xl sm:rounded-[24px] overflow-hidden shadow-md group border border-transparent hover:border-orange-500/10 transition-all flex flex-col relative pb-2 sm:pb-3",
        !hasStock && "opacity-80"
      )}
    >
      {/* Top Badges */}
      <div className="absolute top-1.5 left-1.5 right-1.5 sm:top-3 sm:left-3 sm:right-3 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-0.5 sm:gap-1">
          {product.type === 'offer' && <span className="bg-orange-600 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full uppercase flex items-center gap-0.5 sm:gap-1 shadow-sm"><Flame size={8} className="sm:size-2.5" /> Oferta</span>}
          {product.type === 'new' && <span className="bg-purple-600 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full uppercase flex items-center gap-0.5 sm:gap-1 shadow-sm"><Sparkles size={8} className="sm:size-2.5" /> Novo</span>}
          {profileRole !== 'promotor' && isSold && <span className="bg-green-600 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full shadow-sm uppercase">Já Comprado</span>}
        </div>
        {profileRole !== 'promotor' && product.discountExpiryDate && (
          <div className="flex flex-col items-end gap-0.5 sm:gap-1">
            <div className="bg-white/90 backdrop-blur-sm text-orange-600 text-[6px] sm:text-[8px] font-black px-1 py-0.5 rounded-full border border-orange-100 shadow-sm flex items-center gap-0.5">
              <History size={6} className="sm:size-2" /> Expira: {new Date(product.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </div>
          </div>
        )}
      </div>

      {/* Product Image */}
      <div className="aspect-[4/4] w-full bg-white p-1.5 sm:p-4 relative cursor-zoom-in flex-none overflow-hidden flex items-center justify-center" onClick={() => onSetZoomImage(product)}>
        <img 
          src={getProductImageUrl(product.photo)} 
          alt={product.description} 
          loading="lazy"
          className="max-w-full max-h-full w-auto h-auto object-contain transition-all duration-500 group-hover:scale-110" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const originalUrl = product.photo || "";
            if (originalUrl && !target.src.includes('weserv.nl')) {
              target.src = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}&output=jpg&q=90&bg=white&fit=contain&w=500&h=500`;
            } else if (!target.src.includes('placehold.co')) {
              target.src = 'https://placehold.co/400x400/FFFFFF/DDDDDD?text=Foto+Indisponivel';
            }
          }}
        />
      </div>

      {/* Product Info Section */}
      <div className="px-1.5 py-2 sm:px-2.5 sm:py-2.5 flex-1 flex flex-col gap-1 sm:gap-1.5">
        {/* Header: Category and Utils */}
        <div className="flex justify-between items-center mb-0.5 sm:mb-1">
          {profileRole !== 'promotor' ? (
            <span className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-[#F472B6] uppercase tracking-wider">{product.category}</span>
          ) : <div />}
          {profileRole !== 'promotor' && (
            <div className="flex gap-1 sm:gap-1.5 animate-none">
              <motion.button 
                whileHover={{ scale: 1.2, color: "#EA580C" }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }} 
                className={cn("p-0.5 transition-all", isFavorite ? "text-orange-600" : "text-gray-300")}
              >
                <Star size={10} className="sm:size-[13px]" fill={isFavorite ? "currentColor" : "none"} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.2, color: "#4B5563" }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onSetUpdatingImageProduct(product); }}
                className="text-gray-300 hover:text-gray-600 transition-colors p-0.5"
              >
                <Camera size={10} className="sm:size-[13px]" />
              </motion.button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[10px] sm:text-[11px] md:text-[12px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[24px] sm:min-h-[28px] md:min-h-[32px] mb-0.5">
          {product.description}
        </h3>

        {/* Manufacturer */}
        <p className="text-[8px] sm:text-[9px] md:text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5 sm:mb-1 truncate">{product.manufacturer}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-1 sm:mb-1.5">
          <div className="flex items-center gap-0.5 bg-[#EEF2FF] dark:bg-blue-900/20 text-[#4F46E5] dark:text-blue-400 text-[7px] sm:text-[8px] md:text-[9px] font-bold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded border border-transparent shadow-sm">
            <Key size={6} className="text-[#FBBF24] sm:size-2" fill="#FBBF24" />
            {product.id}
          </div>
          {product.ean && (
            <div className="flex items-center gap-0.5 bg-[#FAF5FF] dark:bg-purple-900/20 text-[#9333EA] dark:text-purple-400 text-[7px] sm:text-[8px] md:text-[9px] font-bold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded border border-transparent shadow-sm truncate max-w-[45px] sm:max-w-[65px] md:max-w-[80px]">
              <span className="w-1 h-1 bg-[#9333EA] rounded-sm shrink-0 sm:w-1.5 sm:h-1.5" />
              <span className="truncate">{product.ean}</span>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-auto space-y-0.5">
          <div className="flex flex-col">
            {profileRole !== 'promotor' && economy > 0 && (
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-medium text-gray-400 dark:text-gray-500 line-through">
                De: {formatCurrency(product.salePrice)}
              </span>
            )}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-sm md:text-base lg:text-lg font-black text-[#FF6B00] whitespace-nowrap">
                {formatCurrency(product.finalPrice)}
              </span>
              {profileRole !== 'promotor' && finalDiscount > 0 && (
                <span className="bg-[#EF4444] text-white text-[7px] sm:text-[8px] md:text-[9.5px] font-black px-1 py-0.5 rounded-md shrink-0">
                  -{finalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%
                </span>
              )}
            </div>
          </div>
          
          {/* Savings Badge */}
          {profileRole !== 'promotor' && economy > 0 && (
            <div className="inline-flex items-center gap-0.5 bg-[#22C55E] text-white text-[7px] sm:text-[8px] md:text-[9px] font-black px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded-full shadow-sm mt-0.5 sm:mt-1 max-w-full">
              <Star size={6} className="sm:size-2 shrink-0" fill="currentColor" />
              <span className="truncate">POUPE {formatCurrency(economy)}</span>
            </div>
          )}

          <div className="flex flex-col gap-0.5 mt-1 sm:mt-1.5">
            <p className={cn("text-[7px] sm:text-[8px] md:text-[9px] font-bold", hasStock ? "text-gray-500 dark:text-gray-400" : "text-[#EF4444]")}>
              {hasStock ? `Est. ${product.stock}` : 'Sem estoque'}
            </p>
            {profileRole === 'promotor' && (
              <div className="flex items-center gap-0.5">
                <span className="text-[6px] sm:text-[8px] font-black text-gray-400 uppercase">Status:</span>
                <span className={cn(
                  "text-[6px] sm:text-[8px] font-black px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase",
                  product.type === 'offer' ? "bg-orange-100 text-orange-600" : product.type === 'new' ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600"
                )}>
                  {product.type === 'offer' ? 'Oferta' : product.type === 'new' ? 'Novo' : 'Normal'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-1.5 sm:px-2.5 mt-1 sm:mt-2">
        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-0.5 sm:p-1 shadow-inner border border-gray-100 dark:border-gray-700">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "#fee2e2" }} 
              whileTap={{ scale: 0.9 }} 
              onClick={() => onUpdateQuantity(product.id, -1)} 
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center text-red-600 rounded-lg transition-colors"
            >
              <Minus size={8} className="sm:size-[10px] md:size-[12px]" />
            </motion.button>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={cartQuantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  onSetQuantityDirectly(product.id, val);
                } else if (e.target.value === '') {
                  onSetQuantityDirectly(product.id, 0);
                }
              }}
              className="w-5 sm:w-8 text-center text-[8px] sm:text-[10px] md:text-xs font-black bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
            />
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "#dcfce7" }} 
              whileTap={{ scale: 0.9 }} 
              onClick={() => onUpdateQuantity(product.id, 1)} 
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center text-green-600 rounded-lg transition-colors"
            >
              <Plus size={8} className="sm:size-[10px] md:size-[12px]" />
            </motion.button>
          </div>
        ) : (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            disabled={!hasStock} 
            onClick={() => onAddToCart(product)} 
            className="w-full h-7 sm:h-8 md:h-10 bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white rounded-[8px] sm:rounded-[10px] md:rounded-[12px] text-[8px] sm:text-[9px] md:text-xs font-black shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-0.5 sm:gap-1 transition-all px-0.5"
          >
            <span className="truncate">ADICIONAR</span>
            <ShoppingCart size={8} className="sm:size-3.5 shrink-0" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});
ProductCard.displayName = 'ProductCard';

export default function ProductCatalog() {
  const { profile, logout, selectedClient, setSelectedClient } = useAuth();
  const navigate = useNavigate();
  const [headerHeight, setHeaderHeight] = useState(120);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    
    const handleResize = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    
    handleResize();
    
    const observer = new ResizeObserver(handleResize);
    observer.observe(headerRef.current);
    
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'produtos' | 'ofertas' | 'lancamentos'>('produtos');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]); // 'discount', 'no-discount', 'in-stock', 'out-stock', 'new'
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'discount' | 'stock' | 'az' | 'za' | 'recent'>('default');
  const [displayLimit, setDisplayLimit] = useState(32);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInputValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInputValue]);

  const cartKey = useMemo(() => {
    if (selectedClient) return `cart_${selectedClient.id}`;
    if (profile?.role === 'promotor') return `cart_promotor_${profile.uid}`;
    return 'cart_nz';
  }, [selectedClient, profile]);

  const [cart, setCart] = useState<OrderItem[]>(() => {
    try {
      const key = selectedClient 
        ? `cart_${selectedClient.id}` 
        : (profile?.role === 'promotor' ? `cart_promotor_${profile.uid}` : 'cart_nz');
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const lastSyncedCartRef = useRef<string>('');
  const saveCartTimeoutRef = useRef<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [pendingCarts, setPendingCarts] = useState<{clientId: string, items: OrderItem[], clientName?: string}[]>([]);
  const [showPendingCarts, setShowPendingCarts] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastOrderItems, setLastOrderItems] = useState<OrderItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [updatingImageProduct, setUpdatingImageProduct] = useState<Product | null>(null);
  const [searchImages, setSearchImages] = useState<string[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [banners, setBanners] = useState<BannerMessage[]>([]);
  const [lastOrders, setLastOrders] = useState<Order[]>([]);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

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
      const product = products.find(p => {
        const pEanClean = p.ean ? p.ean.replace(/^0+/, '') : '';
        const pIdClean = p.id ? p.id.replace(/^0+/, '') : '';
        return pEanClean === cleanCode || pIdClean === cleanCode || p.ean === code || p.id === code;
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
  }, [bulkImportText, products]);

  const bulkImportTotal = useMemo(() => {
    return parsedBulkItems.reduce((acc, item) => {
      if (item && item.product && !item.error) {
        const qty = Math.min(item.quantity, item.product.stock);
        return acc + (item.product.finalPrice * qty);
      }
      return acc;
    }, 0);
  }, [parsedBulkItems]);

  const [showOfferCoverage, setShowOfferCoverage] = useState(false);
  const [showOfferSuggestions, setShowOfferSuggestions] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [manualClientName, setManualClientName] = useState('');

  useEffect(() => {
    setDisplayLimit(32);
  }, [search, selectedManufacturers, selectedCategories, statusFilters, activeTab, sortBy]);

  useEffect(() => {
    setCartLoaded(false);
    
    // Instantly initialize cart from localStorage to prevent screen-clearing/flicker
    try {
      const saved = localStorage.getItem(cartKey);
      setCart(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setCart([]);
    }

    const isPromotor = profile?.role === 'promotor';
    if (!selectedClient && !isPromotor) return;

    const regional = selectedClient?.regional || profile?.regional || 'TIMON-MA';
    dataService.setRegional(regional);

    // Cart loading / subscribing
    let unsubCart = () => {};
    if (isPromotor && !selectedClient) {
      setCartLoaded(true);
    } else if (selectedClient && profile) {
      let isFirstFiring = true;
      const savedLocal = localStorage.getItem(cartKey);
      let localItems: OrderItem[] = [];
      try {
        localItems = savedLocal ? JSON.parse(savedLocal) : [];
        if (!Array.isArray(localItems)) {
          localItems = [];
        }
      } catch (e) {
        console.warn("Error parsing savedLocal cart:", e);
      }

      // Fetch cart from Sheets in parallel to sync it on initialization
      dataService.getCartFromSheets(selectedClient.id).then((sheetItems) => {
        if (sheetItems && Array.isArray(sheetItems) && sheetItems.length > 0) {
          console.log(`[Google Sheets Cart] Restored ${sheetItems.length} items from ItensPedido for client:`, selectedClient.id);
          const itemsStr = JSON.stringify(sheetItems);
          localStorage.setItem(cartKey, itemsStr);
          lastSyncedCartRef.current = itemsStr;
          setCart(sheetItems);
          dataService.saveCart(profile.uid, selectedClient.id, sheetItems).catch(err => {
            console.error("Error syncing Sheets cart to Firestore:", err);
          });
        }
      }).catch(err => {
        console.error("Error fetching cart from Sheets on init:", err);
      });

      unsubCart = dataService.subscribeCart(profile.uid, selectedClient.id, (firestoreItems) => {
        if (firestoreItems && Array.isArray(firestoreItems) && firestoreItems.length > 0) {
          // Firestore has a cart, use it and update local storage
          const itemsStr = JSON.stringify(firestoreItems);
          lastSyncedCartRef.current = itemsStr;
          setCart(firestoreItems);
          localStorage.setItem(cartKey, itemsStr);
        } else {
          // Firestore is empty. Let's see if we have items locally to push to Firestore
          const savedLocal = localStorage.getItem(cartKey);
          let localItems: OrderItem[] = [];
          try {
            localItems = savedLocal ? JSON.parse(savedLocal) : [];
            if (!Array.isArray(localItems)) {
              localItems = [];
            }
          } catch (e) {
            localItems = [];
          }
          
          if (localItems.length > 0) {
            // We have a local cart, upload it to Firestore and keep it as cart state
            const itemsStr = JSON.stringify(localItems);
            lastSyncedCartRef.current = itemsStr;
            setCart(localItems);
            dataService.saveCart(profile.uid, selectedClient.id, localItems).catch(err => {
              console.error("Error pushing local cart to firestore:", err);
            });
          } else {
            // Neither Firestore nor local storage has items
            setCart([]);
            localStorage.setItem(cartKey, '[]');
          }
        }
        setCartLoaded(true);
      });
    }

    const unsubProducts = dataService.subscribeProducts((data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubFavorites = selectedClient ? dataService.subscribeFavorites(selectedClient.id, (data) => {
      setFavorites(data);
    }) : () => {};

    const unsubBanners = dataService.subscribeBanners((data) => {
      setBanners(data.filter(b => !b.targetRegional || b.targetRegional === regional));
    });

    const unsubOrders = (selectedClient && profile) ? dataService.subscribeOrders(selectedClient.id, null, false, (data) => {
      setLastOrders(data);
    }) : () => {};

    if (profile) {
      dataService.getClients(profile.name, profile.role === 'admin').then(setAllClients);
    }
    
    const fetchPendingCarts = async () => {
      if (!selectedClient && !isPromotor) return;
      if (!profile) return;
      try {
        const carts = await dataService.getAllCarts(profile.uid);
        
        // Double check after async call
        if (!profile) return;
        
        const filtered = carts.filter(c => {
          if (!c) return false;
          const itemsCount = c.items && Array.isArray(c.items) ? c.items.length : 0;
          if (itemsCount === 0) return false;
          
          if (selectedClient) {
            return String(c.clientId).trim() !== String(selectedClient.id).trim();
          }
          return true;
        });
        
        // Map names
        const clientsWithNames = await Promise.all(filtered.map(async cart => {
          const client = await dataService.getClients(undefined, true).then(list => list.find(cl => cl.id === cart.clientId));
          return {
            ...cart,
            clientName: client?.tradeName || client?.name || `Cliente ${cart.clientId}`
          };
        }));

        setPendingCarts(clientsWithNames);
      } catch (e) {
        console.error("Error fetching pending carts:", e);
      }
    };

    if (selectedClient) {
      fetchPendingCarts();
    }
    const cartInterval = selectedClient ? setInterval(fetchPendingCarts, 30000) : undefined;

    return () => {
      unsubCart();
      unsubProducts();
      unsubFavorites();
      unsubBanners();
      unsubOrders();
      if (cartInterval) clearInterval(cartInterval);
    };
  }, [selectedClient, profile, cartKey]);

  useEffect(() => {
    if (!cartLoaded) return;
    
    localStorage.setItem(cartKey, JSON.stringify(cart));
    
    const isPromotor = profile?.role === 'promotor';
    if (isPromotor && !selectedClient) return;

    if (selectedClient && profile) {
      const cartStr = JSON.stringify(cart);
      if (cartStr === lastSyncedCartRef.current) {
        return;
      }

      // Clear any pending sync timeout
      if (saveCartTimeoutRef.current) {
        clearTimeout(saveCartTimeoutRef.current);
      }

      // Schedule the sync after a 1.2s delay of inactivity (perfect for typing quantities)
      saveCartTimeoutRef.current = setTimeout(() => {
        const currentCartStr = JSON.stringify(cart);
        lastSyncedCartRef.current = currentCartStr;

        // Show silent toast indicating saving is in progress
        toast.loading("Salvando carrinho na planilha...", { id: 'sheets-cart-sync' });

        dataService.saveCart(profile.uid, selectedClient.id, cart).catch(err => {
          console.error("Error saving cart to firestore:", err);
        });

        // Synchronize with Google Sheets
        dataService.saveCartToSheets(selectedClient.id, cart).then((result) => {
          if (result.sucesso) {
            toast.success("Carrinho atualizado na planilha!", { id: 'sheets-cart-sync' });
          } else {
            toast.error(`Erro na Planilha: ${result.erro}`, { 
              id: 'sheets-cart-sync',
              description: "Verifique se a planilha está compartilhada como Editor com o e-mail da sua conta de serviço Google.",
              duration: 6000
            });
          }
        }).catch(err => {
          toast.error(`Erro de conexão com Google Sheets: ${err.message}`, { id: 'sheets-cart-sync' });
        });
      }, 1200);
    }

    return () => {
      if (saveCartTimeoutRef.current) {
        clearTimeout(saveCartTimeoutRef.current);
      }
    };
  }, [cart, cartKey, selectedClient, profile, cartLoaded]);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    products.forEach(p => {
      if (p.manufacturer && !dateRegex.test(p.manufacturer)) {
        set.add(p.manufacturer);
      }
    });
    return Array.from(set).sort();
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const counts = useMemo(() => {
    const tabCounts = { produtos: 0, ofertas: 0, lancamentos: 0 };
    
    products.forEach(p => {
      const isNormal = p.type === 'normal';
      const isOffer = p.type === 'offer';
      const isNew = p.type === 'new';

      if (isNormal) tabCounts.produtos++;
      if (isOffer) tabCounts.ofertas++;
      if (isNew) tabCounts.lancamentos++;
    });

    return { tabCounts };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      // Tab Filter
      if (activeTab === 'produtos' && p.type !== 'normal') return false;
      if (activeTab === 'ofertas' && p.type !== 'offer') return false;
      if (activeTab === 'lancamentos' && p.type !== 'new') return false;
      
      // Manufacturer Filter (Multiple Selection - OR within group)
      if (selectedManufacturers.length > 0 && !selectedManufacturers.includes(p.manufacturer)) return false;

      // Category Filter (Multiple Selection - OR within group)
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false;
      
      // Status Filters (Binary Selection - AND between groups)
      if (statusFilters.includes('discount') && p.discount <= 0) return false;
      if (statusFilters.includes('no-discount') && p.discount > 0) return false;
      if (statusFilters.includes('in-stock') && p.stock <= 0) return false;
      if (statusFilters.includes('out-stock') && p.stock > 0) return false;
      if (statusFilters.includes('new') && p.type !== 'new') return false;
      if (statusFilters.includes('promotional') && p.type !== 'offer') return false;

      // Price Filter
      if (p.finalPrice < priceRange[0] || p.finalPrice > priceRange[1]) return false;

      // Search Filter
      if (search) {
        const query = search.toLowerCase();
        const priceBr = p.finalPrice.toFixed(2).replace('.', ',');
        const priceEn = p.finalPrice.toFixed(2);
        
        const priceBrWithSymbolSpaced = `r$ ${priceBr}`;
        const priceBrWithSymbolAttached = `r$${priceBr}`;
        const priceEnWithSymbolSpaced = `r$ ${priceEn}`;
        const priceEnWithSymbolAttached = `r$${priceEn}`;

        const salePriceBr = p.salePrice ? p.salePrice.toFixed(2).replace('.', ',') : '';
        const salePriceEn = p.salePrice ? p.salePrice.toFixed(2) : '';
        
        const salePriceBrWithSymbolSpaced = salePriceBr ? `r$ ${salePriceBr}` : '';
        const salePriceBrWithSymbolAttached = salePriceBr ? `r$${salePriceBr}` : '';
        const salePriceEnWithSymbolSpaced = salePriceEn ? `r$ ${salePriceEn}` : '';
        const salePriceEnWithSymbolAttached = salePriceEn ? `r$${salePriceEn}` : '';
        
        const combinedText = `
          ${p.description} 
          ${p.id} 
          ${p.ean} 
          ${p.manufacturer} 
          ${priceBr} 
          ${priceEn} 
          ${priceBrWithSymbolSpaced} 
          ${priceBrWithSymbolAttached} 
          ${priceEnWithSymbolSpaced} 
          ${priceEnWithSymbolAttached} 
          ${salePriceBr} 
          ${salePriceEn} 
          ${salePriceBrWithSymbolSpaced} 
          ${salePriceBrWithSymbolAttached} 
          ${salePriceEnWithSymbolSpaced} 
          ${salePriceEnWithSymbolAttached}
        `.toLowerCase();

        if (query.includes('%')) {
          const parts = query.split('%').map(part => part.trim()).filter(part => part.length > 0);
          return parts.every(part => combinedText.includes(part));
        } else {
          return combinedText.includes(query);
        }
      }
      
      return true;
    });

    // Advanced Sorting
    const sortArr = [...result];
    const isPromoter = profile?.role === 'promotor';

    switch (sortBy) {
      case 'price-asc': sortArr.sort((a, b) => a.finalPrice - b.finalPrice); break;
      case 'price-desc': sortArr.sort((a, b) => b.finalPrice - a.finalPrice); break;
      case 'discount': sortArr.sort((a, b) => b.discount - a.discount); break;
      case 'stock': sortArr.sort((a, b) => b.stock - a.stock); break;
      case 'az': 
        sortArr.sort((a, b) => {
          if (isPromoter) {
            return a.description.localeCompare(b.description);
          }
          const aHasStock = a.stock > 0;
          const bHasStock = b.stock > 0;
          if (aHasStock && !bHasStock) return -1;
          if (!aHasStock && bHasStock) return 1;
          return a.description.localeCompare(b.description);
        }); 
        break;
      case 'za': 
        sortArr.sort((a, b) => {
          if (isPromoter) {
            return b.description.localeCompare(a.description);
          }
          const aHasStock = a.stock > 0;
          const bHasStock = b.stock > 0;
          if (aHasStock && !bHasStock) return -1;
          if (!aHasStock && bHasStock) return 1;
          return b.description.localeCompare(a.description);
        }); 
        break;
      case 'recent': sortArr.sort((a, b) => {
        const dateA = a.discountExpiryDate ? new Date(a.discountExpiryDate).getTime() : 0;
        const dateB = b.discountExpiryDate ? new Date(b.discountExpiryDate).getTime() : 0;
        return dateB - dateA;
      }); break;
      default: 
        sortArr.sort((a, b) => {
          if (isPromoter) {
            return a.description.localeCompare(b.description);
          }
          const aHasStock = a.stock > 0;
          const bHasStock = b.stock > 0;
          if (aHasStock && !bHasStock) return -1;
          if (!aHasStock && bHasStock) return 1;
          return a.description.localeCompare(b.description);
        });
        break;
    }

    return sortArr;
  }, [products, activeTab, search, selectedManufacturers, selectedCategories, statusFilters, sortBy, profile?.role]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  useEffect(() => {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => Math.min(prev + 32, filteredProducts.length));
      }
    }, { rootMargin: '150px' });

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [displayedProducts.length, filteredProducts.length]);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error('Produto sem estoque');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.warning('Estoque máximo atingido');
          return prev;
        }
        toast.success(`${product.description.substring(0, 20)}... adicionado`);
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`${product.description.substring(0, 20)}... adicionado`);
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== productId);
      
      if (newQty > item.stock) {
        toast.warning('Estoque máximo atingido');
        return prev;
      }
      
      return prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
    });
  }, []);

  const setQuantityDirectly = useCallback((productId: string, value: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = Math.max(0, value);
      if (newQty === 0) return prev.filter(i => i.id !== productId);
      
      if (newQty > item.stock) {
        toast.warning('Estoque insuficiente');
        return prev.map(i => i.id === productId ? { ...i, quantity: item.stock } : i);
      }
      
      return prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
    });
  }, []);

  const toggleFavorite = useCallback(async (product: Product) => {
    if (!selectedClient || !profile) return;
    await dataService.toggleFavorite(selectedClient.id, product.id, product.description, profile.name);
  }, [selectedClient, profile]);

  const handleSetZoomImage = useCallback((product: Product) => {
    setSelectedProductDetails(product);
  }, []);

  const handleSetUpdatingImageProduct = useCallback((product: Product) => {
    setUpdatingImageProduct(product);
  }, []);

  const isFavorite = (productId: string) => favorites.some(f => f.productId === productId);

  const handleSearchImages = async (product: Product) => {
    try {
      setSearchingImages(true);
      setSearchImages([]);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Encontre URLs de imagens diretas e de alta qualidade para o produto: ${product.description} ${product.manufacturer}. 
      Retorne uma lista JSON com exatamente 5 URLs de imagens funcionais que apontem diretamente para arquivos de imagem comuns (como jpg ou png). 
      Seja preciso e evite sites que bloqueiam acesso direto. 
      Apenas o JSON, nada mais. Formato: ["url1", "url2", ...]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        } as any
      });

      const text = response.text;
      if (text) {
        const urls = JSON.parse(text);
        setSearchImages(urls);
        if (urls.length === 0) {
          toast.error('Nenhuma imagem encontrada pelo IA.');
        }
      } else {
        toast.error('Ocorreu um erro ao processar a resposta da IA.');
      }
    } catch (error) {
      console.error('Gemini Search error:', error);
      toast.error('Erro ao pesquisar imagens com IA.');
    } finally {
      setSearchingImages(false);
    }
  };

  const handleUpdateImage = async (product: Product, url: string) => {
    try {
      toast.loading('Atualizando imagem...', { id: 'update-img' });
      const result = await dataService.updateProductImage(product.id, url, product.type);
      if (result.success) {
        toast.success('Imagem atualizada com sucesso! Recarregando catálogo...', { id: 'update-img' });
        setUpdatingImageProduct(null);
        // Refresh products
        const data = await dataService.getAllProducts();
        setProducts(data);
      } else {
        toast.error(`Erro ao atualizar imagem no Planilha: ${result.error || 'Verifique se a planilha está compartilhada com o e-mail da conta de serviço.'}`, { id: 'update-img', duration: 6000 });
      }
    } catch (error: any) {
       toast.error(`Erro ao atualizar imagem: ${error.message || error}`, { id: 'update-img' });
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const quickOrderProducts = useMemo(() => {
    const productIds = new Set<string>();
    const result: Product[] = [];
    
    lastOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productIds.has(item.id)) {
          const p = products.find(prod => prod.id === item.id);
          if (p) {
            result.push(p);
            productIds.add(item.id);
          }
        }
      });
    });
    
    return result.slice(0, 10);
  }, [lastOrders, products]);

  const soldProductIds = useMemo(() => {
    const ids = new Set<string>();
    lastOrders.forEach(order => {
      order.items.forEach(item => ids.add(item.id));
    });
    return ids;
  }, [lastOrders]);

  const offersInCart = useMemo(() => {
    return cart.filter(item => item.type === 'offer').length;
  }, [cart]);

  const totalOffersAvailable = useMemo(() => {
    return products.filter(p => p.type === 'offer' && p.stock > 0).length;
  }, [products]);

  const generateOrderPDF = (order: any, items: OrderItem[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const orange: [number, number, number] = [255, 107, 0];
    const white: [number, number, number] = [255, 255, 255];
    const gray: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [240, 240, 240];
    const red: [number, number, number] = [255, 0, 0];

    const drawHeaderBar = (text: string, y: number) => {
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(text, pageWidth / 2, y + 5.5, { align: 'center' });
    };

    doc.setFillColor(orange[0], orange[1], orange[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFontSize(32);
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('VENDAS HBN1', pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('COMPROVANTE DE PEDIDO', pageWidth / 2, 30, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const contactText = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'}  •  Tel: ${profile?.phone || '(86) 99964-7573'}  •  ${profile?.email || 'leonelamorimm@gmail.com'}`;
    doc.text(contactText, pageWidth / 2, 37, { align: 'center' });
    doc.text(new Date().toLocaleString('pt-BR'), pageWidth / 2, 42, { align: 'center' });

    let currentY = 55;
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`N° DO PEDIDO   ${order.id || 'N/A'}`, pageWidth / 2, currentY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`DATA / HORA   ${new Date(order.date).toLocaleString('pt-BR')}`, pageWidth / 2, currentY + 6, { align: 'center' });
    
    currentY += 18;

    drawHeaderBar('DADOS DO CLIENTE', currentY);
    currentY += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    const clientInfo = profile?.role === 'promotor' 
      ? [
          ['Cliente', manualClientName.toUpperCase()],
          ['Promotor', profile.name.toUpperCase()],
        ]
      : [
          ['Cliente', (selectedClient?.tradeName || selectedClient?.name || '-').toUpperCase()],
          ['ID Cliente', selectedClient?.id || '-'],
          ['Nome', (selectedClient?.name || '-').toUpperCase()],
          ['CNPJ', selectedClient?.cnpj || '-'],
          ['Vendedor', (order.seller || '-').toUpperCase()],
          ['E-mail', (selectedClient?.email || '-').toUpperCase()],
          ['Endereço', (selectedClient?.address || '-').toUpperCase()],
          ['Cidade/Estado', (`${selectedClient?.city || '-'} / ${selectedClient?.state || '-'}`).toUpperCase()],
          ['Celular', selectedClient?.phone || '-']
        ];

    clientInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 65, currentY);
      currentY += 5.5;
    });

    currentY += 6;

    const groupedItems = items.reduce((acc: any, item) => {
      const manufacturer = item.manufacturer || 'GERAL';
      if (!acc[manufacturer]) acc[manufacturer] = [];
      acc[manufacturer].push(item);
      return acc;
    }, {});

    Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      const isPromoter = profile?.role === 'promotor';
      const tableHeaders = isPromoter
        ? [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']]
        : [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']];

      const tableData = mItems.map((item: any) => isPromoter 
        ? [
            item.id,
            item.ean || '-',
            item.description,
            formatCurrency(item.salePrice),
            item.quantity,
            formatCurrency(item.quantity * item.salePrice),
            '✅ OK'
          ]
        : [
            item.id,
            item.ean || '-',
            item.description,
            formatCurrency(item.salePrice),
            item.discount > 0 ? `${item.discount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-',
            formatCurrency(item.finalPrice),
            item.quantity,
            formatCurrency(item.quantity * item.finalPrice),
            '✅ OK'
          ]
      );

      autoTable(doc, {
        startY: currentY,
        head: tableHeaders,
        body: tableData,
        theme: 'plain',
        headStyles: { 
          fillColor: orange, 
          textColor: white, 
          fontSize: 8, 
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { fontSize: 7, halign: 'center', textColor: [0, 0, 0], overflow: 'linebreak' },
        columnStyles: isPromoter
          ? {
              0: { halign: 'center', cellWidth: 15 },
              1: { halign: 'center', cellWidth: 25 },
              2: { halign: 'left', cellWidth: 'auto' },
              3: { halign: 'right', textColor: [100, 100, 100], cellWidth: 25 },
              4: { halign: 'center', cellWidth: 12 },
              5: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 25 },
              6: { halign: 'center', cellWidth: 15 }
            }
          : {
              0: { halign: 'center', cellWidth: 15 },
              1: { halign: 'center', cellWidth: 25 },
              2: { halign: 'left', cellWidth: 'auto' },
              3: { halign: 'right', textColor: [100, 100, 100], cellWidth: 20 },
              4: { halign: 'center', cellWidth: 12 },
              5: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 20 },
              6: { halign: 'center', cellWidth: 10 },
              7: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 25 },
              8: { halign: 'center', cellWidth: 15 }
            },
        margin: { left: 14, right: 14 }
      });

      const mSubtotal = mItems.reduce((sum: number, item: any) => sum + (item.salePrice * item.quantity), 0);
      const mTotal = mItems.reduce((sum: number, item: any) => sum + (item.finalPrice * item.quantity), 0);
      const mDiscount = mSubtotal - mTotal;

      currentY = (doc as any).lastAutoTable.finalY + 2;

      const drawSummaryRow = (label: string, value: string, color: [number, number, number] = [0,0,0]) => {
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(pageWidth - 85, currentY, 71, 6, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.text(label, pageWidth - 80, currentY + 4.2);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, pageWidth - 18, currentY + 4.2, { align: 'right' });
        currentY += 7;
      };

      if (isPromoter) {
        drawSummaryRow('TOTAL', formatCurrency(mSubtotal));
      } else {
        drawSummaryRow('SUBTOTAL', formatCurrency(mSubtotal));
        drawSummaryRow('DESCONTOS', `- ${formatCurrency(mDiscount)}`, [0, 150, 0]);
        drawSummaryRow('TOTAL', formatCurrency(mTotal));
      }
      
      currentY += 8;
    });

    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    const totalSalePrice = items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const totalFinalPrice = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalDiscount = totalSalePrice - totalFinalPrice;

    if (profile?.role === 'promotor') {
      currentY += 10;
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(pageWidth - 85, currentY, 71, 12, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL A PAGAR', pageWidth - 80, currentY + 8);
      doc.text(formatCurrency(totalSalePrice), pageWidth - 18, currentY + 8, { align: 'right' });
    } else {
      currentY += 10;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(pageWidth - 85, currentY, 71, 18, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('SUBTOTAL', pageWidth - 80, currentY + 6);
      doc.text(formatCurrency(totalSalePrice), pageWidth - 18, currentY + 6, { align: 'right' });
      
      doc.setTextColor(0, 150, 0);
      doc.text('DESCONTO', pageWidth - 80, currentY + 13);
      doc.text(`- ${formatCurrency(totalDiscount)}`, pageWidth - 18, currentY + 13, { align: 'right' });

      currentY += 18;
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(pageWidth - 85, currentY, 71, 12, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL A PAGAR', pageWidth - 80, currentY + 8);
      doc.text(formatCurrency(totalFinalPrice), pageWidth - 18, currentY + 8, { align: 'right' });
    }

    const footerY = doc.internal.pageSize.height - 18;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    doc.setFontSize(8);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    const contactInfo = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'}  |  Tel: ${profile?.phone || '(86) 99964-7573'}  |  ${profile?.email || 'leonelamorimm@gmail.com'}`;
    const footerText = `Obrigado pela preferencia!  |  VENDAS HBN1  |  ${contactInfo}`;
    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, footerY + 5, { align: 'center' });

    // Format filename with legal name (razão social), cnpj, date, and time
    const rName = selectedClient?.name || order.clientName || 'CLIENTE';
    const cleanRName = rName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    const cleanCnpjStr = (selectedClient?.cnpj || '').replace(/\D/g, '');

    const orderDate = order.date ? new Date(order.date) : new Date();
    const dayStr = String(orderDate.getDate()).padStart(2, '0');
    const monthStr = String(orderDate.getMonth() + 1).padStart(2, '0');
    const yearStr = String(orderDate.getFullYear());
    const hourStr = String(orderDate.getHours()).padStart(2, '0');
    const minStr = String(orderDate.getMinutes()).padStart(2, '0');
    const secStr = String(orderDate.getSeconds()).padStart(2, '0');

    const dateAndTimeStr = `${dayStr}${monthStr}${yearStr}${hourStr}${minStr}${secStr}`;
    const formattedFilename = `${cleanRName}${cleanCnpjStr}${dateAndTimeStr}.pdf`;

    doc.save(formattedFilename);
  };

  const exportCatalogToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const orange: [number, number, number] = [255, 107, 0];
    const white: [number, number, number] = [255, 255, 255];
    const gray: [number, number, number] = [100, 100, 100];
    const borderGray: [number, number, number] = [230, 230, 230];

    toast.loading('Preparando fotos (isso pode demorar)...', { id: 'pdf-gen' });

    // Ultra-resilient Base64 converter with proxy fallback for CORS issues
    const getBase64Image = async (url: string): Promise<string | null> => {
      const tryLoad = async (targetUrl: string, useProxy = false): Promise<string | null> => {
        // Optimize image size to 400x400 for highly compact, professional PDFs (prevents out-of-memory and lag)
        const finalUrl = useProxy 
          ? `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&output=jpg&q=80&fit=contain&w=400&h=400&bg=white` 
          : targetUrl;

        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          const timeoutId = setTimeout(() => {
            img.src = '';
            resolve(null);
          }, 15000);

          img.onload = () => {
            clearTimeout(timeoutId);
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Optimized size for PDF cards (25mm x 25mm print size is perfectly suited for 400x400 resolution)
                canvas.width = 400;
                canvas.height = 400;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 400, 400);
                
                const scale = Math.min(400 / img.width, 400 / img.height);
                const x = (400 - img.width * scale) / 2;
                const y = (400 - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                resolve(canvas.toDataURL('image/jpeg', 0.80)); // Great quality with high compression
              } else resolve(null);
            } catch (e) {
              resolve(null);
            }
          };

          img.onerror = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };

          img.src = finalUrl;
        });
      };

      // Try direct first (faster if CORS allowed) then proxy
      let result = await tryLoad(url, false);
      if (result) return result;
      
      result = await tryLoad(url, true);
      return result;
    };

    // Pre-cache images in PARALLEL blocks to be faster but resilient
    const imagesCache: Record<string, string | null> = {};
    const total = filteredProducts.length;
    const batchSize = 12; // Optimized larger batch size for blisteringly fast parallel loading
    
    for (let i = 0; i < total; i += batchSize) {
      const batch = filteredProducts.slice(i, i + batchSize);
      toast.loading(`Processando fotos: ${Math.min(i + batchSize, total)}/${total}...`, { id: 'pdf-gen' });
      
      await Promise.all(batch.map(async (p) => {
        if (p.photo) {
          imagesCache[p.id] = await getBase64Image(p.photo);
        }
      }));
    }

    const drawHeader = (pageNum: number) => {
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      const title = selectedManufacturers.length > 0 
        ? `CATÁLOGO DE PRODUTOS - ${selectedManufacturers.join(', ').toUpperCase()}`
        : 'CATÁLOGO DE PRODUTOS GERAL';

      doc.setFontSize(18);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const info = `Cliente: ${selectedClient?.tradeName || selectedClient?.name || 'Cliente Geral'} | Vendedor: ${profile?.name || 'HBN1'} | ${new Date().toLocaleDateString('pt-BR')}`;
      doc.text(info, pageWidth / 2, 26, { align: 'center' });
      
      doc.setFontSize(7);
      doc.text(`Página ${pageNum}`, pageWidth - 15, 30, { align: 'right' });
    };

    // Designed to fit exactly 18 products per page with high elegance, optimal readability and a modern landscape layout
    const drawCard = (p: Product, x: number, y: number, w: number, h: number) => {
      // Draw outer elegant card border with very soft rounded rectangle
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

      // Left column: Image Box container
      const imgW = 23;
      const imgH = 23;
      const imgX = x + 2;
      const imgY = y + (h - imgH) / 2; // Vertically center the image within the card

      const cachedImg = imagesCache[p.id];
      if (cachedImg) {
        try {
          doc.addImage(cachedImg, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
        } catch (e) {
          doc.setFontSize(5);
          doc.setTextColor(180, 180, 180);
          doc.text('Foto erro', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
        }
      } else {
        doc.setDrawColor(248, 248, 248);
        doc.setFillColor(250, 250, 250);
        doc.rect(imgX, imgY, imgW, imgH, 'FD');
        doc.setFontSize(5);
        doc.setTextColor(180, 180, 180);
        doc.text(p.photo ? 'Erro carregar' : 'Sem foto', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
      }

      // Compact Red discount tag over the top left of the card
      if (p.discount > 0) {
        doc.setFillColor(239, 68, 68); // Tailwind red-500
        doc.roundedRect(x + 1.5, y + 1.5, 9, 3.8, 0.4, 0.4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`-${applyCustomRounding(p.discount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, x + 6, y + 4.1, { align: 'center' });
      }

      // Right column coordinates (relative horizontal offset)
      const tx = x + 27;

      // Category (Sleek pink text)
      doc.setFontSize(4.5);
      doc.setTextColor(240, 98, 146);
      doc.setFont('helvetica', 'bold');
      doc.text(p.category.toUpperCase(), tx, y + 3.8);

      // Title/Description (supports exactly 2 lines maximum)
      doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      const dLines = doc.splitTextToSize(p.description, w - 27 - 2.5);
      doc.text(dLines.slice(0, 2), tx, y + 6.3);

      // Manufacturer (small and light gray)
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(p.manufacturer.toUpperCase(), tx, y + 12.5);

      // Offer discount expiry date
      if (p.discount > 0 && p.discountExpiryDate) {
        doc.setFontSize(4);
        doc.setTextColor(230, 81, 0); // Orange-900
        doc.setFont('helvetica', 'bold');
        doc.text(`EXPIRA: ${new Date(p.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}`, x + w - 2.5, y + 12.5, { align: 'right' });
      }

      // ID and EAN code badges (drawn side-by-side)
      const pillY = y + 14.2;
      const pillH = 3;
      
      // ID Badge
      doc.setFillColor(235, 243, 255);
      doc.roundedRect(tx, pillY, 11, pillH, 0.4, 0.4, 'F');
      doc.setFontSize(3.8);
      doc.setTextColor(40, 80, 180);
      doc.setFont('helvetica', 'bold');
      doc.text(`ID:${p.id}`, tx + 5.5, pillY + 2.1, { align: 'center' });

      // EAN Badge
      if (p.ean) {
        doc.setFillColor(245, 235, 255);
        doc.roundedRect(tx + 12, pillY, 21, pillH, 0.4, 0.4, 'F');
        doc.setTextColor(130, 50, 180);
        doc.text(`EAN:${p.ean}`, tx + 12 + 10.5, pillY + 2.1, { align: 'center' });
      }

      // Prices & discount indicators
      const priceY = y + 20.2;
      if (p.discount > 0) {
        // Original comparison price
        doc.setFontSize(4.5);
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'normal');
        doc.text(`De: ${formatCurrency(p.salePrice)}`, tx, priceY);
        const textWidth = doc.getTextWidth(`De: ${formatCurrency(p.salePrice)}`);
        doc.line(tx, priceY - 1, tx + textWidth, priceY - 1);
        
        // Final purchase price
        doc.setFontSize(9);
        doc.setTextColor(255, 107, 0); // Orange HBN1 Identity
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(p.finalPrice), tx, priceY + 4.5);
      } else {
        // Final purchase price (normal)
        doc.setFontSize(9);
        doc.setTextColor(255, 107, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(p.finalPrice), tx, priceY + 3.2);
      }

      // Economy Green Badge
      if (p.discount > 0) {
        const savings = p.salePrice - p.finalPrice;
        const savingsY = priceY + 6.2;
        doc.setFillColor(34, 197, 94); // Beautiful green
        doc.roundedRect(tx, savingsY, w - 27 - 2.5, 3.2, 0.6, 0.6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`\u2605 ECON. ${formatCurrency(savings)}`, tx + (w - 27 - 2.5) / 2, savingsY + 2.3, { align: 'center' });
      }

      // Stock indicator at the bottom edge
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(`Estoque: ${p.stock}`, tx, y + h - 2);
    };

    // Calculate layout for exactly 18 products per page (3 columns x 6 rows)
    const columns = 3;
    const margin = 8;
    const cardGap = 1.6;
    const cw = (pageWidth - (margin * 2) - (cardGap * (columns - 1))) / columns;
    const ch = 40.5; // Calculated height for 6 rows
    
    let col = 0;
    let row = 0;
    let pageNum = 1;

    drawHeader(pageNum);

    for (const p of filteredProducts) {
      if (row >= 6) { // Exactly 6 rows per page => 18 products max
        doc.addPage();
        pageNum++;
        drawHeader(pageNum);
        row = 0;
        col = 0;
      }
      const tx = margin + (col * (cw + cardGap));
      const ty = 38 + (row * (ch + cardGap));
      drawCard(p, tx, ty, cw, ch);
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }

    const fName = selectedManufacturers.length > 0 
      ? `Catalogo_${selectedManufacturers[0]}_${new Date().getTime()}.pdf`
      : `Catalogo_HBN1_${new Date().getTime()}.pdf`;
      
    doc.save(fName);
    toast.success('Catálogo 100% exportado!', { id: 'pdf-gen' });
  };


  const generateOrderExcel = async (order: any, items: OrderItem[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedido');

    const orangeColor = 'FFFF6B00';
    const whiteColor = 'FFFFFFFF';
    const grayColor = 'FF646464';
    const lightGrayColor = 'FFF0F0F0';

    worksheet.mergeCells('A1:I2');
    const headerCell = worksheet.getCell('A1');
    headerCell.value = 'VENDAS HBN1 - COMPROVANTE DE PEDIDO';
    headerCell.font = { size: 20, bold: true, color: { argb: whiteColor } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([`Pedido: ${order.id || 'N/A'}`, '', '', '', '', '', '', `Data: ${new Date(order.date).toLocaleString('pt-BR')}`]);
    worksheet.mergeCells(`A3:D3`);
    worksheet.mergeCells(`H3:I3`);
    worksheet.getRow(3).font = { bold: true, color: { argb: grayColor } };

    worksheet.addRow([]);

    const clientHeaderRow = worksheet.addRow(['DADOS DO CLIENTE']);
    worksheet.mergeCells(`A5:I5`);
    clientHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
    clientHeaderRow.getCell(1).font = { bold: true, color: { argb: whiteColor } };
    clientHeaderRow.getCell(1).alignment = { horizontal: 'center' };

    const clientRows = profile?.role === 'promotor'
      ? [
          ['Cliente', manualClientName.toUpperCase()],
          ['Promotor', profile.name.toUpperCase()],
        ]
      : [
          ['Cliente', (selectedClient?.tradeName || selectedClient?.name || '-').toUpperCase()],
          ['ID Cliente', selectedClient?.id || '-'],
          ['Nome', (selectedClient?.name || '-').toUpperCase()],
          ['CNPJ', selectedClient?.cnpj || '-'],
          ['Vendedor', (order.seller || '-').toUpperCase()],
          ['E-mail', (selectedClient?.email || '-').toUpperCase()],
          ['Endereço', (selectedClient?.address || '-').toUpperCase()],
          ['Cidade/Estado', (`${selectedClient?.city || '-'} / ${selectedClient?.state || '-'}`).toUpperCase()],
          ['Celular', selectedClient?.phone || '-']
        ];

    clientRows.forEach(row => {
      const r = worksheet.addRow(row);
      r.getCell(1).font = { bold: true };
      worksheet.mergeCells(`B${r.number}:I${r.number}`);
    });

    worksheet.addRow([]);

    const groupedItems = items.reduce((acc: any, item) => {
      const manufacturer = item.manufacturer || 'GERAL';
      if (!acc[manufacturer]) acc[manufacturer] = [];
      acc[manufacturer].push(item);
      return acc;
    }, {});

    const isPromoter = profile?.role === 'promotor';

    Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
      const mHeaderRow = worksheet.addRow([`FABRICANTE: ${manufacturer.toUpperCase()}`]);
      worksheet.mergeCells(`A${mHeaderRow.number}:I${mHeaderRow.number}`);
      mHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
      mHeaderRow.getCell(1).font = { bold: true, color: { argb: whiteColor } };
      mHeaderRow.getCell(1).alignment = { horizontal: 'center' };

      const tableHeader = isPromoter
        ? worksheet.addRow(['COD. ▼', 'EAN ▼', 'DESCRICAO ▼', 'PRECO ▼', 'QT ▼', 'SUBTOTAL ▼', 'STATUS ▼'])
        : worksheet.addRow(['COD. ▼', 'EAN ▼', 'DESCRICAO ▼', 'PRECO ▼', 'DESC ▼', 'PR.FINAL ▼', 'QT ▼', 'SUBTOTAL ▼', 'STATUS ▼']);

      tableHeader.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
        cell.font = { bold: true, color: { argb: whiteColor }, size: 9 };
        cell.alignment = { horizontal: 'center' };
      });

      mItems.forEach((item: any) => {
        const rowData = isPromoter
          ? [
              item.id,
              item.ean || '-',
              item.description,
              item.salePrice,
              item.quantity,
              item.quantity * item.salePrice,
              '✅ OK'
            ]
          : [
              item.id,
              item.ean || '-',
              item.description,
              item.salePrice,
              item.discount > 0 ? `${item.discount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-',
              item.finalPrice,
              item.quantity,
              item.quantity * item.finalPrice,
              '✅ OK'
            ];
        
        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center' };
          if (isPromoter) {
            if (colNumber === 4 || colNumber === 6) {
              cell.numFmt = '"R$ "#,##0.00';
            }
            if (colNumber === 6) {
              cell.font = { color: { argb: orangeColor }, bold: true };
            }
          } else {
            if (colNumber === 4 || colNumber === 6 || colNumber === 8) {
              cell.numFmt = '"R$ "#,##0.00';
            }
            if (colNumber === 6 || colNumber === 8) {
              cell.font = { color: { argb: orangeColor }, bold: true };
            }
          }
        });
      });

      const mSubtotal = mItems.reduce((sum: number, item: any) => sum + (item.salePrice * item.quantity), 0);
      const mTotal = mItems.reduce((sum: number, item: any) => sum + (item.finalPrice * item.quantity), 0);
      const mDiscount = mSubtotal - mTotal;

      const addSummaryRow = (label: string, value: number, color?: string) => {
        const row = worksheet.addRow(['', '', '', '', '', '', label, '', value]);
        worksheet.mergeCells(`G${row.number}:H${row.number}`);
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGrayColor } };
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGrayColor } };
        row.getCell(7).font = { bold: true, size: 9 };
        row.getCell(9).font = { bold: true, size: 9, color: color ? { argb: color } : undefined };
        row.getCell(9).numFmt = '"R$ "#,##0.00';
        row.getCell(9).alignment = { horizontal: 'right' };
      };

      if (isPromoter) {
        addSummaryRow('TOTAL', mSubtotal);
      } else {
        addSummaryRow('SUBTOTAL', mSubtotal);
        addSummaryRow('DESCONTOS', -mDiscount, 'FF009600');
        addSummaryRow('TOTAL', mTotal);
      }
      worksheet.addRow([]);
    });

    const totalSalePrice = items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const totalFinalPrice = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalDiscount = totalSalePrice - totalFinalPrice;

    const finalHeader = worksheet.addRow(['RESUMO GERAL']);
    worksheet.mergeCells(`A${finalHeader.number}:I${finalHeader.number}`);
    finalHeader.getCell(1).font = { bold: true };

    const addFinalRow = (label: string, value: number, color?: string, isTotal = false) => {
      const row = worksheet.addRow(['', '', '', '', '', '', label, '', value]);
      worksheet.mergeCells(`G${row.number}:H${row.number}`);
      const bgColor = isTotal ? orangeColor : lightGrayColor;
      const textColor = isTotal ? whiteColor : (color || 'FF000000');
      
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(7).font = { bold: true, color: { argb: textColor } };
      row.getCell(9).font = { bold: true, color: { argb: textColor } };
      row.getCell(9).numFmt = '"R$ "#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right' };
    };

    if (isPromoter) {
      addFinalRow('TOTAL A PAGAR', totalSalePrice, undefined, true);
    } else {
      addFinalRow('SUBTOTAL GERAL', totalSalePrice);
      addFinalRow('DESCONTO GERAL', -totalDiscount, 'FF009600');
      addFinalRow('TOTAL A PAGAR', totalFinalPrice, undefined, true);
    }

    worksheet.columns = [
      { width: 12 }, { width: 18 }, { width: 45 }, { width: 15 }, { width: 10 }, { width: 15 }, { width: 8 }, { width: 15 }, { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const rName = selectedClient?.name || order.clientName || 'CLIENTE';
    const cleanRName = rName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    const cleanCnpjStr = (selectedClient?.cnpj || '').replace(/\D/g, '');

    const orderDate = order.date ? new Date(order.date) : new Date();
    const dayStr = String(orderDate.getDate()).padStart(2, '0');
    const monthStr = String(orderDate.getMonth() + 1).padStart(2, '0');
    const yearStr = String(orderDate.getFullYear());
    const hourStr = String(orderDate.getHours()).padStart(2, '0');
    const minStr = String(orderDate.getMinutes()).padStart(2, '0');
    const secStr = String(orderDate.getSeconds()).padStart(2, '0');

    const dateAndTimeStr = `${dayStr}${monthStr}${yearStr}${hourStr}${minStr}${secStr}`;
    const formattedFilename = `${cleanRName}${cleanCnpjStr}${dateAndTimeStr}.xlsx`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = formattedFilename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const sendToWhatsApp = (order: any, items: OrderItem[]) => {
    const recipientPhone = profile?.phone;

    if (!recipientPhone) {
      toast.error('Seu telefone não está cadastrado no sistema para envio do WhatsApp');
      return;
    }

    let message = `🛍️ *VENDAS HBN1*\n\n`;
    message += `🏪 *${order.clientName}*\n`;
    message += `🆔 ID: ${order.clientId}\n`;
    message += `👤 Vendedor: ${order.seller}\n\n`;
    message += `📦 *ITENS:*\n────────────────\n`;
    
    items.forEach((item, idx) => {
      message += `\n${idx + 1}. *${item.description}*\n`;
      message += `   ${item.quantity} un × ${formatCurrency(item.finalPrice)} = ${formatCurrency(item.quantity * item.finalPrice)}\n`;
    });
    
    const totalByItems = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    
    message += `\n────────────────\n`;
    message += `💰 *TOTAL: ${formatCurrency(totalByItems)}*\n\n`;
    message += `✅ Aguardo confirmação!`;

    const purePhone = recipientPhone.replace(/\D/g, '');
    const phoneWithCountry = purePhone.length <= 11 ? `55${purePhone}` : purePhone;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleScan = (ean: string) => {
    setSearchInputValue(ean);
    setSearch(ean);
    setIsScannerOpen(false);
    toast.success(`Buscando código: ${ean}`);
  };

  const finalizeOrder = async () => {
    if (isFinalizing) return;
    if (!selectedClient && profile?.role !== 'promotor') return;
    if (!profile || cart.length === 0) return;

    const orderData: Omit<Order, 'id'> = {
      date: new Date().toISOString(),
      clientId: selectedClient?.id || 'PROMOTOR',
      clientName: profile?.role === 'promotor' 
        ? (manualClientName ? manualClientName.toUpperCase() : `PROMOTOR: ${profile.name}`) 
        : (selectedClient?.tradeName || selectedClient?.name || 'Cliente'),
      email: selectedClient?.email || profile?.email || '',
      seller: profile.name,
      phone: selectedClient?.phone || profile?.phone || '',
      total: cartTotal,
      status: 'Novo',
      items: cart,
      observation: '',
    };

    try {
      // Validate order data
      OrderSchema.parse({
        clientId: orderData.clientId,
        clientName: orderData.clientName,
        total: orderData.total,
        items: orderData.items,
        status: orderData.status,
      });

      setIsFinalizing(true);
      toast.loading('Registrando pedido...', { id: 'checkout' });
      const orderId = await dataService.saveOrder(orderData);
      
      const finalOrder = { ...orderData, id: orderId || 'PED' + Date.now() };

      toast.success('Pedido registrado com sucesso!', { id: 'checkout' });
      
      setLastOrder(finalOrder);
      setLastOrderItems([...cart]);
      setShowOrderSuccess(true);
      
      // If not promotor, send to WhatsApp
      if (profile?.role !== 'promotor') {
        sendToWhatsApp(finalOrder, cart);
      }
      
      generateOrderPDF(finalOrder, cart);
      await generateOrderExcel(finalOrder, cart);

      setCart([]);
      setManualClientName('');
      setIsCartOpen(false);
      setShowOfferSuggestions(false);
      
      // For promotor, we might want to automatically reset after success modal or immediately
      if (profile?.role === 'promotor') {
        toast.info('Fluxo reiniciado para novo pedido.');
      }
    } catch (error) {
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        const firstError = (error as any).errors[0]?.message || 'Erro de valida\u00E7\u00E3o';
        toast.error(`Falha na valida\u00E7\u00E3o: ${firstError}`, { id: 'checkout' });
      } else {
        console.error('Checkout error:', error);
        toast.error('Erro ao registrar pedido', { id: 'checkout' });
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedClient || !profile || cart.length === 0) return;

    if (!showOfferCoverage && offersInCart < totalOffersAvailable * 0.5) {
      setShowOfferCoverage(true);
      return;
    }

    // Show offer suggestions modal instead of finishing
    setShowOfferSuggestions(true);
  };

  const handleAddBulkToCart = () => {
    const validItems = parsedBulkItems.filter(item => item && item.product && item.product.stock > 0);
    if (validItems.length === 0) {
      toast.error('Nenhum produto válido para adicionar.');
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    setCart(prev => {
      let newCart = [...prev];
      validItems.forEach(item => {
        const product = item.product!;
        const qtyToAdd = Math.min(item.quantity, product.stock);
        const existingIndex = newCart.findIndex(c => c.id === product.id);

        if (existingIndex > -1) {
          const newQty = Math.min(newCart[existingIndex].quantity + qtyToAdd, product.stock);
          newCart[existingIndex] = { ...newCart[existingIndex], quantity: newQty };
          updatedCount++;
        } else {
          newCart.push({ ...product, quantity: qtyToAdd });
          addedCount++;
        }
      });
      return newCart;
    });

    toast.success(`${addedCount + updatedCount} produtos adicionados ao carrinho!`);
    setShowBulkImport(false);
    setBulkImportText('');
  };

  if (!selectedClient && profile?.role !== 'promotor') {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] pb-24 font-sans">
      <div ref={headerRef} className="sticky top-0 z-40 w-full shadow-sm">
        <header className="bg-brand-blue p-4 pt-safe border-b border-white/5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            {profile?.role === 'admin' && (
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/dashboard')} 
                className="p-2 bg-white/10 rounded-full text-white shadow-sm"
                title="Dashboard"
              >
                <TrendingUp size={20} />
              </motion.button>
            )}
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                await setSelectedClient(null);
                navigate('/');
              }} 
              className="p-2 bg-white/10 rounded-full text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </motion.button>
          
          {/* Star Logo */}
          <div className="w-8 h-8 bg-brand-orange text-white rounded-lg flex items-center justify-center p-1.5 shadow-md shadow-brand-orange/20 shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-white font-display font-bold text-base leading-tight tracking-tight uppercase truncate">
              {profile?.role === 'promotor' ? 'Catálogo Promotor' : (selectedClient?.tradeName || selectedClient?.name)}
            </h1>
            <p className="text-white/85 text-[10px] font-medium uppercase tracking-wider font-mono">
              {profile?.role === 'promotor' ? getRegionalLabel(profile?.regional) : `${selectedClient?.city} • ${selectedClient?.id}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPendingCarts(true)} 
              className={cn(
                "p-2 bg-white/20 rounded-full text-white relative transition-all shadow-sm",
                pendingCarts.length > 0 ? "animate-bounce" : "opacity-50"
              )}
            >
              <div className="relative">
                <ShoppingCart size={20} />
                {pendingCarts.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-yellow-400 text-orange-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    {pendingCarts.length}
                  </span>
                )}
              </div>
            </motion.button>
             <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowQuickOrder(true)} 
              className="p-2 bg-white/20 rounded-full text-white relative shadow-sm"
            >
              <Zap size={20} />
              {quickOrderProducts.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowBulkImport(true)} 
              className="p-2 bg-white/20 rounded-full text-white relative shadow-sm"
              title="Subir por EAN e Quantidade"
            >
              <ClipboardList size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              className="p-2 bg-white/20 rounded-full text-white"
            >
              <History size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowProfile(true)}
              className="p-2 bg-white/20 rounded-full text-white"
              title="Meu Perfil"
            >
              <Settings size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)} 
              className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-md hover:bg-orange-50 transition-colors"
            >
              <ShoppingCart size={18} />
              <span>{cartCount}</span>
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {banners.map(banner => (
          <motion.div key={banner.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={cn("p-3 text-center text-xs font-bold flex items-center justify-center gap-2", banner.type === 'info' ? "bg-blue-500 text-white" : banner.type === 'warning' ? "bg-yellow-500 text-black" : "bg-green-500 text-white")}>
            <Bell size={14} />{banner.text}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="bg-white dark:bg-[#1E1E1E] border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex">
          {['produtos', 'ofertas', 'lancamentos'].map(tab => (
            <motion.button 
              key={tab} 
              whileHover={{ backgroundColor: "rgba(255, 90, 0, 0.05)" }}
              onClick={() => setActiveTab(tab as any)} 
              className={cn("flex-1 py-2.5 text-xs font-display font-bold transition-all relative uppercase tracking-wider", activeTab === tab ? "text-brand-orange" : "text-slate-400")}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{tab === 'produtos' ? '🛍 Produtos' : tab === 'ofertas' ? '🔥 Ofertas' : '🆕 Lançamentos'}</span>
                <span className={cn("text-[9px] font-mono font-black px-1.5 rounded-full", activeTab === tab ? "bg-brand-orange/10 text-brand-orange" : "bg-slate-100 text-slate-400")}>
                  {counts.tabCounts[tab as keyof typeof counts.tabCounts]}
                </span>
              </div>
              {activeTab === tab && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-brand-orange rounded-full" />
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>

      <div className="p-4 max-w-[1400px] mx-auto space-y-4">
        <ConfigWarning />
        
        {/* Split responsive layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* LEFT SIDEBAR (Desktop only) */}
          <aside 
            style={{ top: headerHeight + 24, height: `calc(100vh - ${headerHeight + 48}px)` }}
            className="hidden lg:block w-[280px] shrink-0 self-start sticky overflow-y-auto pr-2 pb-10 space-y-6 scroll-smooth"
          >
            
            {/* Brands/Manufacturers Card with official logo */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Indústrias</h3>
                {selectedManufacturers.length > 0 && (
                  <button 
                    onClick={() => setSelectedManufacturers([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {manufacturers.map(m => {
                  const isSelected = selectedManufacturers.includes(m);
                  const logoUrl = getManufacturerLogo(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedManufacturers(prev => prev.filter(x => x !== m));
                        } else {
                          setSelectedManufacturers(prev => [...prev, m]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all text-left",
                        isSelected 
                          ? "bg-orange-50/80 dark:bg-orange-950/20 border-orange-500 shadow-sm" 
                          : "bg-gray-50/50 dark:bg-gray-800/40 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 shrink-0 border border-gray-100 shadow-sm overflow-hidden">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt={m} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] font-black text-gray-400 uppercase">
                            {m.substring(0, 3)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-bold truncate",
                          isSelected ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"
                        )}>
                          {m}
                        </p>
                        <p className="text-[9px] text-gray-400 font-medium">
                          {products.filter(p => p.manufacturer === m).length} itens
                        </p>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                      )}>
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories Card */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Categorias</h3>
                {selectedCategories.length > 0 && (
                  <button 
                    onClick={() => setSelectedCategories([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {categories.map(c => {
                  const isSelected = selectedCategories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCategories(prev => prev.filter(x => x !== c));
                        } else {
                          setSelectedCategories(prev => [...prev, c]);
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1",
                        isSelected 
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                          : "bg-gray-50/50 dark:bg-gray-800/40 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      {isSelected && <Check size={10} />}
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Filters Card */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Status</h3>
                {statusFilters.length > 0 && (
                  <button 
                    onClick={() => setStatusFilters([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'discount', label: '🏷️ Com Desconto', icon: Flame },
                  { id: 'no-discount', label: '📦 Preço Regular', icon: Package },
                  { id: 'in-stock', label: '✅ Em Estoque', icon: CheckCircle2 },
                  { id: 'out-stock', label: '❌ Sem Estoque', icon: AlertCircle },
                  { id: 'new', label: '🆕 Lançamentos', icon: Sparkles },
                  { id: 'promotional', label: '🔥 Promocionais', icon: Zap },
                ].map(item => {
                  const isSelected = statusFilters.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isSelected) {
                          setStatusFilters(prev => prev.filter(x => x !== item.id));
                        } else {
                          setStatusFilters(prev => [...prev, item.id]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left",
                        isSelected 
                          ? "bg-orange-50/40 dark:bg-orange-950/10 border-orange-300" 
                          : "bg-gray-50/30 dark:bg-gray-800/20 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon size={13} className={cn(isSelected ? "text-orange-600" : "text-gray-400")} />
                        <span className={cn("text-[11px] font-bold", isSelected ? "text-orange-600" : "text-gray-600 dark:text-gray-400")}>
                          {item.label}
                        </span>
                      </div>
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center",
                        isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                      )}>
                        {isSelected && <Check size={8} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* MAIN CATALOG CONTENT AREA */}
          <div className="flex-1 w-full space-y-4">
            
            {/* Filters and search row */}
            <div 
              style={{ top: headerHeight - 1 }}
              className="sticky z-20 bg-slate-50 dark:bg-[#121212] py-2.5 -mx-4 px-4 flex flex-col gap-3 transition-all"
            >
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="search" placeholder="Buscar por nome, código, fabricante..." value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-full py-3.5 pl-12 pr-14 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all shadow-sm" />
                  <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-brand-orange/10 text-brand-orange rounded-full hover:bg-brand-orange/20 transition-colors"
                  >
                    <Camera size={18} />
                  </button>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsFilterOpen(true)}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3.5 rounded-full text-gray-600 dark:text-white flex items-center gap-2 shadow-sm relative"
                >
                  <SlidersHorizontal size={18} />
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0) && (
                    <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {selectedManufacturers.length + selectedCategories.length + statusFilters.length}
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Mobile quick brand selection list (rendered horizontal scroll only under lg screen size) */}
              <div className="lg:hidden w-full overflow-x-auto pb-2 scrollbar-none flex gap-3">
                {manufacturers.map(m => {
                  const isSelected = selectedManufacturers.includes(m);
                  const logoUrl = getManufacturerLogo(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedManufacturers(prev => prev.filter(x => x !== m));
                        } else {
                          setSelectedManufacturers(prev => [...prev, m]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full border transition-all shrink-0 shadow-sm",
                        isSelected 
                          ? "bg-orange-100 border-orange-500 text-orange-700 font-bold" 
                          : "bg-white dark:bg-[#1E1E1E] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 border border-gray-100 overflow-hidden shrink-0 shadow-sm">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt={m} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[8px] font-black text-gray-400">
                            {m.substring(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold leading-none">{m}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={exportCatalogToPDF}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-orange-600 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Download size={14} /> CATALOGO PDF
                </motion.button>
                
                <div className="flex-1 flex gap-2 relative">
                   <div className="relative flex-1 group">
                     <button 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 dark:text-white shadow-sm flex items-center justify-between group-hover:border-orange-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-orange-600" />
                        <span>{
                          sortBy === 'price-asc' ? 'Menor preço' :
                          sortBy === 'price-desc' ? 'Maior preço' :
                          sortBy === 'discount' ? 'Maior desconto' :
                          sortBy === 'stock' ? 'Maior estoque' :
                          sortBy === 'az' ? 'A → Z' :
                          sortBy === 'za' ? 'Z → A' :
                          sortBy === 'recent' ? 'Lançamentos' : 'Ordenar'
                        }</span>
                      </div>
                      <ChevronDown size={14} className={cn("transition-transform", isSortOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {isSortOpen && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setIsSortOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-[70] overflow-hidden p-1.5"
                          >
                            {[
                              { id: 'price-asc', label: 'Menor preço', icon: '$', color: 'text-green-600 bg-green-50' },
                              { id: 'price-desc', label: 'Maior preço', icon: '💰', color: 'text-orange-600 bg-orange-50' },
                              { id: 'discount', label: 'Maior desconto', icon: '🏷️', color: 'text-yellow-600 bg-yellow-50' },
                              { id: 'only-discount', label: 'Apenas Descontos', icon: '🎯', color: 'text-pink-600 bg-pink-50' },
                              { id: 'stock', label: 'Maior estoque', icon: '📦', color: 'text-amber-700 bg-amber-50' },
                              { id: 'az', label: 'A → Z', icon: 'abc', color: 'text-blue-600 bg-blue-50' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  if (item.id === 'only-discount') {
                                    if (!statusFilters.includes('discount')) setStatusFilters(prev => [...prev, 'discount']);
                                    setSortBy('discount');
                                  } else {
                                    setSortBy(item.id as any);
                                  }
                                  setIsSortOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                  sortBy === item.id && "bg-orange-50 dark:bg-orange-900/10 text-orange-600"
                                )}
                              >
                                <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black", item.color)}>
                                  {item.icon}
                                </span>
                                {item.label}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                   </div>
                </div>
              </div>

              {/* Active Filter Chips */}
              <div className="flex flex-wrap gap-2 items-center">
                <AnimatePresence>
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                        setSelectedManufacturers([]);
                        setSelectedCategories([]);
                        setStatusFilters([]);
                        setPriceRange([0, 10000]);
                      }}
                      className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-red-100 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={12} /> Limpar Tudo
                    </motion.button>
                  )}
                  {priceRange[0] > 0 || priceRange[1] < 10000 ? (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      De {formatCurrency(priceRange[0])} até {formatCurrency(priceRange[1])} <X size={12} className="cursor-pointer" onClick={() => setPriceRange([0, 10000])} />
                    </motion.div>
                  ) : null}
                  {selectedManufacturers.map(m => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={m} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {m} <X size={12} className="cursor-pointer" onClick={() => setSelectedManufacturers(prev => prev.filter(x => x !== m))} />
                    </motion.div>
                  ))}
                  {selectedCategories.map(c => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={c} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {c} <X size={12} className="cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(x => x !== c))} />
                    </motion.div>
                  ))}
                  {statusFilters.map(s => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={s} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {s === 'discount' ? 'Com Desconto' : s === 'no-discount' ? 'Sem Desconto' : s === 'in-stock' ? 'Em Estoque' : s === 'out-stock' ? 'Sem Estoque' : s === 'new' ? 'Lançamento' : 'Promocional'} 
                      <X size={12} className="cursor-pointer" onClick={() => setStatusFilters(prev => prev.filter(x => x !== s))} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <span className="text-[10px] font-bold text-gray-400 ml-auto">
                  Resultados: <b>{filteredProducts.length}</b> de {products.length}
                </span>
              </div>
            </div>

            <main className="w-full">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                  {[...Array(10)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm animate-pulse h-64" />)}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-500"><Package size={48} className="mx-auto mb-4" /><p>Nenhum produto encontrado.</p></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                  {displayedProducts.map((p, index) => {
                    const cartItem = cart.find(item => item.id === p.id);
                    return (
                      <ProductCard
                        key={`${p.id}-${index}`}
                        product={p}
                        cartQuantity={cartItem?.quantity || 0}
                        isFavorite={isFavorite(p.id)}
                        isSold={soldProductIds.has(p.id)}
                        profileRole={profile?.role}
                        onAddToCart={addToCart}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantityDirectly={setQuantityDirectly}
                        onToggleFavorite={toggleFavorite}
                        onSetZoomImage={handleSetZoomImage}
                        onSetUpdatingImageProduct={handleSetUpdatingImageProduct}
                      />
                    );
                  })}
                  {displayedProducts.length < filteredProducts.length && (
                    <div id="load-more-sentinel" className="col-span-full flex justify-center py-6">
                      <button
                        onClick={() => setDisplayLimit(prev => Math.min(prev + 32, filteredProducts.length))}
                        className="bg-orange-100 dark:bg-orange-950/20 hover:bg-orange-200 dark:hover:bg-orange-900/15 text-orange-600 dark:text-orange-400 px-6 py-3 rounded-full font-bold text-xs shadow-sm transition-colors cursor-pointer"
                      >
                        Carregar Mais Produtos ({filteredProducts.length - displayedProducts.length} restantes)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Cart Sheet */}
      <AnimatePresence>
        {showPendingCarts && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-600 text-white">
                <h3 className="font-black text-lg">🛒 Carts Pendentes</h3>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPendingCarts(false)}
                >
                  <X size={24} />
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {pendingCarts.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <ShoppingCart size={48} className="mx-auto mb-2" />
                    <p className="font-bold">Nenhum outro carrinho aberto</p>
                  </div>
                ) : (
                  pendingCarts.map((pCart, i) => (
                    <div key={i} className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {pCart.clientName}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {pCart.items.length} itens • {formatCurrency(pCart.items.reduce((sum, it) => sum + it.finalPrice * it.quantity, 0))}
                          </p>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,107,0,1)" : "#fb923c") }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const client = allClients.find(c => c.id === pCart.clientId);
                            if (client) {
                              localStorage.setItem('selectedClient', JSON.stringify(client));
                              window.location.reload();
                            } else {
                              // If not in partial list, try to fetch it
                              dataService.getClients(undefined, true).then(fullList => {
                                const fullClient = fullList.find(c => c.id === pCart.clientId);
                                if (fullClient) {
                                  localStorage.setItem('selectedClient', JSON.stringify(fullClient));
                                  window.location.reload();
                                }
                              });
                            }
                          }}
                          className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm transition-colors"
                        >
                          Ir para Carrinho
                        </motion.button>
                      </div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {pCart.items.slice(0, 5).map((item, idx) => (
                          <img key={idx} src={getProductImageUrl(item.photo)} className="inline-block h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-white" title={item.description} />
                        ))}
                        {pCart.items.length > 5 && (
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold">
                            +{pCart.items.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOfferSuggestions && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-[32px] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-600 text-white">
                <div className="flex items-center gap-2">
                  <Flame size={24} className="text-yellow-400" />
                  <div>
                    <h3 className="font-black text-xl italic tracking-tighter">TURBINE SEU PEDIDO!</h3>
                    <p className="text-[10px] font-bold opacity-80 uppercase">Não perca estas ofertas imperdíveis</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowOfferSuggestions(false)} 
                  className="p-2 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Sugestões Especiais</p>
                <div className="grid grid-cols-1 gap-3">
                  {products.filter(p => p.type === 'offer').map((p, i) => {
                    const inCart = cart.find(item => item.id === p.id);
                    const wasSold = soldProductIds.has(p.id);
                    const hasStock = p.stock > 0;
                    
                    return (
                      <div key={i} className={cn(
                        "relative flex gap-4 p-4 bg-white dark:bg-[#1E1E1E] rounded-2xl border-2 transition-all group",
                        inCart ? "border-orange-500 bg-orange-50/20" : "border-transparent hover:border-gray-200"
                      )}>
                        <div className="w-20 h-20 bg-white rounded-xl overflow-hidden p-2 flex-none relative">
                          <img src={getProductImageUrl(p.photo)} className="w-full h-full object-contain" />
                          {wasSold && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                              <span className="bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase leading-none">JÁ VENDIDO</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-bold text-orange-600 uppercase">{p.manufacturer}</span>
                            {inCart && <span className="bg-orange-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full ring-2 ring-orange-100 italic">No Carrinho</span>}
                          </div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate mt-1">{p.description}</h4>
                          <div className="mt-2 flex items-baseline gap-2">
                             <span className="text-sm font-black text-orange-600">{formatCurrency(p.finalPrice)}</span>
                             {p.discount > 0 && <span className="text-[10px] text-gray-400 line-through">{formatCurrency(p.salePrice)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center">
                          {inCart ? (
                            <div className="flex items-center gap-3 bg-orange-100 rounded-xl p-1">
                              <motion.button whileHover={{ scale: 1.2, backgroundColor: "white" }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(p.id, -1)} className="p-2 text-red-600 rounded-lg transition-colors"><Minus size={16} /></motion.button>
                              <span className="text-sm font-black w-4 text-center">{inCart.quantity}</span>
                              <motion.button 
                                whileHover={{ scale: 1.2, backgroundColor: "white" }}
                                whileTap={{ scale: 0.8 }}
                                onClick={() => updateQuantity(p.id, 1)} 
                                disabled={inCart.quantity >= p.stock}
                                className={cn("p-2 rounded-lg transition-colors", inCart.quantity >= p.stock ? "text-gray-300 cursor-not-allowed" : "text-green-600")}
                              >
                                <Plus size={16} />
                              </motion.button>
                            </div>
                          ) : (
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={!hasStock}
                              onClick={() => addToCart(p)} 
                              className={cn(
                                "px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg min-w-[100px]",
                                hasStock ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              )}
                            >
                              {hasStock ? 'Adicionar' : 'Esgotado'}
                            </motion.button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-[#1E1E1E] border-t border-gray-100 flex gap-3">
                 <motion.button whileHover={{ scale: 1.02, backgroundColor: "rgba(0,0,0,0.05)" }} whileTap={{ scale: 0.98 }} onClick={() => setShowOfferSuggestions(false)} className="flex-1 py-4 text-gray-500 font-bold text-sm uppercase rounded-xl transition-colors">Revisar Itens</motion.button>
                 <motion.button 
                   whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                   whileTap={{ scale: 0.98 }}
                   onClick={finalizeOrder} 
                   disabled={isFinalizing}
                   className="flex-[2] bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isFinalizing ? <RefreshCw className="animate-spin" size={20} /> : 'FINALIZAR PEDIDO'} <ChevronRight size={20} />
                 </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScannerOpen && (
          <BarcodeScanner 
            onScan={handleScan} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#FDF6F0] dark:bg-[#121212] z-50 shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsCartOpen(false)} 
                    className="p-2 bg-white/20 rounded-full text-white transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </motion.button>
                  <h2 className="text-white font-bold text-lg">Carrinho</h2>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCart([]);
                    setManualClientName('');
                  }} 
                  className="text-white/80 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Limpar
                </motion.button>
              </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-full opacity-40"><ShoppingCart size={64} /><p className="font-bold mt-4">Vazio</p></div> : (
                  <>
                    <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm border-l-4 border-orange-600 space-y-3">
                      {profile?.role === 'promotor' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Nome do Cliente</label>
                          <input 
                            type="text"
                            placeholder="Digite o nome do cliente..."
                            value={manualClientName}
                            onChange={(e) => setManualClientName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-2 px-3 text-xs font-bold focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                      )}
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {profile?.role === 'promotor' ? `Promotor: ${profile.name}` : (selectedClient?.tradeName || selectedClient?.name)}
                      </p>
                      {profile?.role !== 'promotor' && selectedClient && (
                        <p className="text-xs text-gray-500 mt-1">CNPJ: {selectedClient.cnpj}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      {cart.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white dark:bg-[#1E1E1E] p-3 rounded-2xl shadow-sm flex gap-3">
                          <img src={getProductImageUrl(item.photo)} className="w-16 h-16 object-contain rounded-xl" />
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.description}</h4>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-black text-orange-600">{formatCurrency(item.finalPrice)}</span>
                              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1">
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, -1)} className="text-red-600"><Minus size={14} /></motion.button>
                                <input 
                                  type="text" 
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) {
                                      setQuantityDirectly(item.id, val);
                                    } else if (e.target.value === '') {
                                      setQuantityDirectly(item.id, 0);
                                    }
                                  }}
                                  className="w-10 text-center text-xs font-bold bg-transparent border-none focus:ring-0"
                                />
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, 1)} className="text-green-600"><Plus size={14} /></motion.button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-white dark:bg-[#1E1E1E] border-t border-gray-100 dark:border-gray-800 pb-safe">
                <div className="flex justify-between items-center mb-4">
                   <span className="font-bold">Total:</span><span className="text-xl font-black text-orange-600">{formatCurrency(cartTotal)}</span>
                </div>
                {profile?.role === 'promotor' ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const orderData = {
                            id: 'PROMO_' + Date.now(),
                            date: new Date().toISOString(),
                            clientId: 'PROMOTOR',
                            clientName: `PROMOTOR: ${profile.name}`,
                            seller: profile.name,
                            total: cartTotal,
                            sellerPhone: profile.phone
                          };
                          generateOrderPDF(orderData, cart);
                        }}
                        className="bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
                      >
                        <FileText size={18} /> PDF
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const orderData = {
                            id: 'PROMO_' + Date.now(),
                            date: new Date().toISOString(),
                            clientId: 'PROMOTOR',
                            clientName: `PROMOTOR: ${profile.name}`,
                            seller: profile.name,
                            total: cartTotal,
                            sellerPhone: profile.phone
                          };
                          await generateOrderExcel(orderData, cart);
                        }}
                        className="bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
                      >
                        <FileSpreadsheet size={18} /> Excel
                      </motion.button>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "#EA580C" }}
                      whileTap={{ scale: 0.98 }}
                      disabled={cart.length === 0 || isFinalizing} 
                      onClick={finalizeOrder} 
                      className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 transition-colors uppercase tracking-widest"
                    >
                      {isFinalizing ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Finalizar Pedido
                    </motion.button>
                  </div>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: "#128C7E" }}
                    whileTap={{ scale: 0.98 }}
                    disabled={cart.length === 0} 
                    onClick={handleCheckout} 
                    className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 transition-colors"
                  >
                    <ShoppingCart size={20} /> Finalizar WhatsApp
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updatingImageProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
                <div>
                  <h3 className="font-black text-lg">Atualizar Foto</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest">{updatingImageProduct.description}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }} 
                  whileTap={{ scale: 0.9 }} 
                  onClick={() => setUpdatingImageProduct(null)} 
                  className="p-2 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </motion.button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-gray-200">
                    <img src={getProductImageUrl(updatingImageProduct.photo)} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-xs text-gray-500 font-bold">Foto Atual</p>
                    <p className="text-[10px] text-gray-400 mt-1">ID: {updatingImageProduct.id}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Como deseja atualizar?</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.05, borderStyle: "solid", borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSearchImages(updatingImageProduct)}
                      disabled={searchingImages}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group"
                    >
                      <Sparkles className={cn("text-blue-500 group-hover:scale-110 transition-transform", searchingImages && "animate-spin")} size={24} />
                      <span className="text-[10px] font-black uppercase">Pesquisar com IA</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.05, borderStyle: "solid", borderColor: "#ea580c", backgroundColor: "rgba(234, 88, 12, 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(updatingImageProduct.description + ' ' + updatingImageProduct.manufacturer)}`, '_blank')}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group"
                    >
                      <Globe className="text-orange-500 group-hover:scale-110 transition-transform" size={24} />
                      <span className="text-[10px] font-black uppercase">Google Imagens</span>
                    </motion.button>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="relative">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-2">Ou cole uma URL direta da imagem</label>
                    <div className="flex gap-2">
                       <input 
                         type="url" 
                         value={manualImageUrl} 
                         onChange={(e) => setManualImageUrl(e.target.value)}
                         placeholder="https://exemplo.com/foto.jpg"
                         className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                       />
                       <motion.button 
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         disabled={!manualImageUrl}
                         onClick={() => handleUpdateImage(updatingImageProduct, manualImageUrl)}
                         className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-transform"
                       >
                         SALVAR
                       </motion.button>
                    </div>
                  </div>

                  {searchingImages && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <RefreshCw className="animate-spin text-blue-500" size={32} />
                      <p className="text-xs font-bold text-gray-500">IA pesquisando as melhores fotos...</p>
                    </div>
                  )}

                  {searchImages.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase ml-1">Sugestões Encontradas</p>
                      <div className="grid grid-cols-2 gap-3">
                        {searchImages.map((url, i) => (
                          <div key={i} className="group relative aspect-square bg-gray-100 rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer" onClick={() => handleUpdateImage(updatingImageProduct, url)}>
                            <img src={url} className="w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-white font-black text-[10px] uppercase">Selecionar</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-500 text-white"><h3 className="font-black text-lg">Sugestão de Pedido</h3><button onClick={() => setShowQuickOrder(false)}>✕</button></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {quickOrderProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                    <img src={getProductImageUrl(p.photo)} className="w-12 h-12 object-contain" />
                    <div className="flex-1"><p className="text-xs font-bold truncate">{p.description}</p><p className="text-[10px] text-orange-600 font-bold">{formatCurrency(p.finalPrice)}</p></div>
                    <button onClick={() => addToCart(p)} className="bg-orange-600 text-white p-2 rounded-lg"><Plus size={16} /></button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-brand-blue text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ListPlus size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight">Subir Produtos por EAN</h3>
                    <p className="text-white/70 text-[11px]">Cole uma lista com códigos de barras e quantidades</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBulkImport(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                {/* Left Pane: Input Textarea */}
                <div className="p-6 flex flex-col gap-4 overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase block tracking-wider">
                      Lista de Entrada
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Insira um item por linha. Separe o EAN (ou Código) e a quantidade com espaço ou tabulação.
                    </p>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1.5 font-sans">
                    <p className="font-bold">Exemplo de formato:</p>
                    <pre className="font-mono bg-white/50 dark:bg-black/20 p-2 rounded-lg text-[11px] overflow-x-auto">
                      7891150037465{"\t"}6{"\n"}
                      7891000342345{"\t"}10{"\n"}
                      COD019{"\t"}2
                    </pre>
                  </div>

                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder={"7891150037465\t6\n7891000342345\t10"}
                    className="flex-1 min-h-[180px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-2xl p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none placeholder-gray-400 dark:text-white"
                  />

                  {bulkImportText && (
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Total de linhas: {bulkImportText.split('\n').filter(l => l.trim()).length}</span>
                      <button 
                        onClick={() => setBulkImportText('')}
                        className="text-red-500 hover:text-red-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                        Limpar texto
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Pane: Parsed Items Preview */}
                <div className="p-6 flex flex-col gap-4 overflow-y-auto bg-gray-50/50 dark:bg-black/10">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase block tracking-wider">
                      Visualização dos Produtos ({parsedBulkItems.filter(item => item && item.product && !item.error).length} identificados)
                    </label>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px] md:max-h-none">
                    {parsedBulkItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center gap-3 text-gray-400 dark:text-gray-500">
                        <ClipboardList size={36} className="stroke-[1.5]" />
                        <p className="text-xs font-medium">Os produtos identificados aparecerão aqui em tempo real.</p>
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
                                src={getProductImageUrl(item.product.photo)} 
                                alt={item.product.description} 
                                className="w-12 h-12 object-contain bg-white rounded-xl border border-gray-100 dark:border-gray-800 shrink-0" 
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-200/50 dark:border-gray-700 text-gray-400">
                                <Package size={20} />
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black truncate text-gray-800 dark:text-gray-200">
                                {item.product ? item.product.description : `Código: ${item.code}`}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200/40 dark:border-gray-700/40">
                                  {item.code}
                                </span>
                                
                                {hasError ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                                    {item.error}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                                    Disponível
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Quantity & Price */}
                            <div className="text-right shrink-0">
                              <p className="text-xs font-black text-gray-800 dark:text-gray-200">
                                Qtd: <span className="text-blue-600 dark:text-blue-400">{item.quantity}</span>
                              </p>
                              {item.product && !hasError && (
                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Valor Total Estimado:</p>
                  <p className="text-xl font-black text-brand-orange mt-0.5">{formatCurrency(bulkImportTotal)}</p>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowBulkImport(false)}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddBulkToCart}
                    disabled={parsedBulkItems.filter(item => item && item.product && !item.error).length === 0}
                    className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-brand-orange hover:bg-brand-orange/90 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-orange/10 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Adicionar ao Carrinho ({parsedBulkItems.filter(item => item && item.product && !item.error).length})
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage} alt="Expanded View" className="max-w-full max-h-full object-contain rounded-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProductDetails && (() => {
          const product = selectedProductDetails;
          const cartItem = cart.find(item => item.id === product.id);
          const cartQty = cartItem ? cartItem.quantity : 0;
          const hasStock = product.stock > 0;
          const economy = product.salePrice - product.finalPrice;
          const calculatedDiscount = product.salePrice > 0 ? (economy / product.salePrice) * 100 : 0;
          const finalDiscount = applyCustomRounding(product.discount || calculatedDiscount);
          
          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-gray-100 dark:border-gray-800"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedProductDetails(null)} 
                  className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors z-10 cursor-pointer"
                >
                  <X size={20} />
                </button>

                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {/* Left Column: Image & Quick actions */}
                  <div className="flex flex-col gap-4">
                    <div className="aspect-square w-full bg-white dark:bg-[#2A2A2A] rounded-2xl p-4 flex items-center justify-center relative overflow-hidden border border-gray-100 dark:border-gray-800 shadow-inner group">
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                        {product.type === 'offer' && <span className="bg-orange-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm"><Flame size={10} /> Oferta</span>}
                        {product.type === 'new' && <span className="bg-purple-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm"><Sparkles size={10} /> Novo</span>}
                      </div>

                      <img 
                        src={getProductImageUrl(product.photo)} 
                        alt={product.description} 
                        className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const originalUrl = product.photo || "";
                          if (originalUrl && !target.src.includes('weserv.nl')) {
                            target.src = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}&output=jpg&q=90&bg=white&fit=contain&w=500&h=500`;
                          } else if (!target.src.includes('placehold.co')) {
                            target.src = 'https://placehold.co/400x400/FFFFFF/DDDDDD?text=Foto+Indisponivel';
                          }
                        }}
                      />

                      {/* Zoom click */}
                      <button 
                        onClick={() => setSelectedImage(getProductImageUrl(product.photo))}
                        className="absolute bottom-3 right-3 p-2 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-sm rounded-full text-gray-700 dark:text-gray-300 shadow hover:bg-white transition-colors cursor-pointer"
                        title="Ver imagem ampliada"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleFavorite(product)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer",
                          isFavorite(product.id)
                            ? "bg-red-50 dark:bg-red-950/10 text-red-600 border-red-200 dark:border-red-900/35"
                            : "bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/60 hover:bg-gray-100"
                        )}
                      >
                        <Star size={14} fill={isFavorite(product.id) ? "currentColor" : "none"} />
                        <span>{isFavorite(product.id) ? 'Favoritado' : 'Adicionar Favoritos'}</span>
                      </button>

                      {profile?.role === 'admin' && (
                        <button 
                          onClick={() => {
                            setSelectedProductDetails(null);
                            handleSetUpdatingImageProduct(product);
                          }}
                          className="flex items-center justify-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors cursor-pointer"
                          title="Atualizar imagem do produto"
                        >
                          <Camera size={14} />
                          <span className="text-xs font-bold">Atualizar Foto</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Product details & actions */}
                  <div className="flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      {/* Meta information */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded-md">
                          ID: {product.id}
                        </span>
                        {product.ean && (
                          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                            EAN: {product.ean}
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-black px-2.5 py-1 rounded-md",
                          hasStock 
                            ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" 
                            : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
                        )}>
                          {hasStock ? `${product.stock} Em Estoque` : 'Sem Estoque'}
                        </span>
                      </div>

                      {/* Product Title / Description */}
                      <div className="space-y-1">
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                          {product.description}
                        </h2>
                        {product.manufacturer && (
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Marca: {product.manufacturer}
                          </p>
                        )}
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                          Categoria: {product.category}
                        </p>
                      </div>

                      {/* Prices panel */}
                      <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100/50 dark:border-orange-900/10 p-4 rounded-2xl space-y-2">
                        {finalDiscount > 0 && profile?.role !== 'promotor' ? (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-bold text-gray-400 line-through">
                                De: {formatCurrency(product.salePrice)}
                              </span>
                              <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                {finalDiscount.toFixed(0)}% OFF
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                                {formatCurrency(product.finalPrice)}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500">
                                Preço Final
                              </span>
                            </div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-bold">
                              Você economiza: {formatCurrency(economy)} por unidade
                            </p>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                              {formatCurrency(product.finalPrice)}
                            </span>
                            <p className="text-[10px] font-medium text-gray-500">
                              Preço Unitário
                            </p>
                          </div>
                        )}

                        {product.discountExpiryDate && finalDiscount > 0 && (
                          <div className="text-[10px] text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1 border-t border-orange-100 dark:border-orange-900/30 pt-2 mt-1">
                            <History size={12} />
                            <span>Válido até: {new Date(product.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity controls & Add to Order action */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                      {cartQty > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            Já adicionado ao seu pedido ({cartQty} un)
                          </p>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Minus size={16} />
                            </button>
                            
                            <div className="flex-1 text-center font-black text-lg text-gray-900 dark:text-white">
                              {cartQty}
                            </div>
                            
                            <button 
                              onClick={() => updateQuantity(product.id, 1)}
                              className="w-12 h-12 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          disabled={!hasStock}
                          onClick={() => addToCart(product)}
                          className={cn(
                            "w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer",
                            hasStock 
                              ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20 hover:shadow-orange-500/30"
                              : "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none"
                          )}
                        >
                          <ShoppingCart size={16} />
                          <span>{hasStock ? 'Adicionar ao Pedido' : 'Sem Estoque'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderSuccess && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] w-full max-w-sm p-8 text-center space-y-6">
              <CheckCircle2 size={64} className="mx-auto text-green-500" />
              <h3 className="text-2xl font-black">Sucesso!</h3>
              <div className="space-y-3">
                {profile?.role !== 'promotor' && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => sendToWhatsApp(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg"><MessageCircle /><span>Enviar WhatsApp</span><ExternalLink /></motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => generateOrderPDF(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-orange-50 rounded-2xl font-bold text-orange-700 border border-orange-100"><FileText /><span>Baixar PDF</span><Download /></motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => generateOrderExcel(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl font-bold text-gray-700 border border-gray-200"><FileSpreadsheet /><span>Baixar Excel</span><Download /></motion.button>
                
                {profile?.role !== 'promotor' && pendingCarts.length > 0 && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPendingCarts(true)} 
                    className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-2xl font-bold text-blue-700 animate-pulse"
                  >
                    <ShoppingCart />
                    <span className="flex-1 text-left ml-3">Finalizar próximos ({pendingCarts.length})</span>
                    <ChevronRight />
                  </motion.button>
                )}
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={async () => { setShowOrderSuccess(false); await setSelectedClient(null); navigate('/'); }} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold">
                {profile?.role === 'promotor' ? 'Novo Pedido' : 'Voltar ao Início'}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsCartOpen(true)} 
        className="fixed bottom-6 right-6 w-16 h-16 bg-brand-orange text-white rounded-full shadow-2xl shadow-brand-orange/45 flex items-center justify-center z-40 hover:bg-brand-orange-light transition-colors"
      >
        <ShoppingCart size={28} />{cartCount > 0 && <span className="absolute -top-1 -right-1 bg-white text-brand-orange w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shadow-md">{cartCount}</span>}
      </motion.button>

      {/* Advanced Filter Drawer */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsFilterOpen(false)} 
              className="fixed inset-0 bg-black/60 z-[120] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-[#121212] z-[130] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FilterIcon size={20} className="text-orange-600" />
                  <h3 className="font-black text-lg">Filtros Avançados</h3>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X size={24} />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status Group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Status do Produto</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'discount', label: '🏷️ Com Desconto', icon: Flame },
                      { id: 'no-discount', label: '📦 Preço Regular', icon: Package },
                      { id: 'in-stock', label: '✅ Em Estoque', icon: CheckCircle2 },
                      { id: 'out-stock', label: '❌ Sem Estoque', icon: AlertCircle },
                      { id: 'new', label: '🆕 Lançamentos', icon: Sparkles },
                      { id: 'promotional', label: '🔥 Promocionais', icon: Zap },
                    ].map(item => (
                      <label key={item.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <item.icon size={18} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={statusFilters.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setStatusFilters(prev => [...prev, item.id]);
                              else setStatusFilters(prev => prev.filter(x => x !== item.id));
                            }}
                            className="w-5 h-5 rounded-lg border-2 border-gray-300 text-orange-600 focus:ring-orange-500/20 transition-all cursor-pointer"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range Group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Faixa de Preço</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400">Min</span>
                      <input 
                        type="number" 
                        value={priceRange[0]} 
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400">Max</span>
                      <input 
                        type="number" 
                        value={priceRange[1]} 
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Categories Group */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center pl-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categorias</h4>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">{categories.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(c => {
                      const isSelected = selectedCategories.includes(c);
                      return (
                        <motion.button
                          key={c}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (isSelected) setSelectedCategories(prev => prev.filter(x => x !== c));
                            else setSelectedCategories(prev => [...prev, c]);
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2",
                            isSelected 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                              : "bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 text-gray-600"
                          )}
                        >
                          {isSelected && <Check size={12} />}
                          {c}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Manufacturers Group */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center pl-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fabricantes</h4>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">{manufacturers.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {manufacturers.map(m => {
                      const isSelected = selectedManufacturers.includes(m);
                      const logoUrl = getManufacturerLogo(m);
                      return (
                        <label key={m} className={cn(
                          "flex items-center justify-between p-2 rounded-2xl cursor-pointer border transition-all",
                          isSelected 
                            ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200" 
                            : "bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 border border-gray-100 overflow-hidden shadow-sm shrink-0">
                              {logoUrl ? (
                                <img 
                                  src={logoUrl} 
                                  alt={m} 
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <span className="text-[9px] font-black text-gray-400 uppercase">
                                  {m.substring(0, 2)}
                                </span>
                              )}
                            </div>
                            <span className={cn("text-[11px] font-bold", isSelected ? "text-orange-600" : "text-gray-600 dark:text-gray-400")}>{m}</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedManufacturers(prev => [...prev, m]);
                              else setSelectedManufacturers(prev => prev.filter(x => x !== m));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500/20"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex gap-3">
                <motion.button 
                  whileHover={{ backgroundColor: "rgba(220, 38, 38, 0.05)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedManufacturers([]);
                    setSelectedCategories([]);
                    setStatusFilters([]);
                  }}
                  className="flex-1 py-4 text-xs font-black uppercase text-gray-400 hover:text-red-600 transition-colors"
                >
                  Limpar
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-[2] bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-sm shadow-xl shadow-gray-900/10"
                >
                  VER {filteredProducts.length} PRODUTOS
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
                      {(['current', 'new', 'confirm'] as const).map((field) => (
                        <div key={field} className="relative">
                          <input
                            type={showPasswords[field] ? 'text' : 'password'}
                            placeholder={field === 'current' ? 'Senha Atual' : field === 'new' ? 'Nova Senha' : 'Confirmar Nova Senha'}
                            value={passwordData[field]}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                          />
                          <motion.button 
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPasswords[field] ? <EyeOff size={18} /> : <Eye size={18} />}
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
    </div>
  );
}
