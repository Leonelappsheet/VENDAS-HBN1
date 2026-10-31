import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Product, Client, OrderItem, Favorite, Order, BannerMessage } from '../types';
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
  ShoppingBag,
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
  ListPlus,
  Share2,
  Link2,
  Building2,
  Copy,
  Send,
  Share,
  Clock,
  Clock3,
  Timer,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, safeCopyToClipboard, getPublicBaseUrl } from '../lib/utils';
import { Toaster, toast } from 'sonner';
import { ConfigWarning } from '../components/ConfigWarning';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductImageShareModal } from '../components/ProductImageShare';
import { OrderSchema } from '../lib/schemas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { getRegionalLabel } from '../constants/regionals';
import { preloadProductThumbnails, getManufacturerLogo, createCanvasFallbackImage, getBase64Image, normalizeEANKey, sanitizeImageUrl } from '../utils/imageExportHelper';
import { findBestMatchingClient, formatCNPJ } from '../utils/clientMatcher';
import { 
  drawPDFHeader, 
  drawClientDataCard, 
  drawBottomSummaryCards, 
  drawObservationsBox, 
  drawPDFFooterStrip 
} from '../utils/pdfTemplate';

const applyCustomRounding = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return 0;
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  if (rounded === 0.99) return 1.00;
  return rounded;
};

export const enrichOrderItem = (item: OrderItem, productsList: Product[] = []): OrderItem => {
  const cleanEan = (e?: string) => e ? String(e).trim().replace(/^0+/, '') : '';
  const cleanId = (id?: string) => id ? String(id).trim().replace(/^0+/, '') : '';
  const itemId = item.id ? String(item.id).trim() : '';
  const itemEan = item.ean ? String(item.ean).trim() : '';

  const catalogProd = productsList.find(p => {
    const pId = p.id ? String(p.id).trim() : '';
    const pEan = p.ean ? String(p.ean).trim() : '';
    if (pId && itemId && (pId === itemId || cleanId(pId) === cleanId(itemId))) return true;
    if (pEan && itemEan && (pEan === itemEan || cleanEan(pEan) === cleanEan(itemEan))) return true;
    return false;
  });

  // If matched with catalog, take fresh catalog values as primary authority
  let salePrice = catalogProd?.salePrice !== undefined && Number(catalogProd.salePrice) > 0
    ? Number(catalogProd.salePrice)
    : (Number(item.salePrice) || Number(item.finalPrice) || 0);

  let finalPrice = catalogProd?.finalPrice !== undefined && Number(catalogProd.finalPrice) > 0
    ? Number(catalogProd.finalPrice)
    : (Number(item.finalPrice) || salePrice || 0);

  let discount = catalogProd?.discount !== undefined && Number(catalogProd.discount) >= 0
    ? Number(catalogProd.discount)
    : (Number(item.discount) || 0);

  // Reconcile discount & prices
  if (discount > 0 && discount < 100 && finalPrice >= salePrice && salePrice > 0) {
    finalPrice = applyCustomRounding(salePrice * (1 - discount / 100));
  } else if (salePrice > finalPrice && finalPrice > 0 && discount <= 0) {
    discount = Math.round(((salePrice - finalPrice) / salePrice) * 100 * 100) / 100;
  }

  return {
    ...catalogProd,
    ...item,
    id: catalogProd?.id || item.id,
    ean: catalogProd?.ean || item.ean || '',
    manufacturer: catalogProd?.manufacturer || item.manufacturer || '',
    description: catalogProd?.description || item.description || '',
    category: catalogProd?.category || item.category || '',
    photo: catalogProd?.photo || item.photo || '',
    stock: catalogProd?.stock !== undefined ? catalogProd.stock : (item.stock ?? 999),
    type: catalogProd?.type || item.type || 'normal',
    discountExpiryDate: catalogProd?.discountExpiryDate || item.discountExpiryDate,
    salePrice,
    finalPrice,
    discount,
  };
};

const getProductImageUrl = (
  photoUrl: string | undefined | null,
  ean?: string | number,
  manufacturer?: string,
  description?: string
): string => {
  const sanitized = sanitizeImageUrl(photoUrl);
  const cleanEan = ean ? String(ean).replace(/\D/g, '') : '';

  if (sanitized) {
    return sanitized;
  }

  // Fallback 1: Resolve through server-side proxy which cross-matches catalog photos by EAN and keywords
  if (cleanEan || description) {
    const params = new URLSearchParams();
    if (cleanEan) params.set('ean', cleanEan);
    if (description) params.set('desc', description);
    if (manufacturer) params.set('mfg', manufacturer);
    return `/api/proxy-image?${params.toString()}`;
  }

  // Fallback 2: Manufacturer Logo
  const brandLogo = getManufacturerLogo(manufacturer || description || '');
  if (brandLogo) {
    return brandLogo;
  }

  // Fallback 3: Branded product SVG badge
  const label = encodeURIComponent((description || manufacturer || 'PRODUTO').substring(0, 30));
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f8fafc"/><rect x="20" y="20" width="360" height="360" rx="24" fill="%23ffffff" stroke="%23f1f5f9" stroke-width="4"/><text x="200" y="180" font-family="sans-serif" font-size="15" font-weight="bold" fill="%2394a3b8" text-anchor="middle">${label}</text><text x="200" y="220" font-family="sans-serif" font-size="12" font-weight="600" fill="%23ff6b00" text-anchor="middle">VENDAS HBN1</text></svg>`;
};

const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  product?: { photo?: string; ean?: string | number; manufacturer?: string; description?: string }
) => {
  const target = e.target as HTMLImageElement;
  const rawPhoto = product?.photo || '';
  const originalUrl = sanitizeImageUrl(rawPhoto);
  const cleanEan = product?.ean ? String(product.ean).replace(/\D/g, '') : '';
  const manufacturer = product?.manufacturer || '';
  const description = product?.description || '';

  // 1. Try server-side proxy with fallback parameters (handles CORS, referrer, and catalog matching)
  if (!target.dataset.triedProxy && !target.src.includes('/api/proxy-image')) {
    target.dataset.triedProxy = 'true';
    const params = new URLSearchParams();
    if (originalUrl) params.set('url', originalUrl);
    if (cleanEan) params.set('ean', cleanEan);
    if (description) params.set('desc', description);
    if (manufacturer) params.set('mfg', manufacturer);
    target.src = `/api/proxy-image?${params.toString()}`;
    return;
  }

  // 2. Try Weserv proxy for original photo if server proxy was blocked
  if (originalUrl && !target.dataset.triedWeserv && !target.src.includes('weserv.nl')) {
    target.dataset.triedWeserv = 'true';
    target.src = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}&output=jpg&q=90&bg=white&fit=contain&w=500&h=500`;
    return;
  }

  // 3. Try Open Food Facts CDN by EAN
  if (cleanEan && cleanEan.length >= 7 && !target.dataset.triedOff) {
    target.dataset.triedOff = 'true';
    target.src = `https://images.openfoodfacts.org/images/products/${cleanEan}/1.jpg`;
    return;
  }

  // 4. Try Cosmos CDN by EAN
  if (cleanEan && cleanEan.length >= 7 && !target.dataset.triedCosmos) {
    target.dataset.triedCosmos = 'true';
    target.src = `https://cdn-cosmos.bluesoft.com.br/products/${cleanEan}`;
    return;
  }

  // 5. Try Manufacturer Logo
  const brandLogo = getManufacturerLogo(manufacturer || description);
  if (brandLogo && !target.dataset.triedBrand) {
    target.dataset.triedBrand = 'true';
    target.src = brandLogo;
    return;
  }

  // 6. SVG Fallback
  if (!target.dataset.triedSvg) {
    target.dataset.triedSvg = 'true';
    const label = encodeURIComponent((description || manufacturer || 'PRODUTO').substring(0, 30));
    target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f8fafc"/><rect x="20" y="20" width="360" height="360" rx="24" fill="%23ffffff" stroke="%23f1f5f9" stroke-width="4"/><text x="200" y="180" font-family="sans-serif" font-size="15" font-weight="bold" fill="%2394a3b8" text-anchor="middle">${label}</text><text x="200" y="220" font-family="sans-serif" font-size="12" font-weight="600" fill="%23ff6b00" text-anchor="middle">VENDAS HBN1</text></svg>`;
  }
};

interface QuantityControlProps {
  productId: string;
  cartQuantity: number;
  hasStock?: boolean;
  onAddToCart: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantityDirectly: (id: string, value: number) => void;
  variant?: 'card' | 'list' | 'drawer' | 'modal';
}

const QuantityControl: React.FC<QuantityControlProps> = ({
  productId,
  cartQuantity,
  hasStock = true,
  onAddToCart,
  onUpdateQuantity,
  onSetQuantityDirectly,
  variant = 'card'
}) => {
  const [localQty, setLocalQty] = useState<string>(cartQuantity > 0 ? String(cartQuantity) : '');
  const [isPendingClear, setIsPendingClear] = useState<boolean>(false);
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPendingClear) {
      setLocalQty(cartQuantity > 0 ? String(cartQuantity) : '');
    }
  }, [cartQuantity, isPendingClear]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const parsed = parseInt(rawVal, 10);

    if (rawVal === '' || isNaN(parsed) || parsed <= 0) {
      setLocalQty('');
      setIsPendingClear(true);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setIsPendingClear(false);
        onSetQuantityDirectly(productId, 0);
      }, 2000);
    } else {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      setIsPendingClear(false);
      setLocalQty(String(parsed));
      onSetQuantityDirectly(productId, parsed);
    }
  };

  const handleMinus = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    setIsPendingClear(false);
    onUpdateQuantity(productId, -1);
  };

  const handlePlus = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    setIsPendingClear(false);
    onUpdateQuantity(productId, 1);
  };

  const showControls = cartQuantity > 0 || isPendingClear;

  if (!showControls) {
    if (variant === 'modal') {
      return (
        <button 
          onClick={onAddToCart}
          className={cn(
            "w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer",
            hasStock 
              ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20 hover:shadow-orange-500/30"
              : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-600/30 border border-amber-400/40"
          )}
        >
          {hasStock ? <ShoppingCart size={16} /> : <AlertCircle size={16} className="text-amber-200" />}
          <span>{hasStock ? 'Adicionar ao Pedido' : 'Adicionar ao Pedido (Sem Estoque)'}</span>
        </button>
      );
    }

    if (variant === 'list') {
      return (
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddToCart} 
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md min-w-[110px] flex items-center justify-center gap-1 cursor-pointer",
            hasStock 
              ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800" 
              : "bg-gradient-to-r from-amber-600 to-amber-700 text-white border border-amber-400/40 shadow-amber-600/20 hover:from-amber-700 hover:to-amber-800"
          )}
        >
          <span>{hasStock ? 'Adicionar' : 'ADICIONAR (S/ EST)'}</span>
          {!hasStock && <AlertCircle size={12} className="shrink-0 text-amber-200" />}
        </motion.button>
      );
    }

    return (
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAddToCart} 
        className={cn(
          "w-full h-7 sm:h-8 md:h-10 text-white rounded-[8px] sm:rounded-[10px] md:rounded-[12px] text-[7.5px] sm:text-[8.5px] md:text-xs font-black flex items-center justify-center gap-0.5 sm:gap-1 transition-all px-0.5 shadow-md cursor-pointer",
          hasStock 
            ? "bg-gradient-to-r from-[#FF6B00] to-[#F06292] shadow-orange-500/20 hover:brightness-105" 
            : "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border border-amber-300/40 shadow-amber-600/30 hover:brightness-110"
        )}
      >
        <span className="truncate">
          {hasStock ? 'ADICIONAR' : 'ADICIONAR (S/ ESTOQUE)'}
        </span>
        {hasStock ? (
          <ShoppingCart size={8} className="sm:size-3.5 shrink-0" />
        ) : (
          <AlertCircle size={9} className="sm:size-3.5 shrink-0 text-amber-200" />
        )}
      </motion.button>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>Já adicionado ao seu pedido ({cartQuantity || 0} un)</span>
          {isPendingClear && (
            <span className="text-[10px] text-orange-500 font-bold animate-pulse">Aguardando digitação... (2s)</span>
          )}
        </p>
        <div className={cn(
          "flex items-center justify-between gap-3 p-1.5 rounded-2xl transition-all border",
          isPendingClear 
            ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20 bg-orange-50/50 dark:bg-orange-950/20" 
            : "border-transparent bg-gray-50 dark:bg-gray-800"
        )}>
          <button 
            type="button"
            onClick={handleMinus}
            className="w-12 h-12 shrink-0 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 font-bold flex items-center justify-center transition-colors cursor-pointer"
          >
            <Minus size={18} className="shrink-0" />
          </button>
          
          <input 
            type="text" 
            inputMode="numeric"
            pattern="[0-9]*"
            value={localQty}
            onChange={handleInputChange}
            placeholder={isPendingClear ? "0" : ""}
            className="flex-1 min-w-0 text-center font-black text-xl bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
          />
          
          <button 
            type="button"
            onClick={handlePlus}
            className="w-12 h-12 shrink-0 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-bold flex items-center justify-center transition-colors cursor-pointer shadow-md shadow-orange-500/20"
          >
            <Plus size={18} className="shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn(
        "flex items-center gap-2 bg-orange-100 dark:bg-orange-950/40 rounded-xl p-1 transition-all border",
        isPendingClear 
          ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20" 
          : "border-transparent"
      )}>
        <motion.button 
          whileHover={{ scale: 1.2, backgroundColor: "white" }} 
          whileTap={{ scale: 0.8 }} 
          onClick={handleMinus} 
          className="p-2 text-red-600 rounded-lg transition-colors cursor-pointer"
        >
          <Minus size={16} />
        </motion.button>
        <input 
          type="text" 
          inputMode="numeric"
          pattern="[0-9]*"
          value={localQty}
          onChange={handleInputChange}
          placeholder={isPendingClear ? "0" : ""}
          className="w-8 text-center text-xs font-black bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
        />
        <motion.button 
          whileHover={{ scale: 1.2, backgroundColor: "white" }} 
          whileTap={{ scale: 0.8 }} 
          onClick={handlePlus} 
          className="p-2 text-green-600 rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </motion.button>
      </div>
    );
  }

  if (variant === 'drawer') {
    return (
      <div className={cn(
        "flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1 transition-all border",
        isPendingClear 
          ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20" 
          : "border-transparent"
      )}>
        <motion.button 
          whileHover={{ scale: 1.2 }} 
          whileTap={{ scale: 0.8 }} 
          onClick={handleMinus} 
          className="text-red-600 cursor-pointer"
        >
          <Minus size={14} />
        </motion.button>
        <input 
          type="text" 
          inputMode="numeric"
          pattern="[0-9]*"
          value={localQty}
          onChange={handleInputChange}
          placeholder={isPendingClear ? "0" : ""}
          className="w-8 text-center text-xs font-bold bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
        />
        <motion.button 
          whileHover={{ scale: 1.2 }} 
          whileTap={{ scale: 0.8 }} 
          onClick={handlePlus} 
          className="text-green-600 cursor-pointer"
        >
          <Plus size={14} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl p-0.5 sm:p-1 shadow-inner border transition-colors",
      hasStock 
        ? "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700" 
        : "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60",
      isPendingClear && "border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20 bg-orange-50/30"
    )}>
      <motion.button 
        whileHover={{ scale: 1.1, backgroundColor: "#fee2e2" }} 
        whileTap={{ scale: 0.9 }} 
        onClick={handleMinus} 
        className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center text-red-600 rounded-lg transition-colors cursor-pointer"
      >
        <Minus size={8} className="sm:size-[10px] md:size-[12px]" />
      </motion.button>
      <input 
        type="text" 
        inputMode="numeric"
        pattern="[0-9]*"
        value={localQty}
        onChange={handleInputChange}
        placeholder={isPendingClear ? "0" : ""}
        className="w-5 sm:w-8 text-center text-[8px] sm:text-[10px] md:text-xs font-black bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
      />
      <motion.button 
        whileHover={{ scale: 1.1, backgroundColor: "#dcfce7" }} 
        whileTap={{ scale: 0.9 }} 
        onClick={handlePlus} 
        className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center text-green-600 rounded-lg transition-colors cursor-pointer"
      >
        <Plus size={8} className="sm:size-[10px] md:size-[12px]" />
      </motion.button>
    </div>
  );
};

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  isFavorite: boolean;
  isSold: boolean;
  isHighlighted?: boolean;
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
  isHighlighted,
  profileRole,
  onAddToCart,
  onUpdateQuantity,
  onSetQuantityDirectly,
  onToggleFavorite,
  onSetZoomImage,
  onSetUpdatingImageProduct,
}) => {
  const hasStock = product.stock > 0;
  
  let rawSale = Number(product.salePrice) || 0;
  let rawFinal = Number(product.finalPrice) || 0;
  let discountVal = Number(product.discount) || 0;

  if (discountVal >= 100 || discountVal < 0) {
    discountVal = 0;
  }

  if (rawFinal <= 0 || rawFinal >= rawSale || discountVal === 0) {
    if (rawSale > 0) rawFinal = rawSale;
    if (rawFinal > 0 && rawSale <= 0) rawSale = rawFinal;
    discountVal = 0;
  }

  if (rawSale > 0 && rawFinal > 0 && rawSale > rawFinal) {
    if (discountVal <= 0) {
      discountVal = Math.round(((rawSale - rawFinal) / rawSale) * 100 * 100) / 100;
    }
  } else {
    discountVal = 0;
    rawFinal = rawSale;
  }

  const displaySalePrice = rawSale;
  const displayFinalPrice = rawFinal;

  const economy = Math.max(0, displaySalePrice - displayFinalPrice);
  const calculatedDiscount = (displaySalePrice > 0 && economy > 0.01) ? (economy / displaySalePrice) * 100 : 0;
  const finalDiscount = (economy > 0.01 && discountVal > 0 && discountVal < 100)
    ? discountVal
    : (calculatedDiscount > 0 ? applyCustomRounding(calculatedDiscount) : 0);

  return (
    <div 
      id={`product-card-${product.id}`}
      className={cn(
        "bg-white dark:bg-[#1E1E1E] rounded-xl sm:rounded-[24px] overflow-hidden shadow-md group border transition-all duration-200 hover:-translate-y-1 flex flex-col relative pb-2 sm:pb-3 scroll-mt-48",
        isHighlighted 
          ? "border-orange-500 ring-4 ring-orange-500/30 shadow-xl shadow-orange-500/20 scale-[1.02] z-10" 
          : "border-transparent hover:border-orange-500/10",
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
          key={product.photo || `${product.id}-${product.ean}`}
          src={getProductImageUrl(product.photo, product.ean, product.manufacturer, product.description)} 
          alt={product.description} 
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105" 
          onError={(e) => handleImageError(e, product)}
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
            <div className="flex gap-1 sm:gap-1.5">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }} 
                className={cn("p-0.5 transition-transform active:scale-90", isFavorite ? "text-orange-600" : "text-gray-300 hover:text-orange-500")}
              >
                <Star size={10} className="sm:size-[13px]" fill={isFavorite ? "currentColor" : "none"} />
              </button>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetUpdatingImageProduct(product); }}
                className="text-gray-300 hover:text-gray-600 transition-transform active:scale-90 p-0.5"
              >
                <Camera size={10} className="sm:size-[13px]" />
              </button>
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
            {profileRole !== 'promotor' && economy > 0.01 && (
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-medium text-gray-400 dark:text-gray-500 line-through">
                De: {formatCurrency(displaySalePrice)}
              </span>
            )}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-sm md:text-base lg:text-lg font-black text-[#FF6B00] whitespace-nowrap">
                {formatCurrency(displayFinalPrice)}
              </span>
              {profileRole !== 'promotor' && economy > 0.01 && finalDiscount > 0 && (
                <span className="bg-[#EF4444] text-white text-[10px] sm:text-xs md:text-sm font-black px-1.5 py-0.5 rounded-md shrink-0 shadow-sm">
                  -{finalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%
                </span>
              )}
            </div>
          </div>
          
          {/* Savings Badge */}
          {profileRole !== 'promotor' && economy > 0.01 && (
            <div className="inline-flex items-center gap-1 bg-[#22C55E] text-white text-[9px] sm:text-[11px] md:text-xs font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-sm mt-0.5 sm:mt-1 max-w-full">
              <Star size={9} className="sm:size-3 shrink-0" fill="currentColor" />
              <span className="truncate">POUPE {formatCurrency(economy)}</span>
            </div>
          )}

          <div className="flex flex-col gap-0.5 mt-1 sm:mt-1.5">
            <p className={cn("text-[7px] sm:text-[8px] md:text-[9px] font-bold", hasStock ? "text-gray-500 dark:text-gray-400" : "text-[#EF4444]")}>
              {hasStock ? `Est. ${product.stock.toLocaleString('pt-BR')}` : 'Sem estoque'}
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
        <QuantityControl
          productId={product.id}
          cartQuantity={cartQuantity}
          hasStock={hasStock}
          onAddToCart={() => onAddToCart(product)}
          onUpdateQuantity={onUpdateQuantity}
          onSetQuantityDirectly={onSetQuantityDirectly}
          variant="card"
        />
      </div>
    </div>
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
        const h = Math.round(headerRef.current.offsetHeight);
        setHeaderHeight(prev => (Math.abs(prev - h) > 1 ? h : prev));
      }
    };
    
    handleResize();
    
    const observer = new ResizeObserver(handleResize);
    observer.observe(headerRef.current);
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [darkMode]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'produtos' | 'ofertas' | 'lancamentos'>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_ACTIVE_TAB');
      if (saved === 'produtos' || saved === 'ofertas' || saved === 'lancamentos') return saved;
    } catch {}
    return 'produtos';
  });
  const [searchInputValue, setSearchInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [anchorProductId, setAnchorProductId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('CATALOG_ANCHOR_PRODUCT_ID') || '';
    } catch {
      return '';
    }
  });
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const prevSearchRef = useRef<string>('');
  const isClearingSearchRef = useRef<boolean>(false);

  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_MANUFACTURERS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_CATEGORIES');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [statusFilters, setStatusFilters] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_STATUS_FILTERS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }); // 'discount', 'no-discount', 'in-stock', 'out-stock', 'new'
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'discount' | 'stock' | 'az' | 'za' | 'recent'>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_SORT_BY');
      if (saved) return saved as any;
    } catch {}
    return 'default';
  });
  const [displayLimit, setDisplayLimit] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('CATALOG_DISPLAY_LIMIT');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 32) return num;
      }
    } catch {}
    return 32;
  });

  const handleClearSearch = useCallback(() => {
    setSearchInputValue('');
    setSearch('');
    if (anchorProductId) {
      isClearingSearchRef.current = true;
    }
  }, [anchorProductId]);

  useEffect(() => {
    const trimmed = searchInputValue.trim();
    const handler = setTimeout(() => {
      setSearch(trimmed);
      try {
        if (trimmed) {
          sessionStorage.setItem('CATALOG_LAST_SEARCH', trimmed);
        } else {
          sessionStorage.removeItem('CATALOG_LAST_SEARCH');
        }
      } catch {}
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInputValue]);

  useEffect(() => {
    const prev = prevSearchRef.current;
    prevSearchRef.current = search;

    if (prev && !search && anchorProductId) {
      isClearingSearchRef.current = true;
    }
  }, [search, anchorProductId]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_ACTIVE_TAB', activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_MANUFACTURERS', JSON.stringify(selectedManufacturers));
    } catch {}
  }, [selectedManufacturers]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_CATEGORIES', JSON.stringify(selectedCategories));
    } catch {}
  }, [selectedCategories]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_STATUS_FILTERS', JSON.stringify(statusFilters));
    } catch {}
  }, [statusFilters]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_SORT_BY', sortBy);
    } catch {}
  }, [sortBy]);

  useEffect(() => {
    try {
      sessionStorage.setItem('CATALOG_DISPLAY_LIMIT', String(displayLimit));
    } catch {}
  }, [displayLimit]);

  const userManuallyInteractedRef = useRef(false);

  // Monitora a rolagem para salvar a posição e o produto visível com precisão milimétrica
  useEffect(() => {
    // Evita que o browser force scroll para (0,0) antes do React renderizar os produtos
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const handleUserInteraction = () => {
      userManuallyInteractedRef.current = true;
    };
    window.addEventListener('wheel', handleUserInteraction, { passive: true });
    window.addEventListener('touchmove', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });

    let scrollTimeout: any = null;
    let throttleTimeout: any = null;

    const recordScrollPosition = () => {
      if (typeof window === 'undefined') return;
      const scrollY = Math.round(window.scrollY);

      try {
        sessionStorage.setItem('CATALOG_SCROLL_Y', String(scrollY));
        sessionStorage.setItem('CATALOG_DISPLAY_LIMIT', String(displayLimit));
        if (selectedClient?.id) {
          sessionStorage.setItem('CATALOG_CLIENT_ID', String(selectedClient.id));
        }

        if (scrollY > 30) {
          // Achar o card de produto visível no topo da tela para âncora visual exata
          const cards = document.querySelectorAll<HTMLElement>('[id^="product-card-"]');
          if (cards.length > 0) {
            const headerOffset = headerHeight + 30;
            let bestCardId: string | null = null;
            let minDiff = Infinity;

            for (let i = 0; i < cards.length; i++) {
              const card = cards[i];
              const rect = card.getBoundingClientRect();
              if (rect.bottom > headerOffset && rect.top < window.innerHeight) {
                const diff = Math.abs(rect.top - headerOffset);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestCardId = card.id.replace('product-card-', '');
                }
              }
            }

            if (bestCardId) {
              sessionStorage.setItem('CATALOG_LAST_VISIBLE_PRODUCT_ID', bestCardId);
            }
          }
        }
      } catch (_) {}
    };

    const handleScroll = () => {
      // Throttle durante rolagem contínua
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          recordScrollPosition();
        }, 100);
      }

      // Debounce para garantir o salvamento final quando a rolagem parar
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        recordScrollPosition();
      }, 200);
    };

    // Salvar imediatamente se a página for recarregada ou fechada
    const handleBeforeUnload = () => {
      recordScrollPosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('wheel', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [displayLimit, headerHeight, selectedClient?.id]);

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
  const [expandedIndustries, setExpandedIndustries] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isCartOpen) {
      setExpandedIndustries({});
    }
  }, [isCartOpen]);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [pendingCarts, setPendingCarts] = useState<{clientId: string, items: OrderItem[], clientName?: string}[]>([]);
  const [showPendingCarts, setShowPendingCarts] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastOrderItems, setLastOrderItems] = useState<OrderItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [imageShareProduct, setImageShareProduct] = useState<Product | null>(null);
  const [isImageShareModalOpen, setIsImageShareModalOpen] = useState(false);
  const [updatingImageProduct, setUpdatingImageProduct] = useState<Product | null>(null);
  const [searchImages, setSearchImages] = useState<string[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [banners, setBanners] = useState<BannerMessage[]>([]);
  const [lastOrders, setLastOrders] = useState<Order[]>([]);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  // Share Industry States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedShareManufacturer, setSelectedShareManufacturer] = useState<string>('TODAS');
  const [shareSellerName, setShareSellerName] = useState('');
  const [shareSellerPhone, setShareSellerPhone] = useState('5586999647573');
  const [activeIndustryFilter, setActiveIndustryFilter] = useState<string | null>(null);
  const [shareIncludeFilters, setShareIncludeFilters] = useState<boolean>(true);

  // Shared Client & Link Tracking States
  const [sharedClientName, setSharedClientName] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('client') || p.get('cliente') || p.get('clientName') || '';
    } catch {
      return '';
    }
  });
  const [sharedClientId, setSharedClientId] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('clientId') || p.get('id') || '';
    } catch {
      return '';
    }
  });
  const [sharedClientCnpj, setSharedClientCnpj] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('cnpj') || '';
    } catch {
      return '';
    }
  });
  const [sharedRegional, setSharedRegional] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('reg') || p.get('regional') || '';
    } catch {
      return '';
    }
  });

  // Shared Link Expiration & Restricted View States
  const [isSharedLinkMode, setIsSharedLinkMode] = useState<boolean>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('shared') === 'true' || !!p.get('lid') || !!p.get('linkId') || !!p.get('ind') || !!p.get('client') || !!p.get('cliente') || !!p.get('cart');
    } catch {
      return false;
    }
  });
  const [currentLinkId, setCurrentLinkId] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('lid') || p.get('linkId') || null;
    } catch {
      return null;
    }
  });
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [linkCompletedAt, setLinkCompletedAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(3600); // 1 hour (3600 seconds)

  // Timer effect to calculate remaining expiration time after order completion (1 hour limit)
  useEffect(() => {
    if (!linkCompletedAt) return;
    const updateTimer = () => {
      const elapsed = Date.now() - linkCompletedAt;
      const remainingMs = 60 * 60 * 1000 - elapsed;
      if (remainingMs <= 0) {
        setTimeRemaining(0);
        setIsLinkExpired(true);
      } else {
        setTimeRemaining(Math.ceil(remainingMs / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [linkCompletedAt]);

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
        return acc + (item.product.finalPrice * item.quantity);
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

  const isInitialMountLimitRef = useRef(true);
  useEffect(() => {
    if (isInitialMountLimitRef.current) {
      isInitialMountLimitRef.current = false;
      return;
    }
    if (search.trim().length > 0) {
      setDisplayLimit(32);
    } else if (!isClearingSearchRef.current && !anchorProductId) {
      setDisplayLimit(32);
    }
  }, [search, selectedManufacturers, selectedCategories, statusFilters, activeTab, sortBy]);

  // 1. Separate Product & Banner Subscription - Always loads products and banners
  useEffect(() => {
    const regional = selectedClient?.regional || sharedRegional || profile?.regional || 'TIMON-MA';
    dataService.setRegional(regional);

    setLoading(true);
    const unsubProducts = dataService.subscribeProducts((data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubBanners = dataService.subscribeBanners((data) => {
      setBanners(data.filter(b => !b.targetRegional || b.targetRegional === regional));
    });

    return () => {
      unsubProducts();
      unsubBanners();
    };
  }, [selectedClient?.regional, sharedRegional, profile?.regional]);

  // 2. Client Cart, Favorites, Orders & Pending Carts Subscription
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
    if (!selectedClient && !isPromotor) {
      setCartLoaded(true);
      return;
    }

    // Cart loading / subscribing across mobile, tablet, and PC
    let unsubCart = () => {};
    const targetCartClientId = selectedClient ? selectedClient.id : (isPromotor ? 'PROMOTOR' : null);

    if (profile && targetCartClientId) {
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

      if (localItems.length > 0) {
        setCart(localItems);
        lastSyncedCartRef.current = JSON.stringify(localItems);
      }

      unsubCart = dataService.subscribeCart(profile.uid, targetCartClientId, (firestoreItems) => {
        if (firestoreItems && Array.isArray(firestoreItems) && firestoreItems.length > 0) {
          // Firestore has active cart: sync state and local storage immediately
          const itemsStr = JSON.stringify(firestoreItems);
          lastSyncedCartRef.current = itemsStr;
          setCart(firestoreItems);
          localStorage.setItem(cartKey, itemsStr);
        } else {
          // Firestore is empty: cart is cleared or empty across all devices
          lastSyncedCartRef.current = '[]';
          setCart([]);
          localStorage.setItem(cartKey, '[]');
        }
        setCartLoaded(true);
      });
    } else {
      setCartLoaded(true);
    }

    // Sync changes across browser tabs on the same device
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === cartKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            lastSyncedCartRef.current = e.newValue;
            setCart(parsed);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const unsubFavorites = selectedClient ? dataService.subscribeFavorites(selectedClient.id, (data) => {
      setFavorites(data);
    }) : () => {};

    const unsubOrders = profile ? dataService.subscribeOrders(
      selectedClient ? selectedClient.id : null,
      selectedClient ? null : profile.name,
      profile.role === 'admin',
      (data) => {
        setLastOrders(data);
      }
    ) : () => {};

    if (profile) {
      dataService.getClients(profile.name, profile.role === 'admin').then(setAllClients);
    }
    
    let unsubPendingCarts: (() => void) | undefined;
    if (profile) {
      unsubPendingCarts = dataService.subscribeAllCarts(profile.uid, async (carts) => {
        try {
          const filtered = (carts || []).filter(c => {
            if (!c) return false;
            const itemsCount = c.items && Array.isArray(c.items) ? c.items.length : 0;
            if (itemsCount === 0) return false;
            
            if (selectedClient) {
              return String(c.clientId).trim() !== String(selectedClient.id).trim();
            }
            return true;
          });

          const allCls = await dataService.getClients(undefined, true);
          const clientsWithNames = filtered.map(cart => {
            const client = allCls.find(cl => String(cl.id).trim() === String(cart.clientId).trim());
            return {
              ...cart,
              clientName: client?.tradeName || client?.name || `Cliente ${cart.clientId}`
            };
          });

          setPendingCarts(clientsWithNames);
        } catch (e) {
          console.error("Error subscribing to pending carts:", e);
        }
      });
    }

    return () => {
      unsubCart();
      unsubFavorites();
      unsubOrders();
      if (unsubPendingCarts) unsubPendingCarts();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedClient, profile, cartKey]);

  // Auto-sync cart items whenever catalog products are reloaded or updated with new discounts/prices
  useEffect(() => {
    if (!cartLoaded || products.length === 0 || cart.length === 0) return;

    let hasPriceOrDiscountChanges = false;
    const syncedCart = cart.map(item => {
      const enriched = enrichOrderItem(item, products);
      const isPriceChanged = enriched.salePrice !== item.salePrice || enriched.finalPrice !== item.finalPrice;
      const isDiscountChanged = enriched.discount !== item.discount;
      const isMetaChanged = enriched.stock !== item.stock || enriched.photo !== item.photo || enriched.description !== item.description;

      if (isPriceChanged || isDiscountChanged || isMetaChanged) {
        if (isPriceChanged || isDiscountChanged) {
          hasPriceOrDiscountChanges = true;
        }
        return {
          ...item,
          salePrice: enriched.salePrice,
          finalPrice: enriched.finalPrice,
          discount: enriched.discount,
          stock: enriched.stock,
          photo: enriched.photo,
          description: enriched.description,
          category: enriched.category,
          manufacturer: enriched.manufacturer,
          ean: enriched.ean,
          type: enriched.type,
          discountExpiryDate: enriched.discountExpiryDate,
        };
      }
      return item;
    });

    if (hasPriceOrDiscountChanges) {
      setCart(syncedCart);
      toast.info('Preços e descontos do carrinho atualizados com o catálogo!', { id: 'cart-synced', duration: 4000 });
    }
  }, [products, cartLoaded]);

  const getProductKey = (p: Product): string => {
    const id = p.id ? String(p.id).trim() : '';
    const ean = p.ean ? String(p.ean).trim() : '';
    const desc = p.description ? String(p.description).trim().toLowerCase() : '';

    if (id && id !== '0' && id !== 'undefined' && id !== 'null') {
      return `id_${id}`;
    }
    if (ean && ean !== '0' && ean !== 'undefined' && ean !== 'null') {
      return `ean_${ean}`;
    }
    return `desc_${desc}`;
  };

  const tabProductsMap = useMemo(() => {
    const produtosMap = new Map<string, Product>();
    const ofertasMap = new Map<string, Product>();
    const lancamentosMap = new Map<string, Product>();

    // 1. First pass: group by type
    products.forEach(p => {
      // STRICT SINGLE INDUSTRY LOCK: If activeIndustryFilter is set, ignore products from other industries
      if (activeIndustryFilter && p.manufacturer) {
        if (p.manufacturer.trim().toLowerCase() !== activeIndustryFilter.trim().toLowerCase()) {
          return;
        }
      }

      const key = getProductKey(p);
      const pType = (p.type || 'normal').toString().toLowerCase();

      if (pType === 'offer' || pType === 'oferta') {
        if (!ofertasMap.has(key)) {
          ofertasMap.set(key, { ...p });
        }
      } else if (pType === 'new' || pType === 'lancamento') {
        if (!lancamentosMap.has(key)) {
          lancamentosMap.set(key, { ...p });
        }
      } else {
        if (!produtosMap.has(key)) {
          produtosMap.set(key, { ...p });
        }
      }
    });

    // 2. Cross-synchronize: pull base prices from produtosMap to ofertasMap and apply active discounts to produtosMap
    ofertasMap.forEach((offerProd, key) => {
      if (activeIndustryFilter && offerProd.manufacturer) {
        if (offerProd.manufacturer.trim().toLowerCase() !== activeIndustryFilter.trim().toLowerCase()) {
          return;
        }
      }

      // Check if product exists in regular products catalog
      const normalProd = produtosMap.get(key);
      const baseSalePrice = normalProd && normalProd.salePrice > 0 
        ? normalProd.salePrice 
        : (offerProd.salePrice > 0 ? offerProd.salePrice : (normalProd?.finalPrice || offerProd.finalPrice || 0));

      let disc = 0;
      let finalP = baseSalePrice;

      // Replicate discount and finalPrice from normalProd if configured in "Produtos", or compute using offerProd discount
      if (normalProd && normalProd.discount > 0 && normalProd.discount < 100) {
        disc = normalProd.discount;
        finalP = (normalProd.finalPrice > 0 && normalProd.finalPrice < baseSalePrice)
          ? normalProd.finalPrice 
          : applyCustomRounding(baseSalePrice * (1 - disc / 100));
      } else if (normalProd && normalProd.finalPrice > 0 && normalProd.finalPrice < baseSalePrice) {
        finalP = normalProd.finalPrice;
        disc = applyCustomRounding(((baseSalePrice - finalP) / baseSalePrice) * 100);
      } else if (offerProd.discount !== undefined && !isNaN(offerProd.discount) && Number(offerProd.discount) > 0 && Number(offerProd.discount) < 100) {
        disc = Number(offerProd.discount);
        finalP = applyCustomRounding(baseSalePrice * (1 - disc / 100));
      } else if (offerProd.finalPrice !== undefined && !isNaN(offerProd.finalPrice) && Number(offerProd.finalPrice) > 0 && Number(offerProd.finalPrice) < baseSalePrice) {
        finalP = Number(offerProd.finalPrice);
        disc = applyCustomRounding(((baseSalePrice - finalP) / baseSalePrice) * 100);
      } else {
        finalP = baseSalePrice;
        disc = 0;
      }

      const syncedStock = (normalProd?.stock !== undefined && normalProd.stock !== null) 
        ? normalProd.stock 
        : (offerProd.stock ?? 999);

      const syncedPhoto = (normalProd?.photo && normalProd.photo.trim().length > 5)
        ? normalProd.photo
        : (offerProd.photo || '');

      const syncedDesc = (normalProd?.description && normalProd.description !== 'Produto')
        ? normalProd.description
        : offerProd.description;

      // Update offerProd in ofertasMap with synchronized base price
      const syncedOffer: Product = {
        ...offerProd,
        id: normalProd?.id || offerProd.id,
        ean: normalProd?.ean || offerProd.ean,
        salePrice: baseSalePrice,
        finalPrice: finalP,
        discount: disc,
        type: 'offer',
        description: syncedDesc,
        category: normalProd?.category || offerProd.category,
        manufacturer: normalProd?.manufacturer || offerProd.manufacturer,
        photo: syncedPhoto,
        stock: syncedStock,
        discountExpiryDate: offerProd.discountExpiryDate || normalProd?.discountExpiryDate
      };
      ofertasMap.set(key, syncedOffer);

      // Ensure item ALSO appears in produtosMap with active promotion details
      if (!produtosMap.has(key)) {
        produtosMap.set(key, { ...syncedOffer });
      } else {
        const existing = produtosMap.get(key)!;
        produtosMap.set(key, {
          ...existing,
          discount: disc,
          finalPrice: finalP,
          salePrice: baseSalePrice,
          stock: syncedStock,
          photo: syncedPhoto || existing.photo,
          discountExpiryDate: syncedOffer.discountExpiryDate || existing.discountExpiryDate
        });
      }
    });

    // 3. Sync lancamentosMap with produtosMap
    lancamentosMap.forEach((newProd, key) => {
      if (activeIndustryFilter && newProd.manufacturer) {
        if (newProd.manufacturer.trim().toLowerCase() !== activeIndustryFilter.trim().toLowerCase()) {
          return;
        }
      }

      const normalProd = produtosMap.get(key);
      const baseSalePrice = normalProd && normalProd.salePrice > 0 ? normalProd.salePrice : (newProd.salePrice > 0 ? newProd.salePrice : newProd.finalPrice);
      const baseFinalPrice = normalProd && normalProd.finalPrice > 0 ? normalProd.finalPrice : (newProd.finalPrice > 0 ? newProd.finalPrice : baseSalePrice);
      const syncedStock = (normalProd?.stock !== undefined && normalProd.stock !== null) ? normalProd.stock : (newProd.stock ?? 999);
      const syncedPhoto = (normalProd?.photo && normalProd.photo.trim().length > 5) ? normalProd.photo : (newProd.photo || '');

      const syncedNew: Product = {
        ...newProd,
        id: normalProd?.id || newProd.id,
        ean: normalProd?.ean || newProd.ean,
        salePrice: baseSalePrice,
        finalPrice: baseFinalPrice,
        discount: normalProd?.discount !== undefined ? normalProd.discount : newProd.discount,
        type: 'new',
        description: (normalProd?.description && normalProd.description !== 'Produto') ? normalProd.description : newProd.description,
        category: normalProd?.category || newProd.category,
        manufacturer: normalProd?.manufacturer || newProd.manufacturer,
        photo: syncedPhoto,
        stock: syncedStock,
        discountExpiryDate: newProd.discountExpiryDate || normalProd?.discountExpiryDate
      };
      lancamentosMap.set(key, syncedNew);

      if (!produtosMap.has(key)) {
        produtosMap.set(key, { ...syncedNew });
      }
    });

    return {
      produtos: Array.from(produtosMap.values()),
      ofertas: Array.from(ofertasMap.values()),
      lancamentos: Array.from(lancamentosMap.values()),
    };
  }, [products, activeIndustryFilter]);

  const manufacturers = useMemo(() => {
    if (activeIndustryFilter) {
      return [activeIndustryFilter];
    }
    const set = new Set<string>();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    tabProductsMap.produtos.forEach(p => {
      if (p.manufacturer && !dateRegex.test(p.manufacturer)) {
        set.add(p.manufacturer);
      }
    });
    return Array.from(set).sort();
  }, [tabProductsMap, activeIndustryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    tabProductsMap.produtos.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [tabProductsMap]);

  const counts = useMemo(() => {
    return {
      tabCounts: {
        produtos: tabProductsMap.produtos.length,
        ofertas: tabProductsMap.ofertas.length,
        lancamentos: tabProductsMap.lancamentos.length,
      }
    };
  }, [tabProductsMap]);

  // Helper to format human-readable filter descriptions
  const getFilterSummaryList = useCallback((manufacturer?: string, respectFilterToggle: boolean = true) => {
    const shouldInclude = !respectFilterToggle || shareIncludeFilters;
    const parts: string[] = [];
    const targetMfg = manufacturer && manufacturer !== 'TODAS'
      ? manufacturer
      : (activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : ''));

    if (targetMfg && targetMfg !== 'TODAS') {
      parts.push(`Indústria: *${targetMfg.toUpperCase()}*`);
    } else if (selectedManufacturers.length > 1) {
      parts.push(`Indústrias: *${selectedManufacturers.join(', ')}*`);
    }

    if (shouldInclude) {
      if (statusFilters.length > 0) {
        const statusMap: Record<string, string> = {
          'discount': 'Com Desconto',
          'no-discount': 'Preço Regular',
          'in-stock': 'Em Estoque',
          'out-stock': 'Sem Estoque',
          'new': 'Lançamentos',
          'promotional': 'Promocionais'
        };
        const stStr = statusFilters.map(s => statusMap[s] || s).join(', ');
        parts.push(`Status: *${stStr}*`);
      }

      if (sortBy && sortBy !== 'default') {
        const sortMap: Record<string, string> = {
          'discount': 'Maior Desconto',
          'price-asc': 'Menor Preço',
          'price-desc': 'Maior Preço',
          'stock': 'Maior Estoque',
          'az': 'Nome (A-Z)',
          'za': 'Nome (Z-A)',
          'recent': 'Mais Recentes'
        };
        if (sortMap[sortBy]) {
          parts.push(`Ordenação: *${sortMap[sortBy]}*`);
        }
      }

      if (activeTab && activeTab !== 'produtos') {
        parts.push(`Aba: *${activeTab === 'ofertas' ? 'Ofertas' : 'Lançamentos'}*`);
      }

      if (selectedCategories.length > 0) {
        parts.push(`Categorias: *${selectedCategories.join(', ')}*`);
      }

      if (search.trim()) {
        parts.push(`Busca: *"${search.trim()}"*`);
      }
    }

    return parts;
  }, [shareIncludeFilters, activeIndustryFilter, selectedManufacturers, statusFilters, sortBy, activeTab, selectedCategories, search]);

  // Handle URL search params for Industry link, Filters & Shared Cart
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const clientParam = params.get('client') || params.get('cliente') || params.get('clientName');
      const clientIdParam = params.get('clientId') || params.get('id');
      const cnpjParam = params.get('cnpj');
      const regParam = params.get('reg') || params.get('regional');
      const ind = params.get('ind') || params.get('industria') || params.get('manufacturer');
      const mParam = params.get('m') || params.get('fabricantes');
      const statusParam = params.get('status') || params.get('statusFilters');
      const sortParam = params.get('sort') || params.get('sortBy');
      const tabParam = params.get('tab') || params.get('activeTab');
      const catParam = params.get('cat') || params.get('categoria') || params.get('categories');
      const qParam = params.get('q') || params.get('busca') || params.get('search');
      const cartParam = params.get('cart');
      const sellerParam = params.get('seller') || params.get('vendedor');
      const phoneParam = params.get('phone') || params.get('telefone');
      const lidParam = params.get('lid') || params.get('linkId');
      const isShared = params.get('shared') === 'true' || !!lidParam || !!clientParam || !!ind || !!statusParam;

      if (isShared) {
        setIsSharedLinkMode(true);
      }

      if (clientParam) {
        const decodedClient = decodeURIComponent(clientParam).trim();
        setSharedClientName(decodedClient);
      }

      if (clientIdParam) {
        setSharedClientId(clientIdParam);
      }

      if (cnpjParam) {
        setSharedClientCnpj(cnpjParam);
      }

      if (regParam) {
        setSharedRegional(regParam);
        dataService.setRegional(regParam);
      }

      if (phoneParam) {
        setShareSellerPhone(phoneParam);
      }

      if (sellerParam) {
        setShareSellerName(decodeURIComponent(sellerParam).trim());
      }

      // 1. Status Filters from URL (e.g. status=in-stock,discount)
      if (statusParam) {
        const parsedStatuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        if (parsedStatuses.length > 0) {
          setStatusFilters(parsedStatuses);
          try {
            sessionStorage.setItem('CATALOG_STATUS_FILTERS', JSON.stringify(parsedStatuses));
          } catch (_) {}
        }
      } else if (isShared && !lidParam) {
        // Shared link without status param: clear stale session filters
        setStatusFilters([]);
        try {
          sessionStorage.setItem('CATALOG_STATUS_FILTERS', JSON.stringify([]));
        } catch (_) {}
      }

      // 2. Sort option from URL (e.g. sort=discount)
      if (sortParam) {
        const validSorts = ['default', 'price-asc', 'price-desc', 'discount', 'stock', 'az', 'za', 'recent'];
        if (validSorts.includes(sortParam)) {
          setSortBy(sortParam as any);
          try {
            sessionStorage.setItem('CATALOG_SORT_BY', sortParam);
          } catch (_) {}
        }
      } else if (isShared && !lidParam) {
        setSortBy('default');
        try {
          sessionStorage.setItem('CATALOG_SORT_BY', 'default');
        } catch (_) {}
      }

      // 3. Tab from URL (e.g. tab=ofertas)
      if (tabParam && (tabParam === 'produtos' || tabParam === 'ofertas' || tabParam === 'lancamentos')) {
        setActiveTab(tabParam as any);
        try {
          sessionStorage.setItem('CATALOG_ACTIVE_TAB', tabParam);
        } catch (_) {}
      }

      // 4. Categories from URL (e.g. cat=Higiene)
      if (catParam) {
        const parsedCats = catParam.split(',').map(c => decodeURIComponent(c).trim()).filter(Boolean);
        if (parsedCats.length > 0) {
          setSelectedCategories(parsedCats);
          try {
            sessionStorage.setItem('CATALOG_CATEGORIES', JSON.stringify(parsedCats));
          } catch (_) {}
        }
      } else if (isShared && !lidParam) {
        setSelectedCategories([]);
        try {
          sessionStorage.setItem('CATALOG_CATEGORIES', JSON.stringify([]));
        } catch (_) {}
      }

      // 5. Search query from URL
      if (qParam) {
        const decodedQ = decodeURIComponent(qParam).trim();
        if (decodedQ) {
          setSearchInputValue(decodedQ);
          setSearch(decodedQ);
        }
      }

      // 6. Multiple manufacturers from URL
      if (mParam) {
        const parsedM = mParam.split(',').map(m => decodeURIComponent(m).trim()).filter(Boolean);
        if (parsedM.length > 0) {
          setSelectedManufacturers(parsedM);
          if (parsedM.length === 1) {
            setActiveIndustryFilter(parsedM[0]);
            setSelectedShareManufacturer(parsedM[0]);
          }
        }
      }

      // 7. Shared Link tracking & persisted filters via lidParam
      if (lidParam) {
        setCurrentLinkId(lidParam);
        dataService.getSharedLink(lidParam).then(linkInfo => {
          if (linkInfo) {
            if (linkInfo.clientName && !clientParam) {
              setSharedClientName(linkInfo.clientName);
            }
            if (linkInfo.clientCnpj && !cnpjParam) {
              setSharedClientCnpj(linkInfo.clientCnpj);
            }
            if (linkInfo.clientId && !clientIdParam) {
              setSharedClientId(linkInfo.clientId);
            }
            if (linkInfo.sellerName && !sellerParam) {
              setShareSellerName(linkInfo.sellerName);
            }
            if (linkInfo.sellerPhone && !phoneParam) {
              setShareSellerPhone(linkInfo.sellerPhone);
            }
            if (linkInfo.manufacturer && !ind && !mParam) {
              setActiveIndustryFilter(linkInfo.manufacturer);
              setSelectedShareManufacturer(linkInfo.manufacturer);
              setSelectedManufacturers([linkInfo.manufacturer]);
            }
            if (linkInfo.manufacturers && linkInfo.manufacturers.length > 0 && !mParam && !ind) {
              setSelectedManufacturers(linkInfo.manufacturers);
              if (linkInfo.manufacturers.length === 1) {
                setActiveIndustryFilter(linkInfo.manufacturers[0]);
                setSelectedShareManufacturer(linkInfo.manufacturers[0]);
              }
            }
            if (linkInfo.statusFilters && !statusParam) {
              setStatusFilters(linkInfo.statusFilters);
              try {
                sessionStorage.setItem('CATALOG_STATUS_FILTERS', JSON.stringify(linkInfo.statusFilters));
              } catch (_) {}
            }
            if (linkInfo.sortBy && !sortParam) {
              setSortBy(linkInfo.sortBy as any);
              try {
                sessionStorage.setItem('CATALOG_SORT_BY', linkInfo.sortBy);
              } catch (_) {}
            }
            if (linkInfo.activeTab && !tabParam && (linkInfo.activeTab === 'produtos' || linkInfo.activeTab === 'ofertas' || linkInfo.activeTab === 'lancamentos')) {
              setActiveTab(linkInfo.activeTab as any);
              try {
                sessionStorage.setItem('CATALOG_ACTIVE_TAB', linkInfo.activeTab);
              } catch (_) {}
            }
            if (linkInfo.categories && linkInfo.categories.length > 0 && !catParam) {
              setSelectedCategories(linkInfo.categories);
              try {
                sessionStorage.setItem('CATALOG_CATEGORIES', JSON.stringify(linkInfo.categories));
              } catch (_) {}
            }
            if (linkInfo.searchQuery && !qParam) {
              setSearchInputValue(linkInfo.searchQuery);
              setSearch(linkInfo.searchQuery);
            }
            if (linkInfo.completedAt) {
              setLinkCompletedAt(linkInfo.completedAt);
              const elapsed = Date.now() - linkInfo.completedAt;
              if (elapsed >= 60 * 60 * 1000) {
                setIsLinkExpired(true);
              } else {
                const remainingMs = 60 * 60 * 1000 - elapsed;
                setTimeRemaining(Math.ceil(remainingMs / 1000));
              }
            }
          }
        }).catch(err => console.error("Erro ao carregar dados do link compartilhado:", err));
      }

      if (products.length > 0 && ind) {
        const decodedInd = decodeURIComponent(ind).trim();
        const matched = manufacturers.find(m => m.toLowerCase() === decodedInd.toLowerCase()) || decodedInd;
        setSelectedManufacturers([matched]);
        setActiveIndustryFilter(matched);
        setSelectedShareManufacturer(matched);
      }

      if (products.length > 0 && cartParam) {
        let loadedItems: OrderItem[] = [];
        if (cartParam.startsWith('{') || cartParam.startsWith('[')) {
          loadedItems = JSON.parse(cartParam);
        } else if (cartParam.includes(':') || cartParam.includes(',')) {
          const pairs = cartParam.split(',');
          pairs.forEach(pair => {
            const parts = pair.split(':');
            const code = parts[0]?.trim();
            const qty = parseInt(parts[1]?.trim() || '1', 10) || 1;
            if (!code) return;

            const cleanCode = code.replace(/^0+/, '');
            const prod = products.find(p => {
              const pEan = p.ean ? p.ean.replace(/^0+/, '') : '';
              const pId = p.id ? p.id.replace(/^0+/, '') : '';
              return pEan === cleanCode || pId === cleanCode || p.ean === code || p.id === code;
            });

            if (prod) {
              loadedItems.push({
                id: prod.id,
                ean: prod.ean,
                description: prod.description,
                quantity: qty,
                salePrice: prod.salePrice,
                finalPrice: prod.finalPrice || prod.salePrice,
                discount: prod.discount || 0,
                category: prod.category,
                manufacturer: prod.manufacturer,
                photo: prod.photo,
                stock: prod.stock || 0,
                type: prod.type || 'FROZEN'
              });
            }
          });
        } else {
          try {
            const decoded = atob(cartParam);
            const parsed = JSON.parse(decoded);
            if (Array.isArray(parsed)) loadedItems = parsed;
          } catch (e) {}
        }

        if (loadedItems.length > 0) {
          setCart(loadedItems);
          setIsCartOpen(true);
          toast.success(`🛒 Carrinho carregado com ${loadedItems.length} produto(s)!`, { id: 'cart_import' });
        }
      }
    } catch (err) {
      console.error("Erro ao processar parâmetros da URL:", err);
    }
  }, [products, manufacturers, profile]);

  // Generate catalog link with unique Link ID and strictly serialized active filters
  const generateIndustryLink = useCallback((manufacturer?: string, sellerName?: string, respectFilterToggle: boolean = true) => {
    const baseUrl = `${getPublicBaseUrl()}/catalog`;
    const params = new URLSearchParams();
    const newLid = 'lk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const shouldIncludeFilters = !respectFilterToggle || shareIncludeFilters;

    const targetMfg = manufacturer !== undefined
      ? manufacturer
      : (activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : 'TODAS'));
    
    if (targetMfg && targetMfg !== 'TODAS') {
      params.set('ind', targetMfg);
    } else if (selectedManufacturers.length > 1) {
      params.set('m', selectedManufacturers.join(','));
    }

    if (shouldIncludeFilters) {
      // 1. Status Filters (e.g. in-stock, discount)
      if (statusFilters.length > 0) {
        params.set('status', statusFilters.join(','));
      }

      // 2. Sorting (e.g. discount, price-asc)
      if (sortBy && sortBy !== 'default') {
        params.set('sort', sortBy);
      }

      // 3. Active Tab (ofertas, lancamentos)
      if (activeTab && activeTab !== 'produtos') {
        params.set('tab', activeTab);
      }

      // 4. Categories
      if (selectedCategories.length > 0) {
        params.set('cat', selectedCategories.join(','));
      }

      // 5. Search Query
      if (search.trim()) {
        params.set('q', search.trim());
      }
    }

    const finalSeller = sellerName || shareSellerName || profile?.name || 'Vendedor';
    params.set('seller', finalSeller);
    params.set('phone', shareSellerPhone || profile?.phone || '5586999647573');
    params.set('shared', 'true');
    params.set('lid', newLid);

    const clientName = selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || '';
    if (clientName) {
      params.set('client', clientName);
    }
    if (selectedClient?.id || sharedClientId) {
      params.set('clientId', selectedClient?.id || sharedClientId);
    }
    if (selectedClient?.cnpj || sharedClientCnpj) {
      params.set('cnpj', selectedClient?.cnpj || sharedClientCnpj);
    }
    if (selectedClient?.regional || sharedRegional) {
      params.set('reg', selectedClient?.regional || sharedRegional);
    }

    // Save link tracking with client information & filter snapshot
    dataService.saveSharedLink({
      id: newLid,
      manufacturer: targetMfg && targetMfg !== 'TODAS' ? targetMfg : undefined,
      manufacturers: selectedManufacturers.length > 0 ? selectedManufacturers : undefined,
      statusFilters: shouldIncludeFilters && statusFilters.length > 0 ? statusFilters : undefined,
      sortBy: shouldIncludeFilters && sortBy !== 'default' ? sortBy : undefined,
      activeTab: shouldIncludeFilters && activeTab !== 'produtos' ? activeTab : undefined,
      categories: shouldIncludeFilters && selectedCategories.length > 0 ? selectedCategories : undefined,
      searchQuery: shouldIncludeFilters && search.trim() ? search.trim() : undefined,
      sellerName: finalSeller,
      sellerPhone: shareSellerPhone || profile?.phone || '5586999647573',
      clientName: clientName || undefined,
      clientId: selectedClient?.id || sharedClientId || undefined,
      clientCnpj: selectedClient?.cnpj || sharedClientCnpj || undefined,
      regional: selectedClient?.regional || sharedRegional || undefined,
      createdAt: Date.now()
    }).catch(err => console.error("Erro ao salvar link:", err));

    return `${baseUrl}?${params.toString()}`;
  }, [
    profile, 
    shareSellerName, 
    shareSellerPhone, 
    selectedClient, 
    sharedClientName, 
    manualClientName, 
    sharedClientId, 
    sharedClientCnpj, 
    sharedRegional, 
    activeIndustryFilter, 
    selectedManufacturers, 
    statusFilters, 
    sortBy, 
    activeTab, 
    selectedCategories, 
    search, 
    shareIncludeFilters
  ]);

  // Share via WhatsApp with filtered summary
  const handleShareIndustryWhatsApp = (manufacturer?: string, respectFilterToggle: boolean = false) => {
    const seller = shareSellerName || profile?.name || 'Vendedor';
    const client = selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || '';
    const link = generateIndustryLink(manufacturer, seller, respectFilterToggle);
    const filterParts = getFilterSummaryList(manufacturer, respectFilterToggle);
    
    const targetMfg = manufacturer && manufacturer !== 'TODAS'
      ? manufacturer
      : (activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : ''));
    const textInd = targetMfg ? `da indústria *${targetMfg.toUpperCase()}*` : 'completo';
    const clientGreeting = client ? ` especial para *${client.toUpperCase()}*` : '';
    const filtersLine = filterParts.length > 0 ? `\n🎯 *Seleção de Produtos:* ${filterParts.join(' • ')}\n` : '';
    
    const message = `👋 *Olá! Segue o nosso catálogo exclusivo ${textInd}${clientGreeting}.*\n` +
      filtersLine +
      `\n📲 Acesse o link abaixo para visualizar os produtos e montar o seu pedido diretamente:\n` +
      `👉 ${link}\n\n` +
      `Ao finalizar no carrinho, você me enviará o pedido por aqui mesmo! Fico à disposição. 🛍️`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    setIsShareModalOpen(false);
  };

  // Copy link to clipboard with filtered summary
  const handleCopyIndustryLink = async (manufacturer?: string, respectFilterToggle: boolean = false) => {
    const seller = shareSellerName || profile?.name || 'Vendedor';
    const link = generateIndustryLink(manufacturer, seller, respectFilterToggle);
    const client = selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || '';
    const success = await safeCopyToClipboard(link);
    if (success) {
      const hasExtraFilters = statusFilters.length > 0 || sortBy !== 'default';
      if (client && hasExtraFilters) {
        toast.success(`Link com filtros exclusivos copiado para ${client}!`);
      } else if (client) {
        toast.success(`Link exclusivo copiado para ${client}!`);
      } else if (hasExtraFilters) {
        toast.success('Link do catálogo com seus filtros ativos copiado!');
      } else {
        toast.success('Link exclusivo do catálogo copiado!');
      }
    } else {
      toast.error('Não foi possível copiar o link.');
    }
  };

  useEffect(() => {
    if (!cartLoaded) return;
    
    localStorage.setItem(cartKey, JSON.stringify(cart));
    
    const isPromotor = profile?.role === 'promotor';

    if (profile) {
      const targetClientId = selectedClient?.id || (isPromotor ? 'PROMOTOR' : null);
      if (!targetClientId) return;

      const cartStr = JSON.stringify(cart);
      if (cartStr === lastSyncedCartRef.current) {
        return;
      }

      // Clear any pending sync timeout
      if (saveCartTimeoutRef.current) {
        clearTimeout(saveCartTimeoutRef.current);
      }

      // Update lastSyncedCartRef immediately
      lastSyncedCartRef.current = cartStr;

      // If cart is empty, clear in Firestore and Sheets immediately with no delay!
      if (cart.length === 0) {
        dataService.deleteCart(profile.uid, targetClientId, selectedClient?.cnpj).catch(err => {
          console.error("Error clearing cart in firestore:", err);
        });
        return;
      }

      // Debounce saving to Firestore AND Google Sheets (250ms) for snappy sync across mobile, tablet, and PC
      saveCartTimeoutRef.current = setTimeout(() => {
        dataService.saveCart(profile.uid, targetClientId, cart, selectedClient?.cnpj).catch(err => {
          console.warn("Notice: Cart saved locally. Remote sync notice:", err?.message || err);
        });

        dataService.saveCartToSheets(targetClientId, cart).then((result) => {
          if (result && !result.sucesso) {
            console.warn(`Erro na Planilha ao sincronizar carrinho: ${result.erro}`);
          }
        }).catch(err => {
          console.error(`Erro de conexão com Google Sheets ao salvar carrinho: ${err?.message}`);
        });
      }, 250);
    }

    return () => {
      if (saveCartTimeoutRef.current) {
        clearTimeout(saveCartTimeoutRef.current);
      }
    };
  }, [cart, cartKey, selectedClient, profile, cartLoaded]);

  const filteredProducts = useMemo(() => {
    const currentTabProducts = tabProductsMap[activeTab] || [];

    let result = currentTabProducts.filter(p => {
      // Manufacturer Filter (Multiple Selection - OR within group)
      if (selectedManufacturers.length > 0 && !selectedManufacturers.some(m => m.trim().toLowerCase() === (p.manufacturer || '').trim().toLowerCase())) return false;

      // Category Filter (Multiple Selection - OR within group)
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false;
      
      // Status Filters (Binary Selection - AND between groups)
      if (statusFilters.includes('discount') && p.discount <= 0) return false;
      if (statusFilters.includes('no-discount') && p.discount > 0) return false;
      if (statusFilters.includes('in-stock') && p.stock <= 0) return false;
      if (statusFilters.includes('out-stock') && p.stock > 0) return false;
      if (statusFilters.includes('new') && p.type !== 'new') return false;
      if (statusFilters.includes('promotional') && p.type !== 'offer' && p.discount <= 0) return false;

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
  }, [tabProductsMap, activeTab, search, selectedManufacturers, selectedCategories, statusFilters, priceRange, sortBy, profile?.role]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  // 1. Grava o primeiro produto do resultado da pesquisa ativa para servir de âncora
  useEffect(() => {
    if (search.trim().length > 0 && filteredProducts.length > 0) {
      const firstMatch = filteredProducts[0];
      if (firstMatch) {
        setAnchorProductId(firstMatch.id);
        try {
          sessionStorage.setItem('CATALOG_ANCHOR_PRODUCT_ID', firstMatch.id);
          sessionStorage.setItem('CATALOG_LAST_SEARCHED_TERM', search);
        } catch {}
      }
    }
  }, [search, filteredProducts]);

  // 2. Função para rolar e manter o foco visual no item pesquisado/ancorado
  const scrollToAnchorProduct = useCallback((targetId: string, smooth: boolean = true) => {
    if (!targetId) return;

    const targetIdx = filteredProducts.findIndex(p => p.id === targetId);
    if (targetIdx !== -1) {
      const requiredLimit = Math.ceil((targetIdx + 32) / 32) * 32;
      setDisplayLimit(prev => Math.max(prev, requiredLimit));
    }

    let attempts = 0;
    const maxAttempts = 20;

    const tryScroll = () => {
      const el = document.getElementById(`product-card-${targetId}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - (headerHeight + 70);

        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: smooth ? 'smooth' : 'instant'
        });

        setHighlightedProductId(targetId);
        setTimeout(() => {
          setHighlightedProductId(prev => prev === targetId ? null : prev);
        }, 3000);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 50);
      }
    };

    requestAnimationFrame(() => {
      tryScroll();
    });
  }, [filteredProducts, headerHeight]);

  // 3. Ao apagar a pesquisa, todos os produtos reaparecem e a tela permanece focada no primeiro item pesquisado
  useEffect(() => {
    if (isClearingSearchRef.current && search === '' && anchorProductId && filteredProducts.length > 0) {
      isClearingSearchRef.current = false;
      scrollToAnchorProduct(anchorProductId, true);
    }
  }, [search, anchorProductId, filteredProducts, scrollToAnchorProduct]);

  // 4. Ao atualizar a página (F5 / recarga / reload acidental), restaura o catálogo exatamente de onde o usuário parou
  const initialRestoreRef = useRef(false);
  useEffect(() => {
    if (!loading && products.length > 0 && !initialRestoreRef.current) {
      initialRestoreRef.current = true;
      try {
        const savedClientId = sessionStorage.getItem('CATALOG_CLIENT_ID');
        if (selectedClient?.id && savedClientId && String(selectedClient.id) !== String(savedClientId)) {
          // Cliente diferente, não restaura a rolagem de outro cliente
          return;
        }

        const savedScroll = sessionStorage.getItem('CATALOG_SCROLL_Y');
        const savedVisibleId = sessionStorage.getItem('CATALOG_LAST_VISIBLE_PRODUCT_ID');
        const targetY = savedScroll ? parseFloat(savedScroll) : 0;

        // Se houver pesquisa ativa e âncora de pesquisa específica
        const savedAnchor = sessionStorage.getItem('CATALOG_ANCHOR_PRODUCT_ID');
        if (search.trim().length > 0 && savedAnchor) {
          setTimeout(() => {
            scrollToAnchorProduct(savedAnchor, true);
          }, 150);
          return;
        }

        // Se o usuário estava rolando pelo catálogo (tem produto visível salvo ou scrollY > 40)
        if (savedVisibleId || targetY > 40) {
          // Garante que displayLimit é suficiente para renderizar até o produto salvo
          if (savedVisibleId) {
            const targetIdx = filteredProducts.findIndex(p => p.id === savedVisibleId);
            if (targetIdx !== -1) {
              const neededLimit = Math.ceil((targetIdx + 32) / 32) * 32;
              setDisplayLimit(prev => Math.max(prev, neededLimit));
            }
          }

          const savedLimit = sessionStorage.getItem('CATALOG_DISPLAY_LIMIT');
          if (savedLimit) {
            const parsedLimit = parseInt(savedLimit, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 32) {
              setDisplayLimit(prev => Math.max(prev, parsedLimit));
            }
          }

          // Executa a restauração em múltiplos estágios para compensar o carregamento assíncrono de imagens e cards
          let attempts = 0;
          const maxRestoreAttempts = 7;
          const attemptRestore = () => {
            if (userManuallyInteractedRef.current) return;

            let restored = false;
            if (savedVisibleId) {
              const cardEl = document.getElementById(`product-card-${savedVisibleId}`);
              if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                const curScroll = window.pageYOffset || document.documentElement.scrollTop;
                const calcY = curScroll + rect.top - (headerHeight + 20);
                window.scrollTo({ top: Math.max(0, calcY), behavior: 'instant' });
                restored = true;
              }
            }

            if (!restored && !isNaN(targetY) && targetY > 40) {
              window.scrollTo({ top: targetY, behavior: 'instant' });
            }

            attempts++;
            if (attempts < maxRestoreAttempts && !userManuallyInteractedRef.current) {
              const delays = [40, 100, 200, 350, 600, 1000];
              setTimeout(attemptRestore, delays[attempts - 1] || 250);
            }
          };

          requestAnimationFrame(() => {
            attemptRestore();
          });
        }
      } catch (e) {
        console.debug('[ScrollRestore] Erro ao restaurar rolagem:', e);
      }
    }
  }, [loading, products.length, filteredProducts, headerHeight, search, selectedClient?.id, scrollToAnchorProduct]);

  useEffect(() => {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => Math.min(prev + 32, filteredProducts.length));
      }
    }, { rootMargin: '400px' });

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [displayedProducts.length, filteredProducts.length]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const isOut = product.stock <= 0;
      if (existing) {
        toast.success(`${product.description.substring(0, 20)}... adicionado${isOut ? ' (sem estoque)' : ''}`);
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`${product.description.substring(0, 20)}... adicionado${isOut ? ' (sem estoque)' : ''}`);
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== productId);
      
      return prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
    });
  }, []);

  const setQuantityDirectly = useCallback((productId: string, value: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = Math.max(0, value);
      if (newQty === 0) return prev.filter(i => i.id !== productId);
      
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
    const existingPhoto = (product.photo || (product as any).foto || '').trim();
    setManualImageUrl(existingPhoto);
    setSearchImages([]);
    setSearchingImages(false);
  }, []);

  const isFavorite = (productId: string) => favorites.some(f => f.productId === productId);

  const handleSearchImages = async (product: Product) => {
    try {
      setSearchingImages(true);
      setSearchImages([]);
      
      const response = await fetch("/api/gemini/search-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          description: product.description,
          manufacturer: product.manufacturer
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro na resposta do servidor." }));
        throw new Error(errData.error || "Erro na resposta do servidor.");
      }

      const urls = await response.json();
      setSearchImages(urls);
      if (!urls || urls.length === 0) {
        toast.error('Nenhuma imagem encontrada pela IA.');
      }
    } catch (error: any) {
      console.error('Gemini Search error:', error);
      toast.error(`Erro ao pesquisar imagens com IA: ${error.message || error}`);
    } finally {
      setSearchingImages(false);
    }
  };

  const handleUpdateImage = async (product: Product, url: string) => {
    try {
      toast.loading('Atualizando imagem...', { id: 'update-img' });
      const rawTrimmed = (url || '').trim();
      const cleanUrl = rawTrimmed ? sanitizeImageUrl(rawTrimmed) : '';

      const cleanTargetId = String(product.id || '').trim();
      const cleanTargetEan = product.ean ? String(product.ean).trim().replace(/\D/g, '') : '';
      const cleanTargetDesc = String(product.description || '').trim().toLowerCase();

      // Instantly update product image in local state for seamless UI experience across all tabs & matching products
      setProducts(prev => prev.map(p => {
        const pId = String(p.id || '').trim();
        const pEan = p.ean ? String(p.ean).trim().replace(/\D/g, '') : '';
        const pDesc = String(p.description || '').trim().toLowerCase();

        const matches = (cleanTargetId && pId === cleanTargetId) ||
          (cleanTargetEan && cleanTargetEan.length > 3 && pEan === cleanTargetEan) ||
          (cleanTargetDesc && cleanTargetDesc.length > 5 && pDesc === cleanTargetDesc);

        if (matches) {
          return { ...p, foto: cleanUrl, photo: cleanUrl };
        }
        return p;
      }));

      // Also update selectedProductDetails if open
      setSelectedProductDetails(prev => {
        if (!prev) return null;
        const prevId = String(prev.id || '').trim();
        const prevEan = prev.ean ? String(prev.ean).trim().replace(/\D/g, '') : '';
        const matches = (cleanTargetId && prevId === cleanTargetId) || (cleanTargetEan && cleanTargetEan.length > 3 && prevEan === cleanTargetEan);
        return matches ? { ...prev, foto: cleanUrl, photo: cleanUrl } : prev;
      });

      const result = await dataService.updateProductImage(
        product.id, 
        cleanUrl, 
        product.type,
        { ean: product.ean, description: product.description, manufacturer: product.manufacturer }
      );

      if (result.success) {
        toast.success(cleanUrl ? 'Imagem atualizada com sucesso!' : 'Imagem removida com sucesso!', { id: 'update-img' });
        setUpdatingImageProduct(null);
        // Refresh products in background
        dataService.getAllProducts().then(data => {
          if (data && data.length > 0) setProducts(data);
        }).catch(console.error);
      } else {
        toast.error(`Erro ao atualizar imagem: ${result.error || 'Verifique se a planilha está compartilhada com o e-mail da conta de serviço.'}`, { id: 'update-img', duration: 6000 });
      }
    } catch (error: any) {
       toast.error(`Erro ao atualizar imagem: ${error.message || error}`, { id: 'update-img' });
    }
  };

  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let noStock = 0;
    let discount = 0;

    cart.forEach(item => {
      const enriched = enrichOrderItem(item, products);
      const salePrice = enriched.salePrice || enriched.finalPrice || 0;
      const finalPrice = enriched.finalPrice || salePrice;
      const qty = item.quantity || 1;

      const itemSubtotal = salePrice * qty;
      subtotal += itemSubtotal;

      const hasStock = enriched.stock > 0;
      if (!hasStock) {
        noStock += itemSubtotal;
      } else {
        discount += Math.max(0, (salePrice - finalPrice) * qty);
      }
    });

    const roundedSubtotal = Math.round(subtotal * 100) / 100;
    const roundedNoStock = Math.round(noStock * 100) / 100;
    const roundedDiscount = Math.round(discount * 100) / 100;
    const roundedTotal = Math.max(0, Math.round((roundedSubtotal - roundedNoStock - roundedDiscount) * 100) / 100);

    return {
      subtotal: roundedSubtotal,
      noStock: roundedNoStock,
      discount: roundedDiscount,
      total: roundedTotal
    };
  }, [cart, products]);

  const cartSubtotal = cartSummary.subtotal;
  const cartTotal = cartSummary.total;
  const cartDiscount = cartSummary.discount;
  const cartNoStock = cartSummary.noStock;

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartByIndustry = useMemo(() => {
    const groups: Record<string, {
      manufacturer: string;
      items: OrderItem[];
      subtotal: number;
      discount: number;
      noStock: number;
      total: number;
      totalQuantity: number;
    }> = {};

    cart.forEach(item => {
      const enriched = enrichOrderItem(item, products);
      const mfg = (enriched.manufacturer || item.manufacturer || 'Outros').trim() || 'Outros';

      const salePrice = enriched.salePrice || enriched.finalPrice || 0;
      const finalPrice = enriched.finalPrice || salePrice;
      const qty = item.quantity || 1;

      const itemSubtotal = salePrice * qty;
      const hasStock = enriched.stock > 0;
      const itemDiscount = hasStock ? Math.max(0, (salePrice - finalPrice) * qty) : 0;
      const itemNoStock = !hasStock ? itemSubtotal : 0;

      if (!groups[mfg]) {
        groups[mfg] = {
          manufacturer: mfg,
          items: [],
          subtotal: 0,
          discount: 0,
          noStock: 0,
          total: 0,
          totalQuantity: 0
        };
      }

      groups[mfg].items.push(item);
      groups[mfg].subtotal += itemSubtotal;
      groups[mfg].discount += itemDiscount;
      groups[mfg].noStock += itemNoStock;
      groups[mfg].totalQuantity += qty;
    });

    return Object.values(groups).map(g => {
      const roundedSubtotal = Math.round(g.subtotal * 100) / 100;
      const roundedDiscount = Math.round(g.discount * 100) / 100;
      const roundedNoStock = Math.round(g.noStock * 100) / 100;
      const roundedTotal = Math.max(0, Math.round((roundedSubtotal - roundedNoStock - roundedDiscount) * 100) / 100);
      return {
        ...g,
        subtotal: roundedSubtotal,
        discount: roundedDiscount,
        noStock: roundedNoStock,
        total: roundedTotal
      };
    }).sort((a, b) => b.total - a.total);
  }, [cart, products]);

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
    return tabProductsMap.ofertas.filter(p => p.stock > 0).length;
  }, [tabProductsMap]);

  const generateOrderPDF = async (order: any, items: OrderItem[]) => {
    toast.loading('Gerando PDF do pedido...', { id: 'pdf-export' });
    try {
      let currentProducts = products;
      if (!currentProducts || currentProducts.length === 0) {
        try {
          currentProducts = await dataService.getAllProducts();
        } catch (_) {}
      }
      const enrichedItems = items.map(item => enrichOrderItem(item, currentProducts));
      const thumbnails = await preloadProductThumbnails(enrichedItems, currentProducts);
      const doc = new jsPDF();

      const rawOrderId = order?.id ? String(order.id) : '';
      const digitsOnly = rawOrderId.replace(/\D/g, '');
      const orderIdStr = digitsOnly.length >= 5 ? `PED${digitsOnly}` : 'PED' + Date.now().toString().slice(-10);
      drawPDFHeader(doc, {
        subtitle: 'ESPELHO DO PEDIDO',
        orderNumber: orderIdStr,
        dateTimeStr: new Date(order?.date || Date.now()).toLocaleString('pt-BR'),
        regionStr: profile?.regional ? getRegionalLabel(profile.regional) : (sharedRegional ? getRegionalLabel(sharedRegional) : 'TERESINA - PI'),
        phoneStr: order?.sellerPhone || shareSellerPhone || profile?.phone || '(86) 99964-7573',
        sellerStr: order?.seller || shareSellerName || profile?.name || 'LEONEL'
      });

      const effectiveClient = order?.client || 
        allClients.find(c => (order?.clientId && c.id === order.clientId) || (order?.cnpj && c.cnpj?.replace(/\D/g, '') === order.cnpj.replace(/\D/g, ''))) ||
        selectedClient;

      const rawCnpj = effectiveClient?.cnpj || order?.clientCnpj || order?.cnpj || sharedClientCnpj;
      const formattedCnpj = rawCnpj ? formatCNPJ(rawCnpj) : 'N/A';
      const clientTradeName = (effectiveClient?.tradeName || effectiveClient?.name || order?.clientName || sharedClientName || 'N/A').toUpperCase();
      const clientLegalName = (effectiveClient?.name || order?.clientName || sharedClientName || 'N/A').toUpperCase();
      const clientAddress = effectiveClient?.address ? effectiveClient.address.toUpperCase() : 'N/A';
      const clientCityState = effectiveClient?.city ? `${effectiveClient.city} / ${effectiveClient.state || 'PI'}`.toUpperCase() : 'N/A';

      const clientFields = profile?.role === 'promotor'
        ? [
            { icon: 'user', label: 'Cliente', value: (manualClientName || 'CLIENTE').toUpperCase() },
            { icon: 'user', label: 'Promotor', value: (profile?.name || 'PROMOTOR').toUpperCase() }
          ]
        : [
            { icon: 'user', label: 'Cliente', value: clientTradeName },
            { icon: 'user', label: 'Vendedor', value: (order?.seller || profile?.name || 'LEONEL AMORIM').toUpperCase() },
            { icon: 'id', label: 'ID Cliente', value: String(effectiveClient?.id || order?.clientId || 'N/A') },
            { icon: 'email', label: 'E-mail', value: (effectiveClient?.email || profile?.email || 'N/A').toUpperCase() },
            { icon: 'user', label: 'Nome', value: clientLegalName },
            { icon: 'mapPin', label: 'Endereço', value: clientAddress },
            { icon: 'building', label: 'CNPJ', value: formattedCnpj },
            { icon: 'mapPin', label: 'Cidade/Estado', value: clientCityState },
            { icon: 'phone', label: 'Celular', value: effectiveClient?.phone || '-' }
          ];

      let currentY = drawClientDataCard(doc, 42, clientFields);

      const groupedItems = enrichedItems.reduce((acc: any, item) => {
        const manufacturer = item.manufacturer || 'OUTROS';
        if (!acc[manufacturer]) acc[manufacturer] = [];
        acc[manufacturer].push(item);
        return acc;
      }, {});

      Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
        if (currentY > 210) {
          doc.addPage();
          currentY = 20;
        }

        const tableData = mItems.map((item: any) => {
          const salePrice = Number(item.salePrice) || 0;
          const finalPrice = Number(item.finalPrice) || salePrice;
          const discVal = Number(item.discount) || (salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0);
          const discountStr = discVal > 0 ? `${discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-';
          const rowSubtotal = Math.round(finalPrice * (item.quantity || 1) * 100) / 100;
          const hasStock = item.stock > 0;
          const itemDesc = String(item.description || 'PRODUTO').toUpperCase();

          return [
            '',
            item.id || '1010342',
            item.ean || '7896007354713',
            itemDesc,
            formatCurrency(salePrice),
            discountStr,
            formatCurrency(finalPrice),
            item.quantity || 1,
            formatCurrency(rowSubtotal),
            hasStock ? '✔ OK' : 'Sem estoque'
          ];
        });

        let indSubtotal = 0;
        let indNoStock = 0;
        let indDiscount = 0;

        mItems.forEach((item: any) => {
          const salePrice = Number(item.salePrice || item.finalPrice) || 0;
          const finalPrice = Number(item.finalPrice) || salePrice;
          const qty = Number(item.quantity) || 1;
          const itemSaleSubtotal = salePrice * qty;

          indSubtotal += itemSaleSubtotal;

          const hasStock = item.stock > 0;
          if (!hasStock) {
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
            [{ content: `INDÚSTRIA: ${(manufacturer || 'GERAL').toUpperCase()}`, colSpan: 10, styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: { top: 3, bottom: 3 } } }],
            ['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'DESC %', 'PR. FINAL', 'QT', 'SUBTOTAL', 'STATUS']
          ],
          body: tableData,
          theme: 'grid',
          headStyles: { 
            fillColor: [255, 107, 0], // Bright Orange
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
            9: { halign: 'center', cellWidth: 16 }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body') {
              const rawVal = String(data.cell.raw || (Array.isArray(data.cell.text) ? data.cell.text.join('') : data.cell.text) || '');
              if (rawVal.toLowerCase().includes('sem estoque')) {
                data.cell.styles.textColor = [220, 38, 38]; // RED
                data.cell.styles.fontStyle = 'bold';
              } else if (rawVal === 'OK' || rawVal === '✔ OK') {
                data.cell.styles.textColor = [22, 163, 74]; // GREEN
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              const item = mItems[data.row.index];
              if (item) {
                const keyCandidates = [
                  item.id ? String(item.id).trim() : '',
                  item.ean ? String(item.ean).trim() : '',
                  item.ean ? normalizeEANKey(item.ean) : '',
                  item.code ? String(item.code).trim() : '',
                  item.description ? String(item.description).trim() : '',
                  item.photo ? String(item.photo).trim() : '',
                  String(item.id || item.ean || item.description || '')
                ];
                let imgData: string | null = null;
                for (const k of keyCandidates) {
                  if (k && thumbnails[k]) {
                    imgData = thumbnails[k];
                    break;
                  }
                }
                if (!imgData && (item.description || item.manufacturer)) {
                  imgData = createCanvasFallbackImage(item.description || 'PRODUTO', item.manufacturer || 'VENDAS HBN1');
                }

                if (imgData) {
                  try {
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(226, 232, 240);
                    doc.roundedRect(data.cell.x + 1.5, data.cell.y + 1, 11, 10, 0.5, 0.5, 'FD');
                    const imgFormat = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(imgData, imgFormat, data.cell.x + 2, data.cell.y + 1.5, 10, 9, undefined, 'FAST');
                  } catch (e) {
                    console.error('Erro ao desenhar imagem na célula do PDF:', e);
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
            title: `Resumo - INDÚSTRIA: ${(manufacturer || 'GERAL').toUpperCase()}`,
            totalLabel: `TOTAL INDÚSTRIA (${(manufacturer || 'GERAL').toUpperCase()})`
          }
        );
        currentY += 4;
      });

      let totalSalePrice = 0;
      let totalNoStock = 0;
      let totalDiscount = 0;

      enrichedItems.forEach(item => {
        const salePrice = Number(item.salePrice || item.finalPrice) || 0;
        const finalPrice = Number(item.finalPrice) || salePrice;
        const qty = Number(item.quantity) || 1;

        const itemSaleSubtotal = salePrice * qty;
        totalSalePrice += itemSaleSubtotal;

        const hasStock = item.stock > 0;
        if (!hasStock) {
          totalNoStock += itemSaleSubtotal;
        } else {
          totalDiscount += Math.max(0, (salePrice - finalPrice) * qty);
        }
      });

      totalSalePrice = Math.round(totalSalePrice * 100) / 100;
      totalNoStock = Math.round(totalNoStock * 100) / 100;
      totalDiscount = Math.round(totalDiscount * 100) / 100;
      const totalFinalPrice = Math.max(0, Math.round((totalSalePrice - totalNoStock - totalDiscount) * 100) / 100);

      currentY = drawBottomSummaryCards(doc, currentY, {
        subtotal: totalSalePrice,
        noStock: totalNoStock,
        discount: totalDiscount,
        finalTotal: totalFinalPrice
      });

      drawPDFFooterStrip(doc, profile, getRegionalLabel(profile?.regional));

      const rName = selectedClient?.name || order?.clientName || 'CLIENTE';
      const cleanRName = rName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

      const cleanCnpjStr = (selectedClient?.cnpj || '').replace(/\D/g, '');

      const rawDate = order?.date ? new Date(order.date) : new Date();
      const orderDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
      const dayStr = String(orderDate.getDate()).padStart(2, '0');
      const monthStr = String(orderDate.getMonth() + 1).padStart(2, '0');
      const yearStr = String(orderDate.getFullYear());
      const hourStr = String(orderDate.getHours()).padStart(2, '0');
      const minStr = String(orderDate.getMinutes()).padStart(2, '0');
      const secStr = String(orderDate.getSeconds()).padStart(2, '0');

      const dateAndTimeStr = `${dayStr}${monthStr}${yearStr}${hourStr}${minStr}${secStr}`;
      const formattedFilename = `${cleanRName}${cleanCnpjStr}${dateAndTimeStr}.pdf`;

      doc.save(formattedFilename);
      toast.success('PDF do pedido gerado com sucesso!', { id: 'pdf-export' });
    } catch (err: any) {
      console.error('Erro ao gerar PDF do pedido:', err);
      toast.error(`Erro ao gerar PDF: ${err?.message || 'Erro desconhecido'}`, { id: 'pdf-export' });
    }
  };

  const exportCatalogToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const orange: [number, number, number] = [255, 107, 0];
    const white: [number, number, number] = [255, 255, 255];
    const gray: [number, number, number] = [100, 100, 100];
    const borderGray: [number, number, number] = [230, 230, 230];

    toast.loading('Gerando catálogo em PDF...', { id: 'pdf-gen' });

    const imagesCache = await preloadProductThumbnails(filteredProducts);

    const title = selectedManufacturers.length > 0 
      ? `CATÁLOGO DE PRODUTOS — ${selectedManufacturers.join(', ').toUpperCase()}`
      : 'CATÁLOGO GERAL DE PRODUTOS';

    const clientSuffix = selectedClient ? `  •  CLIENTE: ${(selectedClient.tradeName || selectedClient.name).toUpperCase()}` : '';

    const drawHeader = () => {
      drawPDFHeader(doc, {
        subtitle: `${title}${clientSuffix}`,
        orderNumber: 'CATÁLOGO',
        orderLabel: 'DOCUMENTO',
        dateTimeStr: new Date().toLocaleDateString('pt-BR'),
        regionStr: profile?.regional ? getRegionalLabel(profile.regional) : 'TERESINA - PI',
        phoneStr: profile?.phone || '(86) 99964-7573',
        sellerStr: profile?.name || 'LEONEL'
      });
    };

    // Designed to fit exactly 18 products per page with high elegance, optimal readability and a modern landscape layout
    const drawCard = (p: Product, x: number, y: number, w: number, h: number) => {
      // Draw outer elegant card border with very soft rounded rectangle
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

      // Left column: Image Box container
      const imgW = 22;
      const imgH = 22;
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
      const tx = x + 26;

      // Category (Sleek pink text)
      doc.setFontSize(4.5);
      doc.setTextColor(240, 98, 146);
      doc.setFont('helvetica', 'bold');
      doc.text(p.category.toUpperCase(), tx, y + 3.8);

      // Title/Description (supports exactly 2 lines maximum)
      doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      const dLines = doc.splitTextToSize(p.description, w - 26 - 2.5);
      doc.text(dLines.slice(0, 2), tx, y + 6.3);

      // Manufacturer (small and light gray)
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(p.manufacturer.toUpperCase(), tx, y + 12.2);

      // Offer discount expiry date
      if (p.discount > 0 && p.discountExpiryDate) {
        doc.setFontSize(4);
        doc.setTextColor(230, 81, 0); // Orange-900
        doc.setFont('helvetica', 'bold');
        doc.text(`EXPIRA: ${new Date(p.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}`, x + w - 2.5, y + 12.2, { align: 'right' });
      }

      // ID and EAN code badges (drawn side-by-side)
      const pillY = y + 13.8;
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
      const priceY = y + 19.8;
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
        const savingsY = priceY + 5.8;
        doc.setFillColor(34, 197, 94); // Beautiful green
        doc.roundedRect(tx, savingsY, w - 26 - 2.5, 3.2, 0.6, 0.6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`\u2605 ECON. ${formatCurrency(savings)}`, tx + (w - 26 - 2.5) / 2, savingsY + 2.3, { align: 'center' });
      }

      // Stock indicator at the bottom edge
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(`Estoque: ${p.stock}`, tx, y + h - 1.8);
    };

    // Calculate layout for exactly 18 products per page (3 columns x 6 rows)
    const columns = 3;
    const margin = 8;
    const cardGap = 1.6;
    const cw = (pageWidth - (margin * 2) - (cardGap * (columns - 1))) / columns;
    const ch = 39.0; // Optimized height to perfectly clear footer
    
    let col = 0;
    let row = 0;

    drawHeader();

    for (const p of filteredProducts) {
      if (row >= 6) { // Exactly 6 rows per page => 18 products max
        doc.addPage();
        drawHeader();
        row = 0;
        col = 0;
      }
      const tx = margin + (col * (cw + cardGap));
      const ty = 42 + (row * (ch + cardGap));
      drawCard(p, tx, ty, cw, ch);
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }

    // Apply standard PDF footer to all pages
    drawPDFFooterStrip(doc, profile, profile?.regional ? getRegionalLabel(profile.regional) : 'TERESINA - PI');

    const fName = selectedManufacturers.length > 0 
      ? `Catalogo_${selectedManufacturers[0]}_${new Date().getTime()}.pdf`
      : `Catalogo_HBN1_${new Date().getTime()}.pdf`;
      
    doc.save(fName);
    toast.success('Catálogo 100% exportado!', { id: 'pdf-gen' });
  };


  const generateOrderExcel = async (order: any, items: OrderItem[]) => {
    toast.loading('Gerando Excel do pedido...', { id: 'excel-export' });
    try {
      const enrichedItems = items.map(item => enrichOrderItem(item, products));
      const thumbnails = await preloadProductThumbnails(enrichedItems, products);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pedido');

      const navyColor = 'FF0F172A';
      const orangeColor = 'FFFF6B00';
      const whiteColor = 'FFFFFFFF';
      const slateDark = 'FF1E293B';
      const cardBgColor = 'FFF8FAFC';

      // 1. Header Banner
      worksheet.mergeCells('A1:J2');
      const headerCell = worksheet.getCell('A1');
      headerCell.value = 'VENDAS HBN1 — COMPROVANTE DE PEDIDO';
      headerCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: whiteColor } };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Subheader accent strip
      worksheet.mergeCells('A3:J3');
      const subHeaderCell = worksheet.getCell('A3');
      const region = profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA';
      subHeaderCell.value = `${region} • Tel: ${profile?.phone || '(86) 99964-7573'} • ${profile?.email || 'leonelamorimm@gmail.com'}`;
      subHeaderCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: whiteColor } };
      subHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
      subHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Order Meta row
      const rawOrderId = order?.id ? String(order.id) : '';
      const digitsOnly = rawOrderId.replace(/\D/g, '');
      const orderIdStr = digitsOnly.length >= 5 ? `PED${digitsOnly}` : 'PED1785350359114';

      const metaRow = worksheet.addRow([
        `Nº do Pedido: ${orderIdStr}`, '', '', '', '', '', '', '', `Data: ${new Date(order?.date || Date.now()).toLocaleString('pt-BR')}`
      ]);
      worksheet.mergeCells(`A4:E4`);
      worksheet.mergeCells(`I4:J4`);
      metaRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: slateDark } };

      worksheet.addRow([]);

      // 2. Client Info Section
      const clientHeaderRow = worksheet.addRow(['DADOS DO CLIENTE E VENDEDOR']);
      worksheet.mergeCells(`A6:J6`);
      clientHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      clientHeaderRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: whiteColor } };
      clientHeaderRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const effectiveClient = order?.client || 
        allClients.find(c => (order?.clientId && c.id === order.clientId) || (order?.cnpj && c.cnpj?.replace(/\D/g, '') === order.cnpj.replace(/\D/g, ''))) ||
        selectedClient;

      const rawCnpj = effectiveClient?.cnpj || order?.cnpj;
      const formattedCnpj = rawCnpj ? formatCNPJ(rawCnpj) : '-';
      const clientTradeName = (effectiveClient?.tradeName || effectiveClient?.name || order?.clientName || '-').toUpperCase();
      const clientLegalName = (effectiveClient?.name || order?.clientName || '-').toUpperCase();
      const clientAddress = effectiveClient?.address ? effectiveClient.address.toUpperCase() : '-';
      const clientCityState = effectiveClient?.city ? `${effectiveClient.city} / ${effectiveClient.state || 'PI'}`.toUpperCase() : '-';

      const clientRows = profile?.role === 'promotor'
        ? [
            ['Cliente', (manualClientName || 'CLIENTE').toUpperCase()],
            ['Promotor', (profile?.name || 'PROMOTOR').toUpperCase()],
          ]
        : [
            ['Cliente / Fantasia', clientTradeName],
            ['ID Cliente', String(effectiveClient?.id || order?.clientId || '-')],
            ['Razão Social', clientLegalName],
            ['CNPJ', formattedCnpj],
            ['Vendedor', (order?.seller || profile?.name || '-').toUpperCase()],
            ['Cidade / Estado', clientCityState],
            ['E-mail', (effectiveClient?.email || profile?.email || '-').toUpperCase()],
            ['Endereço', clientAddress],
            ['Telefone', effectiveClient?.phone || '-']
          ];

      clientRows.forEach(row => {
        const r = worksheet.addRow(row);
        r.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: 'FF475569' } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cardBgColor } };
        r.getCell(2).font = { name: 'Calibri', bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cardBgColor } };
        worksheet.mergeCells(`B${r.number}:J${r.number}`);
      });

      worksheet.addRow([]);

      // 3. Products Grouped
      const groupedItems = enrichedItems.reduce((acc: any, item) => {
        const manufacturer = item.manufacturer || 'GERAL';
        if (!acc[manufacturer]) acc[manufacturer] = [];
        acc[manufacturer].push(item);
        return acc;
      }, {});

      const isPromoter = profile?.role === 'promotor';

      Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
        const mHeaderRow = worksheet.addRow([`INDÚSTRIA: ${(manufacturer || 'GERAL').toUpperCase()}`]);
        worksheet.mergeCells(`A${mHeaderRow.number}:J${mHeaderRow.number}`);
        mHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
        mHeaderRow.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: whiteColor }, size: 10 };
        mHeaderRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const tableHeader = isPromoter
          ? worksheet.addRow(['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'QT', 'SUBTOTAL', 'STATUS'])
          : worksheet.addRow(['FOTO', 'COD.', 'EAN', 'DESCRICAO', 'PRECO', 'DESC%', 'PR.FINAL', 'QT', 'SUBTOTAL', 'STATUS']);

        tableHeader.height = 24;
        tableHeader.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
          cell.font = { name: 'Calibri', bold: true, color: { argb: whiteColor }, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        mItems.forEach((item: any) => {
          const hasStock = item.stock > 0;
          const statusText = hasStock ? 'OK' : 'Sem estoque';
          const salePrice = Number(item.salePrice) || 0;
          const finalPrice = Number(item.finalPrice) || salePrice;
          const quantity = Number(item.quantity) || 1;
          const discountVal = Number(item.discount) || 0;
          const itemDesc = String(item.description || 'PRODUTO').toUpperCase();

          const rowData = isPromoter
            ? [
                '',
                item.id || '1010342',
                item.ean || '-',
                itemDesc,
                salePrice,
                quantity,
                quantity * salePrice,
                statusText
              ]
            : [
                '',
                item.id || '1010342',
                item.ean || '-',
                itemDesc,
                salePrice,
                discountVal > 0 ? `${discountVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-',
                finalPrice,
                quantity,
                quantity * finalPrice,
                statusText
              ];
          
          const row = worksheet.addRow(rowData);
          row.height = 36;

          row.eachCell((cell, colNumber) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Calibri', size: 9 };
            
            if (isPromoter) {
              if (colNumber === 4) cell.alignment = { horizontal: 'left', vertical: 'middle' };
              if (colNumber === 5 || colNumber === 7) cell.numFmt = '"R$ "#,##0.00';
              if (colNumber === 7) cell.font = { name: 'Calibri', color: { argb: orangeColor }, bold: true, size: 9 };
              if (colNumber === 8) cell.font = { name: 'Calibri', color: { argb: hasStock ? 'FF16A34A' : 'FFDC2626' }, bold: true, size: 9 };
            } else {
              if (colNumber === 4) cell.alignment = { horizontal: 'left', vertical: 'middle' };
              if (colNumber === 5 || colNumber === 7 || colNumber === 9) cell.numFmt = '"R$ "#,##0.00';
              if (colNumber === 6) cell.font = { name: 'Calibri', color: { argb: 'FF16A34A' }, bold: true, size: 9 };
              if (colNumber === 7) cell.font = { name: 'Calibri', color: { argb: 'FF0F172A' }, bold: true, size: 9 };
              if (colNumber === 9) cell.font = { name: 'Calibri', color: { argb: orangeColor }, bold: true, size: 9 };
              if (colNumber === 10) cell.font = { name: 'Calibri', color: { argb: hasStock ? 'FF16A34A' : 'FFDC2626' }, bold: true, size: 9 };
            }
          });

          // Embed product thumbnail in Col A
          const keyCandidates = [
            item.id ? String(item.id).trim() : '',
            item.ean ? String(item.ean).trim() : '',
            item.ean ? normalizeEANKey(item.ean) : '',
            item.code ? String(item.code).trim() : '',
            item.description ? String(item.description).trim() : '',
            item.photo ? String(item.photo).trim() : '',
            String(item.id || item.ean || item.description || '')
          ];
          let imgData: string | null = null;
          for (const k of keyCandidates) {
            if (k && thumbnails[k]) {
              imgData = thumbnails[k];
              break;
            }
          }
          if (!imgData && (item.description || item.manufacturer)) {
            imgData = createCanvasFallbackImage(item.description || 'PRODUTO', item.manufacturer || 'VENDAS HBN1');
          }

          if (imgData) {
            try {
              const cleanBase64 = imgData.replace(/^data:image\/\w+;base64,/, '');
              const ext = imgData.startsWith('data:image/png') ? 'png' : 'jpeg';
              const imageId = workbook.addImage({
                base64: cleanBase64,
                extension: ext as any,
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

        // Industry Summary Row
        let indSubtotal = 0;
        let indNoStock = 0;
        let indDiscount = 0;

        mItems.forEach((item: any) => {
          const salePrice = Number(item.salePrice || item.finalPrice) || 0;
          const finalPrice = Number(item.finalPrice) || salePrice;
          const qty = Number(item.quantity) || 1;
          const itemSaleSubtotal = salePrice * qty;

          indSubtotal += itemSaleSubtotal;

          const hasStock = item.stock > 0;
          if (!hasStock) {
            indNoStock += itemSaleSubtotal;
          } else {
            indDiscount += Math.max(0, (salePrice - finalPrice) * qty);
          }
        });

        indSubtotal = Math.round(indSubtotal * 100) / 100;
        indNoStock = Math.round(indNoStock * 100) / 100;
        indDiscount = Math.round(indDiscount * 100) / 100;
        const indTotal = Math.max(0, Math.round((indSubtotal - indNoStock - indDiscount) * 100) / 100);

        const colStart = 4;
        const colVal = isPromoter ? 7 : 9;
        const colEnd = isPromoter ? 7 : 10;

        // 1. Industry Summary Header
        const indHeaderRow = worksheet.addRow([]);
        const indStartRowNum = indHeaderRow.number;
        indHeaderRow.getCell(colStart).value = `RESUMO - INDÚSTRIA: ${(manufacturer || 'GERAL').toUpperCase()}`;
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

        // 2. Subtotal Row
        const subRow = worksheet.addRow([]);
        const subRowNum = subRow.number;
        subRow.getCell(colStart).value = 'SUBTOTAL (TABELA):';
        subRow.getCell(colVal).value = indSubtotal;
        worksheet.mergeCells(subRowNum, colStart, subRowNum, colVal - 1);
        if (colVal < colEnd) worksheet.mergeCells(subRowNum, colVal, subRowNum, colEnd);
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

        // 3. Sem Estoque Row
        if (indNoStock > 0) {
          const nsRow = worksheet.addRow([]);
          const nsRowNum = nsRow.number;
          nsRow.getCell(colStart).value = 'SEM ESTOQUE:';
          nsRow.getCell(colVal).value = -indNoStock;
          worksheet.mergeCells(nsRowNum, colStart, nsRowNum, colVal - 1);
          if (colVal < colEnd) worksheet.mergeCells(nsRowNum, colVal, nsRowNum, colEnd);
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

        // 4. Desconto Row
        if (indDiscount > 0) {
          const discRow = worksheet.addRow([]);
          const discRowNum = discRow.number;
          discRow.getCell(colStart).value = 'DESCONTO TOTAL:';
          discRow.getCell(colVal).value = -indDiscount;
          worksheet.mergeCells(discRowNum, colStart, discRowNum, colVal - 1);
          if (colVal < colEnd) worksheet.mergeCells(discRowNum, colVal, discRowNum, colEnd);
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

        // 5. Total Banner Row
        const totRow = worksheet.addRow([]);
        const totRowNum = totRow.number;
        totRow.getCell(colStart).value = `TOTAL INDÚSTRIA (${(manufacturer || 'GERAL').toUpperCase()})`;
        totRow.getCell(colVal).value = indTotal;
        worksheet.mergeCells(totRowNum, colStart, totRowNum, colVal - 1);
        if (colVal < colEnd) worksheet.mergeCells(totRowNum, colVal, totRowNum, colEnd);
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

      let totalSalePrice = 0;
      let totalNoStock = 0;
      let totalDiscount = 0;

      enrichedItems.forEach(item => {
        const salePrice = Number(item.salePrice || item.finalPrice) || 0;
        const finalPrice = Number(item.finalPrice) || salePrice;
        const qty = Number(item.quantity) || 1;

        const itemSaleSubtotal = salePrice * qty;
        totalSalePrice += itemSaleSubtotal;

        const hasStock = item.stock > 0;
        if (!hasStock) {
          totalNoStock += itemSaleSubtotal;
        } else {
          totalDiscount += Math.max(0, (salePrice - finalPrice) * qty);
        }
      });

      totalSalePrice = Math.round(totalSalePrice * 100) / 100;
      totalNoStock = Math.round(totalNoStock * 100) / 100;
      totalDiscount = Math.round(totalDiscount * 100) / 100;
      const totalFinalPrice = Math.max(0, Math.round((totalSalePrice - totalNoStock - totalDiscount) * 100) / 100);

      const finalHeader = worksheet.addRow(['RESUMO FINANCEIRO DO PEDIDO']);
      worksheet.mergeCells(`A${finalHeader.number}:J${finalHeader.number}`);
      finalHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyColor } };
      finalHeader.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: whiteColor }, size: 10 };

      const addFinalRow = (label: string, value: number, color?: string, isTotal = false) => {
        const row = worksheet.addRow(['', '', '', '', '', '', '', label, '', value]);
        worksheet.mergeCells(`H${row.number}:I${row.number}`);
        const bgColor = isTotal ? orangeColor : cardBgColor;
        const textColor = isTotal ? whiteColor : (color || 'FF0F172A');
        
        row.height = isTotal ? 24 : 18;
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.getCell(8).font = { name: 'Calibri', bold: true, color: { argb: textColor }, size: isTotal ? 10 : 9 };
        row.getCell(10).font = { name: 'Calibri', bold: true, color: { argb: textColor }, size: isTotal ? 11 : 9 };
        row.getCell(10).numFmt = '"R$ "#,##0.00';
        row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      };

      if (isPromoter) {
        addFinalRow('TOTAL A PAGAR', totalSalePrice, undefined, true);
      } else {
        addFinalRow('SUBTOTAL (TABELA)', totalSalePrice);
        if (totalNoStock > 0) {
          addFinalRow('SEM ESTOQUE', -totalNoStock, 'FFDC2626');
        }
        if (totalDiscount > 0) {
          addFinalRow('DESCONTO TOTAL', -totalDiscount, 'FF16A34A');
        }
        addFinalRow('TOTAL A PAGAR', totalFinalPrice, undefined, true);
      }

      worksheet.addRow([]);

      const trustRow1 = worksheet.addRow(['COMPRA SEGURA E CONFIÁVEL • Agradecemos pela preferência!']);
      worksheet.mergeCells(`A${trustRow1.number}:J${trustRow1.number}`);
      trustRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      trustRow1.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      trustRow1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const trustRow2 = worksheet.addRow(['[ 1. Pedido Registrado ]  ➔  [ 2. Em Processamento ]  ➔  [ 3. Separação ]  ➔  [ 4. Entrega ]']);
      worksheet.mergeCells(`A${trustRow2.number}:J${trustRow2.number}`);
      trustRow2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      trustRow2.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: 'FF60A5FA' }, size: 8.5 };
      trustRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.columns = [
        { width: 10 }, { width: 12 }, { width: 18 }, { width: 45 }, { width: 15 }, { width: 14 }, { width: 15 }, { width: 14 }, { width: 15 }, { width: 12 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const rName = selectedClient?.name || order?.clientName || 'CLIENTE';
      const cleanRName = rName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

      const cleanCnpjStr = (selectedClient?.cnpj || '').replace(/\D/g, '');

      const rawDate = order?.date ? new Date(order.date) : new Date();
      const orderDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
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
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        try {
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // ignore cleanup errors
        }
      }, 2000);

      toast.success('Excel do pedido gerado com sucesso!', { id: 'excel-export' });
    } catch (err: any) {
      console.error('Erro ao gerar Excel do pedido:', err);
      toast.error(`Erro ao gerar Excel: ${err?.message || 'Erro desconhecido'}`, { id: 'excel-export' });
    }
  };

  const generateCartShareLink = (items: OrderItem[]) => {
    const baseUrl = `${getPublicBaseUrl()}/catalog`;
    const cartCompact = items.map(i => `${i.ean || i.id}:${i.quantity}`).join(',');
    const params = new URLSearchParams();
    if (cartCompact) params.set('cart', cartCompact);
    const activeInd = activeIndustryFilter || selectedManufacturers[0] || (items[0]?.manufacturer) || '';
    if (activeInd) {
      params.set('ind', activeInd);
    }
    const finalSeller = shareSellerName || profile?.name || 'Vendedor';
    params.set('seller', finalSeller);
    params.set('phone', shareSellerPhone || profile?.phone || '5586999647573');
    params.set('shared', 'true');
    if (currentLinkId) {
      params.set('lid', currentLinkId);
    }
    const finalClient = selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || '';
    if (finalClient) {
      params.set('client', finalClient);
    }
    if (selectedClient?.id || sharedClientId) {
      params.set('clientId', selectedClient?.id || sharedClientId);
    }
    if (selectedClient?.cnpj || sharedClientCnpj) {
      params.set('cnpj', selectedClient?.cnpj || sharedClientCnpj);
    }
    if (selectedClient?.regional || sharedRegional) {
      params.set('reg', selectedClient?.regional || sharedRegional);
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const sendToWhatsApp = (order: any, items: OrderItem[]) => {
    const recipientPhone = shareSellerPhone || profile?.phone || '5586999647573';

    const enrichedItems = items.map(item => enrichOrderItem(item, products));

    let message = `🛍️ *PEDIDO VIA CATÁLOGO DE VENDAS*\n\n`;
    const clientDisplayName = order?.clientName || selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || 'Cliente';
    message += `🏪 *Cliente:* ${clientDisplayName}\n`;
    const currentCnpj = order?.clientCnpj || selectedClient?.cnpj || sharedClientCnpj;
    if (currentCnpj) {
      message += `📄 *CNPJ:* ${currentCnpj}\n`;
    }
    const currentInd = activeIndustryFilter || selectedManufacturers[0] || (items[0]?.manufacturer) || '';
    if (currentInd) {
      message += `🏭 *Indústria:* ${currentInd}\n`;
    }
    if (order?.seller || shareSellerName || profile?.name) {
      message += `👤 *Vendedor:* ${order?.seller || shareSellerName || profile?.name}\n`;
    }
    message += `\n📦 *ITENS DO PEDIDO:*\n────────────────\n`;
    
    let totalSubtotal = 0;
    let totalFinalPrice = 0;

    enrichedItems.forEach((item, idx) => {
      const rowSubtotal = item.salePrice * item.quantity;
      const rowTotal = item.finalPrice * item.quantity;

      totalSubtotal += rowSubtotal;
      totalFinalPrice += rowTotal;

      message += `\n${idx + 1}. *${item.description}*\n`;
      if (item.discount > 0 && item.salePrice > item.finalPrice) {
        const discFormatted = item.discount.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        message += `   ${item.quantity} un × ~${formatCurrency(item.salePrice)}~ ${formatCurrency(item.finalPrice)} (-${discFormatted}%) = ${formatCurrency(rowTotal)}\n`;
      } else {
        message += `   ${item.quantity} un × ${formatCurrency(item.finalPrice)} = ${formatCurrency(rowTotal)}\n`;
      }
    });
    
    const totalDiscount = Math.max(0, totalSubtotal - totalFinalPrice);

    message += `\n────────────────\n`;
    message += `💵 Subtotal: ${formatCurrency(totalSubtotal)}\n`;
    if (totalDiscount > 0) {
      message += `🏷️ Desconto Total: -${formatCurrency(totalDiscount)}\n`;
    }
    message += `💰 *TOTAL A PAGAR: ${formatCurrency(totalFinalPrice)}*\n\n`;

    // Generate cart share URL so seller/rep can reopen this exact cart
    const cartShareUrl = generateCartShareLink(items);

    message += `🔗 *LINK PARA O VENDEDOR ABRIR E CONCLUIR PEDIDO:*\n${cartShareUrl}\n\n`;
    message += `✅ Olá! Montei meu pedido no catálogo. Abra o link acima para concluir para mim!`;

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
    if (cart.length === 0) return;

    // Immediately close offer modal and cart drawer so UI responds instantly
    setShowOfferSuggestions(false);
    setIsCartOpen(false);

    const enrichedCart = cart.map(item => enrichOrderItem(item, products));
    const cartTotalEnriched = enrichedCart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

    const finalClientName = profile?.role === 'promotor' 
      ? (manualClientName ? manualClientName.toUpperCase() : `PROMOTOR: ${profile.name}`) 
      : (selectedClient?.tradeName || selectedClient?.name || sharedClientName || manualClientName || 'Cliente');

    const orderData: Omit<Order, 'id'> = {
      date: new Date().toISOString(),
      clientId: selectedClient?.id || sharedClientId || 'CLIENTE_LINK',
      clientName: finalClientName,
      email: selectedClient?.email || profile?.email || '',
      seller: shareSellerName || profile?.name || 'Vendedor',
      phone: selectedClient?.phone || shareSellerPhone || profile?.phone || '',
      total: cartTotalEnriched,
      status: 'Novo',
      items: enrichedCart,
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
      setLastOrderItems(enrichedCart);
      setShowOrderSuccess(true);

      // If in shared link mode, mark link completed and start 1-hour expiration countdown
      if (currentLinkId) {
        dataService.markSharedLinkCompleted(currentLinkId).catch(err => console.error("Erro ao finalizar link:", err));
        setLinkCompletedAt(Date.now());
        setTimeRemaining(3600);
      }

      // Clean up current cart state immediately
      if (saveCartTimeoutRef.current) {
        clearTimeout(saveCartTimeoutRef.current);
      }
      lastSyncedCartRef.current = '[]';
      localStorage.setItem(cartKey, '[]');
      const targetClientId = selectedClient?.id || sharedClientId || 'PROMOTOR';
      if (profile) {
        dataService.deleteCart(profile.uid, targetClientId, selectedClient?.cnpj || sharedClientCnpj).catch(console.error);
      }

      setCart([]);
      setManualClientName('');
      setPendingCarts(prev => prev.filter(c => String(c.clientId) !== String(targetClientId)));

      // Generate PDF (Espelho do Pedido) automatically on checkout for everyone (including client via link)
      try {
        await generateOrderPDF(finalOrder, enrichedCart);
      } catch (pdfErr) {
        console.error('Erro ao gerar PDF espelho no checkout:', pdfErr);
      }

      // Generate Excel automatically on checkout only for internal users (sellers/reps/promoters)
      if (!isSharedLinkMode && profile?.role !== 'cliente' && profile) {
        // Small pause to ensure browser accepts consecutive downloads smoothly
        await new Promise(resolve => setTimeout(resolve, 350));

        try {
          await generateOrderExcel(finalOrder, enrichedCart);
        } catch (excelErr) {
          console.error('Erro ao gerar Excel no checkout:', excelErr);
        }
      }

      // If not promotor, open WhatsApp with a slight delay so downloads are not interrupted
      if (profile?.role !== 'promotor') {
        setTimeout(() => {
          sendToWhatsApp(finalOrder, enrichedCart);
        }, 600);
      }
      
      // For promotor, we might want to automatically reset after success modal or immediately
      if (profile?.role === 'promotor') {
        toast.info('Fluxo pronto para novo pedido.');
      }
    } catch (error) {
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        const firstError = (error as any).errors[0]?.message || 'Erro de validação';
        toast.error(`Falha na validação: ${firstError}`, { id: 'checkout' });
      } else {
        console.error('Checkout error:', error);
        toast.error('Erro ao registrar pedido', { id: 'checkout' });
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!selectedClient && profile?.role !== 'promotor' && !isSharedLinkMode && !sharedClientName) return;

    if (tabProductsMap.ofertas && tabProductsMap.ofertas.length > 0) {
      setShowOfferSuggestions(true);
    } else {
      await finalizeOrder();
    }
  };

  const handleAddBulkToCart = () => {
    const validItems = parsedBulkItems.filter(item => item && item.product && !item.error);
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
        const qtyToAdd = item.quantity;
        const existingIndex = newCart.findIndex(c => c.id === product.id);

        if (existingIndex > -1) {
          const newQty = newCart[existingIndex].quantity + qtyToAdd;
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

  if (!selectedClient && profile?.role !== 'promotor' && profile?.role !== 'cliente' && !isSharedLinkMode) {
    return <Navigate to="/" />;
  }

  // If shared order link has expired (1 hour after completion)
  if (isLinkExpired) {
    const rawPhone = (shareSellerPhone || profile?.phone || '5586999647573').replace(/\D/g, '');
    const finalPhone = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
    const whatsappLink = `https://wa.me/${finalPhone}?text=${encodeURIComponent('Olá! Tentei acessar o catálogo de produtos, mas o link do pedido expirou após 1 hora. Poderia me enviar um novo link atualizado?')}`;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 shadow-2xl space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
            <Clock size={40} className="animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-black uppercase tracking-wider">
              Acesso Expirado
            </span>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Link de Pedido Expirado
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Este link de pedido foi finalizado e expirou após o prazo de 1 hora por segurança e atualização de estoque.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80 text-left space-y-1">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Atendimento Comercial:</p>
            <p className="text-sm font-bold text-orange-400">{shareSellerName || 'Vendas HBN1'}</p>
            <p className="text-xs text-slate-400">Deseja realizar um novo pedido ou tirar dúvidas?</p>
          </div>

          <a 
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-green-950/40 transition-all cursor-pointer"
          >
            <MessageCircle size={20} />
            <span>Solicitar Novo Link no WhatsApp</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] pb-24 font-sans">
      <div ref={headerRef} className="sticky top-0 z-40 w-full shadow-sm">
        <header className="bg-brand-blue p-4 pt-safe border-b border-white/5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            {/* Left buttons - hidden in shared client link mode to prevent navigation to other clients */}
            {!isSharedLinkMode && profile && profile.role !== 'cliente' && (
              <>
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
                  title="Voltar aos clientes"
                >
                  <ChevronLeft size={24} />
                </motion.button>
              </>
            )}

            {!isSharedLinkMode && profile?.role === 'cliente' && (
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }} 
                className="p-2 bg-white/10 rounded-full text-white transition-colors"
                title="Sair da Conta"
              >
                <LogOut size={20} />
              </motion.button>
            )}
          
          {/* Star Logo */}
          <button 
            type="button"
            onClick={() => {
              if (profile && !profile.uid.startsWith('guest_') && profile.role !== 'cliente') {
                navigate('/');
              } else {
                navigate('/login');
              }
            }}
            className="w-8 h-8 bg-brand-orange text-white rounded-lg flex items-center justify-center p-1.5 shadow-md shadow-brand-orange/20 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="Página Inicial / Login"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
            </svg>
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-white font-display font-bold text-base leading-tight tracking-tight uppercase truncate">
              {isSharedLinkMode 
                ? (sharedClientName || selectedClient?.tradeName || selectedClient?.name || (activeIndustryFilter ? `Catálogo ${activeIndustryFilter}` : 'Catálogo de Produtos'))
                : (profile?.role === 'promotor' ? 'Catálogo Promotor' : (selectedClient?.tradeName || selectedClient?.name || profile?.name))}
            </h1>
            <p className="text-white/85 text-[10px] font-medium uppercase tracking-wider font-mono truncate">
              {isSharedLinkMode ? (
                <>
                  {activeIndustryFilter && <span className="text-amber-300 font-bold">{activeIndustryFilter} • </span>}
                  <span>Vendedor: {shareSellerName || 'Vendas HBN1'}</span>
                  {(sharedClientCnpj || selectedClient?.cnpj) && (
                    <span className="opacity-80"> • CNPJ: {sharedClientCnpj || selectedClient?.cnpj}</span>
                  )}
                </>
              ) : (
                profile?.role === 'promotor' 
                  ? getRegionalLabel(profile?.regional) 
                  : selectedClient?.cnpj 
                    ? `CNPJ: ${selectedClient.cnpj}` 
                    : `${selectedClient?.city || ''} • ${selectedClient?.id || ''}`
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin and Seller buttons */}
            {!isSharedLinkMode && profile && !profile.uid.startsWith('guest_') && profile.role !== 'cliente' && (
              <>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPendingCarts(true)} 
                  className={cn(
                    "p-2 bg-white/20 rounded-full text-white relative transition-all shadow-sm",
                    pendingCarts.length > 0 ? "animate-bounce" : "opacity-50"
                  )}
                  title="Carrinhos Pendentes"
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
                  onClick={() => {
                    if (selectedManufacturers.length > 0) {
                      setSelectedShareManufacturer(selectedManufacturers[0]);
                    }
                    setIsShareModalOpen(true);
                  }} 
                  className="p-2 bg-white/20 rounded-full text-white relative shadow-sm"
                  title="Gerar Link de Catálogo por Indústria para Cliente"
                >
                  <Share2 size={20} />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowQuickOrder(true)} 
                  className="p-2 bg-white/20 rounded-full text-white relative shadow-sm"
                  title="Pedido Rápido"
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
                  title="Histórico de Pedidos"
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
              </>
            )}

            {/* Login button for visitors / unauthenticated sessions */}
            {(!profile || profile.uid.startsWith('guest_')) && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')} 
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm border border-white/25 cursor-pointer whitespace-nowrap"
                title="Acessar com Login (Vendedor / Administrador)"
              >
                <LogIn size={16} />
                <span>Entrar</span>
              </motion.button>
            )}

            {/* Shopping Cart button - displays total order value */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)} 
              className="bg-white text-orange-600 px-3.5 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-md hover:bg-orange-50 transition-colors whitespace-nowrap cursor-pointer"
              title="Abrir Carrinho por Indústria"
            >
              <ShoppingCart size={18} className="shrink-0" />
              <span>{formatCurrency(cartTotal)}</span>
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
                {selectedManufacturers.length > 0 && !activeIndustryFilter && (
                  <button 
                    onClick={() => setSelectedManufacturers([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {activeIndustryFilter ? (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase tracking-wider">
                    <Lock size={12} /> Indústria Exclusiva
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 border border-gray-100 overflow-hidden shadow-sm shrink-0">
                      {getManufacturerLogo(activeIndustryFilter) ? (
                        <img 
                          src={getManufacturerLogo(activeIndustryFilter)!} 
                          alt={activeIndustryFilter} 
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <Building2 size={16} className="text-orange-600" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {activeIndustryFilter}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Catálogo restrito exclusivamente a esta indústria.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1.5">
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
              )}
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
              <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1.5">
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
              className="sticky z-20 bg-slate-50 dark:bg-[#121212] py-2.5 -mx-4 px-4 flex flex-col gap-3"
            >
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="search" 
                    placeholder="Buscar produto por nome, código ou descrição..." 
                    value={searchInputValue} 
                    onChange={(e) => setSearchInputValue(e.target.value)}
                    className={cn(
                      "w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-full py-3.5 pl-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all shadow-sm",
                      (search || searchInputValue) && !isSharedLinkMode ? "pr-24" : !isSharedLinkMode ? "pr-14" : (search || searchInputValue) ? "pr-12" : "pr-4"
                    )} 
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(search || searchInputValue) && (
                      <button 
                        type="button"
                        onClick={handleClearSearch}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        title="Limpar busca e ver todos os produtos"
                      >
                        <X size={16} />
                      </button>
                    )}
                    {!isSharedLinkMode && (
                      <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="p-2.5 bg-brand-orange/10 text-brand-orange rounded-full hover:bg-brand-orange/20 transition-colors"
                        title="Escanear Código de Barras"
                      >
                        <Camera size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsFilterOpen(true)}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3.5 rounded-full text-gray-600 dark:text-white flex items-center gap-2 shadow-sm relative cursor-pointer"
                  title="Filtros avançados"
                >
                  <SlidersHorizontal size={18} />
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0) && (
                    <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {selectedManufacturers.length + selectedCategories.length + statusFilters.length}
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Mobile quick brand selection list - shown unless filtered to single industry */}
              {!activeIndustryFilter && (
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
              )}

              <div className="flex gap-2 items-center flex-wrap">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={exportCatalogToPDF}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-orange-600 flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                  title="Baixar Catálogo em PDF"
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
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0 || search || priceRange[0] > 0 || priceRange[1] < 10000) && !isSharedLinkMode && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                        setSelectedManufacturers([]);
                        setSelectedCategories([]);
                        setStatusFilters([]);
                        setPriceRange([0, 10000]);
                        handleClearSearch();
                      }}
                      className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={12} /> Limpar Tudo
                    </motion.button>
                  )}
                  {search && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm border border-orange-200 dark:border-orange-800/60">
                      Busca: "{search}" <X size={12} className="cursor-pointer hover:text-red-500 transition-colors" onClick={handleClearSearch} />
                    </motion.div>
                  )}
                  {priceRange[0] > 0 || priceRange[1] < 10000 ? (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      De {formatCurrency(priceRange[0])} até {formatCurrency(priceRange[1])} <X size={12} className="cursor-pointer" onClick={() => setPriceRange([0, 10000])} />
                    </motion.div>
                  ) : null}
                  {selectedManufacturers.map(m => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={m} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {m} {!isSharedLinkMode && <X size={12} className="cursor-pointer" onClick={() => setSelectedManufacturers(prev => prev.filter(x => x !== m))} />}
                    </motion.div>
                  ))}
                  {selectedCategories.map(c => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={c} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {c} {!isSharedLinkMode && <X size={12} className="cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(x => x !== c))} />}
                    </motion.div>
                  ))}
                  {statusFilters.map(s => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={s} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {s === 'discount' ? 'Com Desconto' : s === 'no-discount' ? 'Sem Desconto' : s === 'in-stock' ? 'Em Estoque' : s === 'out-stock' ? 'Sem Estoque' : s === 'new' ? 'Lançamento' : 'Promocional'} 
                      {!isSharedLinkMode && <X size={12} className="cursor-pointer" onClick={() => setStatusFilters(prev => prev.filter(x => x !== s))} />}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <span className="text-[10px] font-bold text-gray-400 ml-auto">
                  Resultados: <b>{filteredProducts.length}</b> de {tabProductsMap[activeTab]?.length || 0}
                </span>
              </div>
            </div>

            {/* Active Industry & Filter Banner - Ultra Slim & Compact */}
            {(activeIndustryFilter || selectedManufacturers.length > 0 || statusFilters.length > 0 || (sortBy && sortBy !== 'default')) && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-1.5 mb-2.5 shadow-sm flex items-center justify-between gap-2 border border-orange-400/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-white flex items-center justify-center p-0.5 shadow-xs shrink-0">
                    {(activeIndustryFilter || selectedManufacturers[0]) && getManufacturerLogo(activeIndustryFilter || selectedManufacturers[0]) ? (
                      <img 
                        src={getManufacturerLogo(activeIndustryFilter || selectedManufacturers[0])!} 
                        alt={activeIndustryFilter || selectedManufacturers[0]} 
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-orange-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-xs font-black tracking-tight text-white truncate">
                      {activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : (selectedManufacturers.length > 1 ? selectedManufacturers.join(', ') : 'Catálogo Filtrado'))}
                    </span>
                    {(selectedClient?.tradeName || selectedClient?.name || sharedClientName) && (
                      <span className="text-[10px] text-orange-100 font-medium truncate hidden sm:inline">
                        • {selectedClient?.tradeName || selectedClient?.name || sharedClientName}
                      </span>
                    )}
                    {statusFilters.length > 0 && (
                      <span className="text-[10px] text-amber-200 font-bold truncate hidden md:inline">
                        • {statusFilters.map(s => s === 'discount' ? 'Com Desconto' : s === 'no-discount' ? 'Preço Regular' : s === 'in-stock' ? 'Em Estoque' : s === 'out-stock' ? 'Sem Estoque' : s === 'new' ? 'Lançamentos' : 'Promocionais').join(' • ')}
                      </span>
                    )}
                    {sortBy && sortBy !== 'default' && (
                      <span className="text-[10px] text-amber-200 font-medium truncate hidden lg:inline">
                        • {sortBy === 'discount' ? 'Maior Desconto' : sortBy === 'price-asc' ? 'Menor Preço' : sortBy === 'price-desc' ? 'Maior Preço' : sortBy === 'stock' ? 'Maior Estoque' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {!isSharedLinkMode ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleShareIndustryWhatsApp(activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : undefined), false)}
                      className="px-2 py-1 bg-white hover:bg-orange-50 text-orange-600 rounded-lg text-[11px] font-black shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Enviar Link com Filtros por WhatsApp"
                    >
                      <MessageCircle size={12} className="text-green-600 shrink-0" />
                      <span className="hidden xs:inline">WhatsApp</span>
                    </button>

                    <button
                      onClick={() => handleCopyIndustryLink(activeIndustryFilter || (selectedManufacturers.length === 1 ? selectedManufacturers[0] : undefined), false)}
                      className="px-2 py-1 bg-black/20 hover:bg-black/30 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Copiar Link com Filtros"
                    >
                      <Copy size={11} className="shrink-0" />
                      <span className="hidden sm:inline">Copiar</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedManufacturers([]);
                        setActiveIndustryFilter(null);
                        setStatusFilters([]);
                        setSortBy('default');
                        window.history.pushState({}, '', window.location.pathname);
                      }}
                      className="p-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs transition-all cursor-pointer ml-0.5"
                      title="Limpar Filtro da Barra"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-md">
                      Exclusivo
                    </span>
                    <span className="text-[9px] text-orange-100 hidden sm:inline">
                      Filtros selecionados pelo vendedor
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            <main className="w-full">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                  {[...Array(10)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm animate-pulse h-64" />)}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-500"><Package size={48} className="mx-auto mb-4" /><p>Nenhum produto encontrado.</p></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
                  {displayedProducts.map((p) => {
                    const cartItem = cart.find(item => item.id === p.id);
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        cartQuantity={cartItem?.quantity || 0}
                        isFavorite={isFavorite(p.id)}
                        isSold={soldProductIds.has(p.id)}
                        isHighlighted={highlightedProductId === p.id}
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
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg">🛒 Carts Pendentes</h3>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCarts.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        if (confirm("Tem certeza que deseja zerar TODOS os carrinhos pendentes?")) {
                          if (profile) {
                            toast.loading('Zerando todos os carrinhos...', { id: 'clear-all' });
                            await dataService.clearAllCarts(profile.uid);
                            setPendingCarts([]);
                            setCart([]);
                            if (cartKey) {
                              localStorage.setItem(cartKey, '[]');
                              localStorage.removeItem(cartKey);
                            }
                            toast.success('Todos os carrinhos foram zerados com sucesso!', { id: 'clear-all' });
                          }
                        }
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={13} /> Zerar Todos
                    </motion.button>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowPendingCarts(false)}
                    className="p-1 rounded-full text-white"
                  >
                    <X size={24} />
                  </motion.button>
                </div>
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
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {pCart.clientName}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {pCart.items.length} itens • {formatCurrency(pCart.items.reduce((sum, it) => sum + it.finalPrice * it.quantity, 0))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              if (profile) {
                                toast.loading(`Zerando carrinho de ${pCart.clientName}...`, { id: `del-cart-${pCart.clientId}` });
                                await dataService.deleteCart(profile.uid, pCart.clientId);
                                setPendingCarts(prev => prev.filter(c => String(c.clientId) !== String(pCart.clientId)));
                                if (selectedClient && String(selectedClient.id) === String(pCart.clientId)) {
                                  setCart([]);
                                  localStorage.setItem(cartKey, '[]');
                                  localStorage.removeItem(cartKey);
                                }
                                toast.success(`Carrinho zerado!`, { id: `del-cart-${pCart.clientId}` });
                              }
                            }}
                            className="bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 p-2 rounded-xl transition-colors"
                            title="Zerar este carrinho"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,107,0,1)" : "#fb923c") }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const client = allClients.find(c => c.id === pCart.clientId);
                              if (client) {
                                localStorage.setItem('selectedClient', JSON.stringify(client));
                                window.location.reload();
                              } else {
                                dataService.getClients(undefined, true).then(fullList => {
                                  const fullClient = fullList.find(c => c.id === pCart.clientId);
                                  if (fullClient) {
                                    localStorage.setItem('selectedClient', JSON.stringify(fullClient));
                                    window.location.reload();
                                  }
                                });
                              }
                            }}
                            className="bg-orange-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm transition-colors"
                          >
                            Ir
                          </motion.button>
                        </div>
                      </div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {pCart.items.slice(0, 5).map((item, idx) => (
                          <img 
                            key={idx} 
                            src={getProductImageUrl(item.photo, item.ean, item.manufacturer, item.description)} 
                            onError={(e) => handleImageError(e, item)}
                            className="inline-block h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-white object-contain" 
                            title={item.description} 
                          />
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
                  {tabProductsMap.ofertas.map((p) => {
                    const inCart = cart.find(item => item.id === p.id);
                    const wasSold = soldProductIds.has(p.id);
                    const hasStock = p.stock > 0;
                    
                    return (
                      <div key={p.id} className={cn(
                        "relative flex gap-4 p-4 bg-white dark:bg-[#1E1E1E] rounded-2xl border-2 transition-all group",
                        inCart ? "border-orange-500 bg-orange-50/20" : "border-transparent hover:border-gray-200"
                      )}>
                        <div className="w-20 h-20 bg-white rounded-xl overflow-hidden p-2 flex-none relative">
                          <img 
                            src={getProductImageUrl(p.photo, p.ean, p.manufacturer, p.description)} 
                            onError={(e) => handleImageError(e, p)}
                            className="w-full h-full object-contain" 
                            alt={p.description}
                          />
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
                          <QuantityControl
                            productId={p.id}
                            cartQuantity={inCart ? inCart.quantity : 0}
                            hasStock={hasStock}
                            onAddToCart={() => addToCart(p)}
                            onUpdateQuantity={updateQuantity}
                            onSetQuantityDirectly={setQuantityDirectly}
                            variant="list"
                          />
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
                    if (saveCartTimeoutRef.current) {
                      clearTimeout(saveCartTimeoutRef.current);
                    }
                    lastSyncedCartRef.current = '[]';
                    localStorage.setItem(cartKey, '[]');
                    const targetClientId = selectedClient?.id || 'PROMOTOR';
                    if (profile) {
                      dataService.deleteCart(profile.uid, targetClientId, selectedClient?.cnpj).catch(console.error);
                    }
                    setCart([]);
                    setManualClientName('');
                    setPendingCarts(prev => prev.filter(c => String(c.clientId) !== String(targetClientId)));
                    toast.success('Carrinho limpo.');
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
                    {/* Cart Items Grouped by Industry */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-orange-600 dark:text-orange-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Indústrias no Pedido ({cartByIndustry.length})
                          </span>
                        </div>
                        {cartByIndustry.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const allExpanded = cartByIndustry.every(g => expandedIndustries[g.manufacturer]);
                              if (allExpanded) {
                                setExpandedIndustries({});
                              } else {
                                const next: Record<string, boolean> = {};
                                cartByIndustry.forEach(g => { next[g.manufacturer] = true; });
                                setExpandedIndustries(next);
                              }
                            }}
                            className="text-[11px] font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                          >
                            {cartByIndustry.every(g => expandedIndustries[g.manufacturer]) ? 'Recolher todas' : 'Expandir todas'}
                          </button>
                        )}
                      </div>

                      {cartByIndustry.map((group) => {
                        const isExpanded = !!expandedIndustries[group.manufacturer];
                        const mfgLogo = getManufacturerLogo(group.manufacturer);

                        return (
                          <div 
                            key={group.manufacturer} 
                            className={cn(
                              "bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm border transition-all overflow-hidden",
                              isExpanded 
                                ? "border-orange-500/40 dark:border-orange-500/40 ring-1 ring-orange-500/20" 
                                : "border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-900/40"
                            )}
                          >
                            {/* Clickable Industry Header */}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedIndustries(prev => ({
                                  ...prev,
                                  [group.manufacturer]: !prev[group.manufacturer]
                                }));
                              }}
                              className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-orange-50/40 dark:hover:bg-orange-950/20 cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/30 flex items-center justify-center shrink-0 overflow-hidden p-1">
                                  {mfgLogo ? (
                                    <img 
                                      src={mfgLogo} 
                                      alt={group.manufacturer} 
                                      className="w-full h-full object-contain" 
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Building2 size={20} className="text-orange-600 dark:text-orange-400" />
                                  )}
                                </div>
                                
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider truncate">
                                    {group.manufacturer}
                                  </h4>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                    {group.items.length} {group.items.length === 1 ? 'item' : 'itens'} • {group.totalQuantity} un
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 ml-3">
                                <div className="text-right">
                                  <span className="text-sm font-black text-orange-600 dark:text-orange-400 block">
                                    {formatCurrency(group.total)}
                                  </span>
                                  {group.discount > 0 && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                                      Economia {formatCurrency(group.discount)}
                                    </span>
                                  )}
                                </div>
                                
                                <div className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-200 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
                                  isExpanded && "rotate-180 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                                )}>
                                  <ChevronDown size={16} />
                                </div>
                              </div>
                            </button>

                            {/* Collapsible Product List */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#161616]"
                                >
                                  <div className="p-3 space-y-2.5">
                                    {group.items.map((item, idx) => {
                                      const enriched = enrichOrderItem(item, products);
                                      let itemSale = Number(enriched.salePrice) || Number(item.salePrice) || 0;
                                      let itemFinal = Number(enriched.finalPrice) || Number(item.finalPrice) || 0;
                                      let itemDisc = Number(enriched.discount) || 0;

                                      if (itemFinal <= 0 || itemFinal >= itemSale || itemDisc <= 0 || itemDisc >= 100) {
                                        if (itemSale > 0) itemFinal = itemSale;
                                        if (itemFinal > 0 && itemSale <= 0) itemSale = itemFinal;
                                        itemDisc = 0;
                                      }

                                      const hasDiscount = itemDisc > 0 && itemSale > itemFinal;

                                      return (
                                        <div 
                                          key={`${item.id}-${idx}`} 
                                          className="bg-white dark:bg-[#1E1E1E] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800/80 flex gap-3 items-center"
                                        >
                                          <img 
                                            src={getProductImageUrl(item.photo, item.ean, item.manufacturer, item.description)} 
                                            alt={item.description}
                                            className="w-14 h-14 object-contain rounded-lg bg-white p-0.5 border border-gray-100 dark:border-gray-800 shrink-0" 
                                          />
                                          <div className="flex-1 min-w-0">
                                            <h5 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                                              {item.description}
                                            </h5>
                                            {item.ean && (
                                              <span className="text-[10px] text-gray-400 font-mono">
                                                EAN: {item.ean}
                                              </span>
                                            )}
                                            <div className="flex items-center justify-between mt-1.5">
                                              <div className="flex flex-col">
                                                {hasDiscount && (
                                                  <span className="text-[10px] text-gray-400 line-through">
                                                    {formatCurrency(itemSale)}
                                                  </span>
                                                )}
                                                <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400">
                                                  {formatCurrency(itemFinal)}
                                                </span>
                                              </div>
                                              <QuantityControl
                                                productId={item.id}
                                                cartQuantity={item.quantity}
                                                hasStock={true}
                                                onAddToCart={() => {}}
                                                onUpdateQuantity={updateQuantity}
                                                onSetQuantityDirectly={setQuantityDirectly}
                                                variant="drawer"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Industry subtotal footer bar */}
                                    <div className="pt-2 px-1 flex items-center justify-between text-xs border-t border-dashed border-gray-200 dark:border-gray-800">
                                      <span className="font-semibold text-gray-500 dark:text-gray-400 text-[11px]">
                                        Subtotal {group.manufacturer}:
                                      </span>
                                      <span className="font-black text-gray-900 dark:text-white">
                                        {formatCurrency(group.total)}
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-white dark:bg-[#1E1E1E] border-t border-gray-100 dark:border-gray-800 pb-safe">
                <div className="space-y-1 mb-4 text-xs font-medium">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {cartDiscount > 0 && (
                    <div className="flex justify-between text-green-600 font-bold">
                      <span>Descontos:</span>
                      <span>- {formatCurrency(cartDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Total a pagar:</span>
                    <span className="text-xl font-black text-orange-600">{formatCurrency(cartTotal)}</span>
                  </div>
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
                          await generateOrderPDF(orderData, cart);
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
                  <div className="space-y-2.5">
                    {/* Only show PDF/Excel buttons to internal logged-in sellers/promoters/admins, never to customers or shared link viewers */}
                    {!isSharedLinkMode && profile && profile.role !== 'cliente' && (
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={cart.length === 0}
                          onClick={async () => {
                            const orderData = {
                              id: 'PED_' + Date.now(),
                              date: new Date().toISOString(),
                              clientId: selectedClient?.id || 'CLIENTE',
                              clientName: selectedClient?.name || 'CLIENTE',
                              seller: profile?.name || 'VENDEDOR',
                              total: cartTotal,
                              sellerPhone: profile?.phone
                            };
                            await generateOrderPDF(orderData, cart);
                          }}
                          className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <FileText size={16} /> PDF
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={cart.length === 0}
                          onClick={async () => {
                            const orderData = {
                              id: 'PED_' + Date.now(),
                              date: new Date().toISOString(),
                              clientId: selectedClient?.id || 'CLIENTE',
                              clientName: selectedClient?.name || 'CLIENTE',
                              seller: profile?.name || 'VENDEDOR',
                              total: cartTotal,
                              sellerPhone: profile?.phone
                            };
                            await generateOrderExcel(orderData, cart);
                          }}
                          className="bg-green-50 hover:bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <FileSpreadsheet size={16} /> Excel
                        </motion.button>
                      </div>
                    )}

                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "#128C7E" }}
                      whileTap={{ scale: 0.98 }}
                      disabled={cart.length === 0 || isFinalizing} 
                      onClick={handleCheckout} 
                      className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isFinalizing ? <RefreshCw className="animate-spin" size={20} /> : <MessageCircle size={20} />}
                      <span className="font-black text-sm">{isFinalizing ? 'Finalizando...' : 'Finalizar Pedido'}</span>
                    </motion.button>

                    <button
                      disabled={cart.length === 0}
                      onClick={async () => {
                        const link = generateCartShareLink(cart);
                        const success = await safeCopyToClipboard(link);
                        if (success) {
                          toast.success('Link do pedido copiado com sucesso! Envie ao vendedor.');
                        } else {
                          toast.error('Não foi possível copiar o link automaticamente.');
                        }
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Copy size={16} />
                      <span>Copiar Link do Pedido para o Vendedor</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updatingImageProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800">
              <div className="p-5 border-b border-blue-500/20 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera size={18} className="text-blue-200" />
                    <h3 className="font-black text-lg">Atualizar Foto do Produto</h3>
                  </div>
                  <p className="text-[11px] text-blue-100 uppercase tracking-wider font-semibold truncate max-w-[340px] mt-0.5">{updatingImageProduct.description}</p>
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
              
              <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                {/* Preview and Current Linked URL Card */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 flex gap-4 items-center">
                  <div className="w-24 h-24 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 p-1 shadow-sm">
                    <img 
                      key={manualImageUrl || updatingImageProduct.photo || 'preview-modal'}
                      src={getProductImageUrl(manualImageUrl || updatingImageProduct.photo, updatingImageProduct.ean, updatingImageProduct.manufacturer, updatingImageProduct.description)} 
                      onError={(e) => handleImageError(e, { ...updatingImageProduct, photo: manualImageUrl || updatingImageProduct.photo })} 
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain" 
                      alt={updatingImageProduct.description}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 dark:text-gray-200 font-black uppercase">Foto Vinculada</span>
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                        (manualImageUrl || updatingImageProduct.photo) 
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" 
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      )}>
                        {(manualImageUrl || updatingImageProduct.photo) ? "Com Imagem" : "Sem Imagem"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-semibold mt-1">ID: <span className="font-mono text-gray-700 dark:text-gray-300 font-bold">{updatingImageProduct.id}</span> {updatingImageProduct.ean ? `• EAN: ${updatingImageProduct.ean}` : ''}</p>
                    
                    {updatingImageProduct.photo && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const success = await safeCopyToClipboard(updatingImageProduct.photo);
                            if (success) {
                              toast.success('Link copiado!');
                            } else {
                              toast.error('Não foi possível copiar o link.');
                            }
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Copiar link atual"
                        >
                          <Copy size={11} /> Copiar Link
                        </button>
                        <a
                          href={updatingImageProduct.photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
                          title="Abrir em nova aba"
                        >
                          <ExternalLink size={11} /> Abrir Link
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Link Input Form */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 size={13} className="text-blue-500" />
                      Link / URL Direta da Imagem
                    </label>
                    {manualImageUrl && (
                      <button 
                        type="button"
                        onClick={() => setManualImageUrl('')}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={11} /> Limpar Campo
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      value={manualImageUrl} 
                      onChange={(e) => setManualImageUrl(e.target.value)}
                      placeholder="Cole aqui o link direto da imagem (ex: https://... ou Google Drive)"
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-gray-800 dark:text-gray-200"
                    />
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUpdateImage(updatingImageProduct, manualImageUrl)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-xs font-black tracking-wide shadow-md transition-all cursor-pointer shrink-0"
                    >
                      SALVAR
                    </motion.button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    O link acima é sincronizado diretamente com a planilha e só é alterado quando você clica em <strong>SALVAR</strong>.
                  </p>
                </div>

                {/* Additional Search Options (Manual & Optional) */}
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Opções Adicionais de Busca (Opcional):</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.02, borderStyle: "solid", borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSearchImages(updatingImageProduct)}
                      disabled={searchingImages}
                      className="flex flex-col items-center gap-2 p-3.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group cursor-pointer"
                    >
                      <Sparkles className={cn("text-blue-500 group-hover:scale-110 transition-transform", searchingImages && "animate-spin")} size={22} />
                      <span className="text-[10px] font-black uppercase">Pesquisar com IA</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.02, borderStyle: "solid", borderColor: "#ea580c", backgroundColor: "rgba(234, 88, 12, 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(updatingImageProduct.description + ' ' + (updatingImageProduct.manufacturer || ''))}`, '_blank')}
                      className="flex flex-col items-center gap-2 p-3.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group cursor-pointer"
                    >
                      <Globe className="text-orange-500 group-hover:scale-110 transition-transform" size={22} />
                      <span className="text-[10px] font-black uppercase">Google Imagens</span>
                    </motion.button>
                  </div>
                </div>

                {searchingImages && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <RefreshCw className="animate-spin text-blue-500" size={28} />
                    <p className="text-xs font-bold text-gray-500">IA pesquisando sugestões de fotos...</p>
                  </div>
                )}

                {searchImages.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase ml-1">Sugestões Encontradas (Clique para carregar no campo):</p>
                    <div className="grid grid-cols-2 gap-3">
                      {searchImages.map((url, i) => (
                        <div 
                          key={i} 
                          className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer" 
                          onClick={() => {
                            setManualImageUrl(url);
                            toast.info('Link da foto carregado no campo. Clique em SALVAR para confirmar.');
                          }}
                        >
                          <img src={url} className="w-full h-full object-contain p-2" alt="Sugestão" />
                          <div className="absolute inset-0 bg-blue-600/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity p-2 text-center">
                            <span className="text-white font-black text-[10px] uppercase">Usar este Link</span>
                            <span className="text-white/80 text-[8px] mt-1">Carrega no campo</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <img 
                      src={getProductImageUrl(p.photo, p.ean, p.manufacturer, p.description)} 
                      onError={(e) => handleImageError(e, p)}
                      className="w-12 h-12 object-contain bg-white rounded-xl" 
                      alt={p.description}
                    />
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
                                src={getProductImageUrl(item.product.photo, item.product.ean, item.product.manufacturer, item.product.description)} 
                                onError={(e) => handleImageError(e, item.product)}
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
                                  {formatCurrency(item.product.finalPrice * item.quantity)}
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
          const key = getProductKey(selectedProductDetails);
          const currentTabPool = activeTab === 'ofertas' ? tabProductsMap.ofertas : (activeTab === 'lancamentos' ? tabProductsMap.lancamentos : tabProductsMap.produtos);
          const rawProduct = currentTabPool.find(p => getProductKey(p) === key) || tabProductsMap.produtos.find(p => getProductKey(p) === key) || tabProductsMap.ofertas.find(p => getProductKey(p) === key) || selectedProductDetails;
          let salePrice = Number(rawProduct.salePrice) || 0;
          let finalPrice = Number(rawProduct.finalPrice) || 0;
          let discountVal = Number(rawProduct.discount) || 0;

          if (discountVal >= 100 || discountVal < 0) {
            discountVal = 0;
          }

          if (finalPrice <= 0 || finalPrice >= salePrice || discountVal === 0) {
            if (salePrice > 0) finalPrice = salePrice;
            if (finalPrice > 0 && salePrice <= 0) salePrice = finalPrice;
            discountVal = 0;
          }

          if (salePrice > 0 && finalPrice > 0 && salePrice > finalPrice) {
            if (discountVal <= 0) {
              discountVal = Math.round(((salePrice - finalPrice) / salePrice) * 100 * 100) / 100;
            }
          } else {
            discountVal = 0;
            finalPrice = salePrice;
          }

          const product = {
            ...rawProduct,
            salePrice,
            finalPrice,
            discount: discountVal
          };

          const cartItem = cart.find(item => item.id === product.id);
          const cartQty = cartItem ? cartItem.quantity : 0;
          const hasStock = product.stock > 0;
          const economy = (salePrice > finalPrice && finalPrice > 0 && discountVal > 0 && discountVal < 100) ? salePrice - finalPrice : 0;
          const finalDiscount = (economy > 0.01 && discountVal > 0 && discountVal < 100) ? discountVal : 0;
          
          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-gray-100 dark:border-gray-800"
              >
                {/* Header Actions: Close Button */}
                <div className="absolute top-5 right-6 flex items-center gap-2 z-10">
                  <button 
                    onClick={() => setSelectedProductDetails(null)} 
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X size={20} />
                  </button>
                </div>

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
                        key={product.photo || `${product.id}-${product.ean}`}
                        src={getProductImageUrl(product.photo, product.ean, product.manufacturer, product.description)} 
                        alt={product.description} 
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:scale-105"
                        onError={(e) => handleImageError(e, product)}
                      />

                      {/* Zoom click */}
                      <button 
                        onClick={() => setSelectedImage(getProductImageUrl(product.photo, product.ean, product.manufacturer, product.description))}
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
                          "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer",
                          isFavorite(product.id)
                            ? "bg-red-50 dark:bg-red-950/10 text-red-600 border-red-200 dark:border-red-900/35"
                            : "bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/60 hover:bg-gray-100"
                        )}
                      >
                        <Star size={14} fill={isFavorite(product.id) ? "currentColor" : "none"} />
                        <span>{isFavorite(product.id) ? 'Favoritado' : 'Favoritos'}</span>
                      </button>

                      <button 
                        onClick={() => {
                          setImageShareProduct(product);
                          setIsImageShareModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/80 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                        title="Copiar informações como imagem para WhatsApp"
                      >
                        <Copy size={14} />
                        <span>Copiar Imagem</span>
                      </button>

                      {profile?.role === 'admin' && (
                        <button 
                          onClick={() => {
                            setSelectedProductDetails(null);
                            handleSetUpdatingImageProduct(product);
                          }}
                          className="flex items-center justify-center gap-1.5 p-2.5 bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Atualizar imagem do produto"
                        >
                          <Camera size={14} />
                          <span className="text-xs font-bold hidden sm:inline">Foto</span>
                        </button>
                      )}
                    </div>

                    {/* Last Purchase Info Card (Bottom Left) */}
                    {(() => {
                      const lastPurchase = (() => {
                        if (!product || !lastOrders || lastOrders.length === 0) return null;
                        const sorted = [...lastOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        for (const order of sorted) {
                          if (!order.items || !Array.isArray(order.items)) continue;
                          const found = order.items.find(i => 
                            (i.id && String(i.id).trim() === String(product.id).trim()) || 
                            (product.ean && i.ean && String(i.ean).trim() === String(product.ean).trim())
                          );
                          if (found && found.quantity > 0) {
                            const finalPrice = Number(found.finalPrice || 0) || Number(product.finalPrice || 0);
                            const itemSalePrice = Number(found.salePrice || 0);
                            
                            let discountPercent = Number(found.discount || 0);

                            if (discountPercent <= 0) {
                              if (itemSalePrice > finalPrice && itemSalePrice > 0) {
                                discountPercent = ((itemSalePrice - finalPrice) / itemSalePrice) * 100;
                              } else if (product.salePrice > finalPrice && product.salePrice > 0) {
                                discountPercent = ((product.salePrice - finalPrice) / product.salePrice) * 100;
                              } else if (product.discount > 0) {
                                discountPercent = product.discount;
                              }
                            }

                            const roundedDiscount = applyCustomRounding(discountPercent);

                            return {
                              date: order.date,
                              quantity: found.quantity,
                              price: finalPrice || itemSalePrice || product.finalPrice || 0,
                              salePrice: itemSalePrice || product.salePrice || finalPrice,
                              discountPercent: roundedDiscount,
                            };
                          }
                        }
                        return null;
                      })();

                      const formatDate = (dateStr: string) => {
                        try {
                          const d = new Date(dateStr);
                          if (isNaN(d.getTime())) return dateStr;
                          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        } catch (e) {
                          return dateStr;
                        }
                      };

                      if (lastPurchase) {
                        return (
                          <div className="bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3.5 rounded-2xl space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs">
                                <ShoppingBag size={15} className="text-blue-600 dark:text-blue-400" />
                                <span>Última Compra do Item</span>
                              </div>
                              <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                {lastPurchase.quantity} {lastPurchase.quantity === 1 ? 'unidade' : 'unidades'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-100 dark:border-blue-900/30">
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Data da Compra:</span>
                              <span className="font-extrabold text-gray-900 dark:text-gray-100">
                                {formatDate(lastPurchase.date)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Último Desconto:</span>
                              <span className="font-extrabold text-green-600 dark:text-green-400">
                                {lastPurchase.discountPercent > 0 
                                  ? `${lastPurchase.discountPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% OFF`
                                  : 'Sem desconto'}
                              </span>
                            </div>
                            {lastPurchase.price > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Preço Unitário Pago:</span>
                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(lastPurchase.price)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                            <ShoppingBag size={15} />
                            <span className="font-medium">Última Compra:</span>
                          </div>
                          <span className="font-bold text-gray-400 dark:text-gray-500 italic">
                            Nenhuma compra registrada
                          </span>
                        </div>
                      );
                    })()}
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
                          {hasStock ? `${product.stock.toLocaleString('pt-BR')} Em Estoque` : 'Sem Estoque'}
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
                        {finalDiscount > 0 && finalDiscount < 100 && economy > 0.01 && profile?.role !== 'promotor' ? (
                          <>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-sm sm:text-base font-bold text-gray-400 line-through">
                                De: {formatCurrency(product.salePrice)}
                              </span>
                              <span className="bg-red-500 text-white text-xs sm:text-base md:text-lg font-black px-3 py-1 rounded-full uppercase shadow-md tracking-wide">
                                {finalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}% OFF
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                                {formatCurrency(product.finalPrice)}
                              </span>
                              <span className="text-xs font-bold text-gray-500">
                                Preço Final
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-black">
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

                      {/* Button to Copy Product Offer as Image for WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          setImageShareProduct(product);
                          setIsImageShareModalOpen(true);
                        }}
                        className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/80 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <Copy size={15} className="text-orange-600 dark:text-orange-400" />
                        <span>Copiar Oferta como Imagem (WhatsApp)</span>
                      </button>
                    </div>

                    {/* Quantity controls & Add to Order action */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                      <QuantityControl
                        productId={product.id}
                        cartQuantity={cartQty}
                        hasStock={hasStock}
                        onAddToCart={() => addToCart(product)}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantityDirectly={setQuantityDirectly}
                        variant="modal"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <ProductImageShareModal
        isOpen={isImageShareModalOpen}
        onClose={() => setIsImageShareModalOpen(false)}
        product={imageShareProduct || selectedProductDetails}
        sellerName={profile?.name || shareSellerName || 'Vendas HBN1'}
        sellerPhone={profile?.phone || shareSellerPhone}
        getProductImageUrl={getProductImageUrl}
      />

      <AnimatePresence>
        {showOrderSuccess && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] w-full max-w-sm p-8 text-center space-y-6">
              <CheckCircle2 size={64} className="mx-auto text-green-500" />
              <h3 className="text-2xl font-black">Pedido Enviado com Sucesso!</h3>
              
              {/* Temporary Link Expiry Countdown Notice */}
              {isSharedLinkMode && timeRemaining > 0 && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
                  <Clock size={16} className="text-amber-600 animate-pulse shrink-0" />
                  {(() => {
                    const hours = Math.floor(timeRemaining / 3600);
                    const minutes = Math.floor((timeRemaining % 3600) / 60);
                    const seconds = timeRemaining % 60;
                    const formatted = hours > 0 
                      ? `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
                      : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    return <span>Link de pedido expira em: {formatted}</span>;
                  })()}
                </div>
              )}

              <div className="space-y-3">
                {profile?.role !== 'promotor' && (
                  <>
                    <motion.button 
                      whileHover={{ scale: 1.02 }} 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => sendToWhatsApp(lastOrder, lastOrderItems)} 
                      className="w-full flex items-center justify-between p-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg cursor-pointer"
                    >
                      <MessageCircle />
                      <span>Enviar Pedido via WhatsApp</span>
                      <ExternalLink />
                    </motion.button>

                    <button
                      onClick={async () => {
                        const link = generateCartShareLink(lastOrderItems);
                        const success = await safeCopyToClipboard(link);
                        if (success) {
                          toast.success('Link do pedido copiado com sucesso! Envie para o vendedor.');
                        } else {
                          toast.error('Não foi possível copiar o link automaticamente.');
                        }
                      }}
                      className="w-full flex items-center justify-between p-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl font-bold text-xs border border-gray-200 dark:border-gray-700 cursor-pointer"
                    >
                      <Copy size={18} />
                      <span>Copiar Link do Pedido</span>
                      <Link2 size={16} />
                    </button>

                    {(isSharedLinkMode || profile?.role === 'cliente') && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={() => generateOrderPDF(lastOrder, lastOrderItems)} 
                        className="w-full flex items-center justify-between p-3.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 rounded-2xl font-bold text-xs border border-orange-200 cursor-pointer"
                      >
                        <FileText size={18} />
                        <span>Baixar Espelho do Pedido (PDF)</span>
                        <Download size={16} />
                      </motion.button>
                    )}
                  </>
                )}
                {!isSharedLinkMode && profile && profile.role !== 'cliente' && (
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.02 }} 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => generateOrderPDF(lastOrder, lastOrderItems)} 
                      className="w-full flex items-center justify-center gap-2 p-3.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 rounded-2xl font-bold text-xs text-orange-700 dark:text-orange-300 border border-orange-200 cursor-pointer"
                    >
                      <FileText size={18} />
                      <span>Baixar PDF</span>
                      <Download size={16} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }} 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => generateOrderExcel(lastOrder, lastOrderItems)} 
                      className="w-full flex items-center justify-center gap-2 p-3.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 rounded-2xl font-bold text-xs text-green-700 dark:text-green-300 border border-green-200 cursor-pointer"
                    >
                      <FileSpreadsheet size={18} />
                      <span>Baixar Excel</span>
                      <Download size={16} />
                    </motion.button>
                  </div>
                )}
                
                {profile?.role !== 'promotor' && profile?.role !== 'cliente' && pendingCarts.length > 0 && (
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
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={async () => { 
                  setShowOrderSuccess(false); 
                  if (!isSharedLinkMode && profile && profile.role !== 'cliente') {
                    await setSelectedClient(null); 
                    navigate('/'); 
                  }
                }} 
                className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold transition-all shadow-md cursor-pointer"
              >
                {isSharedLinkMode || profile?.role === 'cliente' ? 'Concluir' : profile?.role === 'promotor' ? 'Novo Pedido' : 'Voltar aos Clientes'}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <button 
        type="button"
        id="floating-cart-button"
        onClick={() => setIsCartOpen(true)} 
        className={cn(
          "fixed bottom-6 right-6 z-40 bg-brand-orange hover:bg-brand-orange-light text-white shadow-2xl shadow-brand-orange/45 transition-all duration-200 active:scale-95 flex items-center gap-3",
          cartTotal > 0 
            ? "px-5 py-3 rounded-full" 
            : "w-14 h-14 rounded-full justify-center"
        )}
      >
        <div className="relative flex items-center justify-center">
          <ShoppingCart size={24} />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-brand-orange text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm">
              {cartCount}
            </span>
          )}
        </div>
        {cartTotal > 0 && (
          <div className="flex flex-col items-start leading-tight text-left">
            <span className="text-[9px] font-bold text-orange-100 uppercase tracking-wider">Ver Carrinho</span>
            <span className="text-sm sm:text-base font-black text-white">{formatCurrency(cartTotal)}</span>
          </div>
        )}
      </button>

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

      {/* Modal de Compartilhamento da Indústria para Cliente */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Share2 size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">Gerar Link do Catálogo</h3>
                    <p className="text-xs text-orange-100 font-medium">Envie o catálogo filtrado para seu cliente por WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Body */}
              <div className="p-6 space-y-5">
                {/* Select Industry */}
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                    Selecione a Indústria
                  </label>
                  <select
                    value={selectedShareManufacturer}
                    onChange={(e) => setSelectedShareManufacturer(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="TODAS">🌐 TODAS AS INDÚSTRIAS (Catálogo Completo)</option>
                    {manufacturers.map(m => (
                      <option key={m} value={m}>
                        🏭 {m} ({products.filter(p => p.manufacturer === m).length} itens)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Filters Toggle & Preview */}
                {(statusFilters.length > 0 || (sortBy && sortBy !== 'default') || selectedCategories.length > 0 || search.trim() || activeTab !== 'produtos') ? (
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FilterIcon size={16} className="text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">
                            Enviar apenas o que filtrei
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            O link enviado ao cliente carregará com os mesmos filtros e ordenação ativos
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={shareIncludeFilters}
                          onChange={(e) => setShareIncludeFilters(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    {shareIncludeFilters && (
                      <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/40 space-y-1.5">
                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                          Filtros inclusos no link:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {statusFilters.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-lg border border-amber-300/50">
                              {s === 'discount' ? '🏷️ Com Desconto' : s === 'in-stock' ? '✅ Em Estoque' : s === 'out-stock' ? '❌ Sem Estoque' : s === 'new' ? '🆕 Lançamentos' : s === 'promotional' ? '🔥 Promocionais' : s}
                            </span>
                          ))}
                          {sortBy && sortBy !== 'default' && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-lg border border-amber-300/50">
                              ↕️ {sortBy === 'discount' ? 'Maior Desconto' : sortBy === 'price-asc' ? 'Menor Preço' : sortBy === 'price-desc' ? 'Maior Preço' : sortBy === 'stock' ? 'Maior Estoque' : sortBy}
                            </span>
                          )}
                          {activeTab && activeTab !== 'produtos' && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-lg border border-amber-300/50">
                              📂 Aba: {activeTab === 'ofertas' ? 'Ofertas' : 'Lançamentos'}
                            </span>
                          )}
                          {selectedCategories.length > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-lg border border-amber-300/50">
                              📁 {selectedCategories.join(', ')}
                            </span>
                          )}
                          {search.trim() && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-lg border border-amber-300/50">
                              🔍 "{search.trim()}"
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>Nenhum filtro de status/ordenação ativo no momento.</span>
                  </div>
                )}

                {/* Seller Info */}
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                    Seu Nome (Identificação para o Cliente)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Leonel Amorim"
                    value={shareSellerName}
                    onChange={(e) => setShareSellerName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                {/* Generated Link Box */}
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                    Link Gerado
                  </label>
                  <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono font-bold text-orange-700 dark:text-orange-300 truncate">
                      {generateIndustryLink(selectedShareManufacturer, shareSellerName, true)}
                    </span>
                    <button
                      onClick={() => handleCopyIndustryLink(selectedShareManufacturer, true)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shrink-0 flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Copy size={12} /> Copiar
                    </button>
                  </div>
                </div>

                {/* Preview Box */}
                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Como o cliente receberá no WhatsApp:</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic bg-white dark:bg-[#1E1E1E] p-3 rounded-xl border border-gray-100 dark:border-gray-800 leading-relaxed whitespace-pre-line">
                    👋 Olá! Segue o nosso catálogo exclusivo {selectedShareManufacturer !== 'TODAS' ? `da indústria *${selectedShareManufacturer.toUpperCase()}*` : 'completo'}{selectedClient?.tradeName ? ` especial para *${selectedClient.tradeName.toUpperCase()}*` : ''}.
                    {getFilterSummaryList(selectedShareManufacturer, true).length > 0 && `\n🎯 *Seleção de Produtos:* ${getFilterSummaryList(selectedShareManufacturer, true).join(' • ')}`}
                    {`\n📲 Acesse o link abaixo para visualizar os produtos e montar o seu pedido diretamente:\n👉 `}
                    <span className="text-orange-600 font-bold underline break-all">{generateIndustryLink(selectedShareManufacturer, shareSellerName, true)}</span>
                    {`\n\nAo finalizar no carrinho, você me enviará o pedido por aqui mesmo! 🛍️`}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleShareIndustryWhatsApp(selectedShareManufacturer, true)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <MessageCircle size={18} />
                    <span>Enviar via WhatsApp</span>
                  </button>
                  <button
                    onClick={() => setIsShareModalOpen(false)}
                    className="px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl text-sm transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
