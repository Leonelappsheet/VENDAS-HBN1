/**
 * Utility for resolving product photos and converting them to compressed Base64 JPEG strings
 * for PDF and Excel exports.
 */

export const getManufacturerLogo = (name: string): string | null => {
  if (!name) return null;
  const normName = name.trim().toLowerCase();

  if (normName.includes('danone') || normName.includes('aptamil') || normName.includes('milnutri') || normName.includes('fortini') || normName.includes('neocate')) {
    return 'https://logos-world.net/wp-content/uploads/2020/07/Danone-Logo-2013.png';
  }
  if (normName.includes('unilever') || normName.includes('dove') || normName.includes('rexona') || normName.includes('seda')) {
    return 'https://upload.wikimedia.org/wikipedia/pt/thumb/5/59/Logo_Unilever.svg/1920px-Logo_Unilever.svg.png';
  }
  if (normName.includes('kenvue') || normName.includes('johnson') || normName.includes('j&j') || normName.includes('carefree') || normName.includes('listerine') || normName.includes('neutrogena')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Kenvue_logo.svg';
  }
  if (normName.includes('kimberly') || normName.includes('huggies') || normName.includes('neve') || normName.includes('intimus') || normName.includes('plenitud')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Kimberly-Clark_logo.svg/1280px-Kimberly-Clark_logo.svg.png';
  }
  if (normName.includes('omron')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/OMRON_Logo.svg/3840px-OMRON_Logo.svg.png';
  }
  if (normName.includes('nestle') || normName.includes('nestlé') || normName.includes('ninho') || normName.includes('molico')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Nestl%C3%A9_text_logo.svg/1280px-Nestl%C3%A9_text_logo.svg.png';
  }
  if (normName.includes('bayer') || normName.includes('bepanthol') || normName.includes('redoxon')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Bayer_Logo.svg/1024px-Bayer_Logo.svg.png';
  }
  if (normName.includes('procter') || normName.includes('p&g') || normName.includes('pampers') || normName.includes('pantene') || normName.includes('gillette')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Procter_%26_Gamble_logo.svg/1200px-Procter_%26_Gamble_logo.svg.png';
  }
  if (normName.includes('loreal') || normName.includes('l\'oreal') || normName.includes('garnier')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/L%27Or%C3%A9al_logo.svg/1280px-L%27Or%C3%A9al_logo.svg.png';
  }
  if (normName.includes('sanofi') || normName.includes('medley') || normName.includes('dorflex')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Sanofi_logo.svg/1280px-Sanofi_logo.svg.png';
  }
  if (normName.includes('cimed') || normName.includes('lavitan')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Cimed_logo.png/640px-Cimed_logo.png';
  }
  if (normName.includes('hypera') || normName.includes('neo quimica') || normName.includes('mantecorp')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Hypera_Pharma_logo.svg/1280px-Hypera_Pharma_logo.svg.png';
  }
  if (normName.includes('eurofarma')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Eurofarma_logo.png/640px-Eurofarma_logo.png';
  }
  if (normName.includes('ems')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/EMS_S.A._logo.svg/1280px-EMS_S.A._logo.svg.png';
  }
  if (normName.includes('ache') || normName.includes('aché')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Ache_Laboratorios_logo.svg/1280px-Ache_Laboratorios_logo.svg.png';
  }
  if (normName.includes('reckitt') || normName.includes('rb')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Reckitt_logo.svg/1280px-Reckitt_logo.svg.png';
  }
  if (normName.includes('colgate') || normName.includes('palmolive')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Colgate-Palmolive_logo.svg/1280px-Colgate-Palmolive_logo.svg.png';
  }
  return null;
};

export const createCanvasFallbackImage = (
  text = 'PRODUTO',
  subText = 'VENDAS HBN1',
  targetWidth = 150,
  targetHeight = 150
): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Soft border
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(4, 4, targetWidth - 8, targetHeight - 8);

  // Title Text
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const shortText = text.length > 18 ? text.substring(0, 18) + '...' : text;
  ctx.fillText(shortText.toUpperCase(), targetWidth / 2, targetHeight / 2 - 8);

  // Subtitle / Brand
  ctx.fillStyle = '#FF6B00';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(subText.toUpperCase(), targetWidth / 2, targetHeight / 2 + 10);

  return canvas.toDataURL('image/jpeg', 0.85);
};

export const sanitizeImageUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url || url === '-' || url.toLowerCase() === 'sem foto' || url.toLowerCase() === 'sem_foto' || url.toLowerCase() === 'null' || url.toLowerCase() === 'undefined') {
    return '';
  }

  if (url.startsWith('data:image/')) return url;

  // Fix double schemas (e.g. https://https:// or http://https://)
  url = url.replace(/^(https?:\/\/)+https?:\/\//i, 'https://');
  url = url.replace(/^https?:\/\/https?:\/\//i, 'https://');

  // Next.js / Nuxt / Vercel / Drogaraia / Drogasil image optimization wrappers
  // e.g. https://www.drogaraia.com.br/_next/image?url=https%3A%2F%2Fproduct-data.raiadrogasil.io%2Fimages%2F20131359.webp&w=1200&q=75
  if (url.includes('_next/image') || url.includes('/_ipx/') || url.includes('/_image?')) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const targetParam = parsed.searchParams.get('url') || parsed.searchParams.get('src') || parsed.searchParams.get('img');
      if (targetParam) {
        let decoded = decodeURIComponent(targetParam);
        if (decoded.startsWith('/')) {
          decoded = `${parsed.origin}${decoded}`;
        }
        return sanitizeImageUrl(decoded);
      }
    } catch {
      const match = url.match(/[?&](?:url|src|img)=([^&]+)/i);
      if (match && match[1]) {
        return sanitizeImageUrl(decodeURIComponent(match[1]));
      }
    }
  }

  // Google Search / imgres wrapper
  if (url.includes('google.') && (url.includes('imgres') || url.includes('/url?'))) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const targetParam = parsed.searchParams.get('imgurl') || parsed.searchParams.get('url') || parsed.searchParams.get('q');
      if (targetParam && (targetParam.startsWith('http://') || targetParam.startsWith('https://'))) {
        return sanitizeImageUrl(decodeURIComponent(targetParam));
      }
    } catch {
      const match = url.match(/[?&](?:imgurl|url|q)=(https?%3A%2F%2F[^&]+|https?:\/\/[^&]+)/i);
      if (match && match[1]) {
        return sanitizeImageUrl(decodeURIComponent(match[1]));
      }
    }
  }

  // Bing wrapper
  if (url.includes('bing.com') && (url.includes('mediaurl=') || url.includes('imgurl='))) {
    try {
      const parsed = new URL(url);
      const targetParam = parsed.searchParams.get('mediaurl') || parsed.searchParams.get('imgurl');
      if (targetParam) {
        return sanitizeImageUrl(decodeURIComponent(targetParam));
      }
    } catch {}
  }

  // Google Drive URL conversion
  const driveMatch = url.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/uc\?(?:export=download&)?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  // Dropbox conversion
  if (url.includes('dropbox.com') && !url.includes('dl.dropboxusercontent.com')) {
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '?dl=1');
  }

  // Salsify Cloudinary-like transformation fix:
  // Strip /s--...--/c_limit.../ or /c_limit.../ so high-res original is fetched without 400 Bad Request
  if (url.includes('images.salsify.com')) {
    url = url.replace(/\/s--[^\/]+--\/c_limit[^/]+\//, '/');
    url = url.replace(/\/c_limit[^/]+\//, '/');
  }

  // HTTP mixed content -> proxy
  if (url.startsWith('http://')) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=80&bg=white&fit=contain&w=200&h=200`;
  }

  return url;
};

// Global in-memory cache to avoid re-downloading or re-converting image URLs
const imageCache = new Map<string, string | null>();

/**
 * Loads an image URL and converts it to a clean, square base64 JPEG string.
 * Supports fallback options (ean, description, manufacturer) to automatically recover broken images.
 */
export const getBase64Image = async (
  rawUrl?: string | null,
  targetWidth = 150,
  targetHeight = 150,
  fallbackOptions?: {
    ean?: string | number;
    description?: string;
    manufacturer?: string;
  }
): Promise<string | null> => {
  const url = sanitizeImageUrl(rawUrl);
  const cleanEan = fallbackOptions?.ean ? String(fallbackOptions.ean).replace(/\D/g, '') : '';
  const desc = fallbackOptions?.description || '';
  const mfg = fallbackOptions?.manufacturer || '';

  if (!url && !cleanEan && !desc) return null;

  // 0ms instant return from memory cache
  const cacheKey = `${url || cleanEan || desc}_${targetWidth}x${targetHeight}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) || null;
  }

  // If it's an SVG data URL, rasterize to JPEG canvas so jsPDF/Excel can draw it
  if (url && url.startsWith('data:image/svg')) {
    const svgResult: string | null = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

    if (svgResult) {
      imageCache.set(cacheKey, svgResult);
      return svgResult;
    }
  }

  // 0ms instant return if it's already a JPEG/PNG Data URL
  if (url && url.startsWith('data:image/')) {
    imageCache.set(cacheKey, url);
    return url;
  }

  const drawToCanvas = (img: HTMLImageElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const scale = Math.min(targetWidth / (img.width || targetWidth), targetHeight / (img.height || targetHeight));
      const w = (img.width || targetWidth) * scale;
      const h = (img.height || targetHeight) * scale;
      const x = (targetWidth - w) / 2;
      const y = (targetHeight - h) / 2;
      ctx.drawImage(img, x, y, w, h);

      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  };

  // Method 1: Fetch via local /api/proxy-image (bypasses CORS, referrer, hotlinks, and handles catalog fallbacks)
  const tryProxyFetch = async (): Promise<string | null> => {
    try {
      const params = new URLSearchParams();
      if (url) params.set('url', url);
      if (cleanEan) params.set('ean', cleanEan);
      if (desc) params.set('desc', desc);
      if (mfg) params.set('mfg', mfg);

      const response = await fetch(`/api/proxy-image?${params.toString()}`);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob || blob.size < 50) return null;

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          if (!dataUrl) return resolve(null);
          const img = new Image();
          img.onload = () => {
            const scaled = drawToCanvas(img);
            resolve(scaled || dataUrl);
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Method 2: Direct browser Image with crossOrigin="anonymous"
  const tryDirectLoad = async (targetUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timeoutId = setTimeout(() => {
        img.src = '';
        resolve(null);
      }, 2500);

      img.onload = () => {
        clearTimeout(timeoutId);
        const result = drawToCanvas(img);
        resolve(result);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(null);
      };

      img.src = targetUrl;
    });
  };

  // Execution Flow:
  // 1. First priority: Server proxy (bypasses CORS, provides reliable headers, searches catalog)
  let result = await tryProxyFetch();

  // 2. Direct browser load if proxy didn't resolve
  if (!result && url) {
    result = await tryDirectLoad(url);
  }

  // 3. Weserv fallback if external
  if (!result && url && !url.includes('images.weserv.nl')) {
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=80&fit=contain&w=${targetWidth}&h=${targetHeight}&bg=white`;
    result = await tryDirectLoad(weservUrl);
  }

  // Cache the result
  if (result) {
    imageCache.set(cacheKey, result);
  }
  return result;
};

/**
 * Normalizes EAN codes to strip leading zeroes / non-digits for flexible product matching.
 */
export const normalizeEANKey = (ean?: string | number): string => {
  if (!ean) return '';
  return String(ean).replace(/\D/g, '').replace(/^0+/, '');
};

/**
 * Pre-loads product thumbnail images in parallel for a list of items.
 * Accepts optional products catalog list to locate missing photo fields by EAN or product ID.
 */
export const preloadProductThumbnails = async (
  items: any[],
  productsList: any[] = []
): Promise<Record<string, string | null>> => {
  const imagesMap: Record<string, string | null> = {};

  // Build product lookup map by EAN and ID
  const productLookupByEan = new Map<string, any>();
  const productLookupById = new Map<string, any>();

  productsList.forEach((p) => {
    if (p.id) productLookupById.set(String(p.id).trim(), p);
    const normEan = normalizeEANKey(p.ean);
    if (normEan) productLookupByEan.set(normEan, p);
  });

  const fetchTasks: {
    item: any;
    photoUrl: string;
    cleanEan?: string;
    manufacturer: string;
    description: string;
    matchedProduct?: any;
  }[] = [];

  items.forEach((item) => {
    const normEan = normalizeEANKey(item.ean || item.product?.ean);
    const matched =
      (item.product?.id ? productLookupById.get(String(item.product.id).trim()) : null) ||
      (item.id ? productLookupById.get(String(item.id).trim()) : null) ||
      (normEan ? productLookupByEan.get(normEan) : null);

    // Look for photo in item or linked product
    let photoUrl = item.photo || item.imageUrl || item.image || item.product?.photo || matched?.photo || '';

    const rawEan = item.ean || item.product?.ean || matched?.ean;
    const cleanEan = rawEan ? String(rawEan).replace(/\D/g, '') : '';
    const manufacturer = item.manufacturer || item.product?.manufacturer || matched?.manufacturer || '';
    const description = item.description || item.product?.description || matched?.description || '';

    // If photoUrl is missing or invalid, treat as empty
    if (!photoUrl || photoUrl === '-' || photoUrl.toLowerCase() === 'sem foto' || photoUrl.toLowerCase() === 'sem_foto') {
      if (cleanEan && cleanEan.length >= 7) {
        photoUrl = `https://cdn-cosmos.bluesoft.com.br/products/${cleanEan}`;
      } else {
        const brandLogo = getManufacturerLogo(manufacturer || description);
        if (brandLogo) {
          photoUrl = brandLogo;
        } else {
          photoUrl = '';
        }
      }
    }

    fetchTasks.push({ item, photoUrl, cleanEan, manufacturer, description, matchedProduct: matched });
  });

  // Fetch in large parallel batches of 30 for high throughput
  const batchSize = 30;
  for (let i = 0; i < fetchTasks.length; i += batchSize) {
    const batch = fetchTasks.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ({ item, photoUrl, cleanEan, manufacturer, description, matchedProduct }) => {
        let base64 = await getBase64Image(photoUrl, 150, 150, {
          ean: cleanEan,
          description,
          manufacturer
        });

        // Fallback 1: Try Cosmos CDN if primary URL failed
        if (!base64 && cleanEan && cleanEan.length >= 7) {
          base64 = await getBase64Image(`https://cdn-cosmos.bluesoft.com.br/products/${cleanEan}`, 150, 150, {
            ean: cleanEan,
            description,
            manufacturer
          });
        }

        // Fallback 2: Try Open Food Facts CDN
        if (!base64 && cleanEan && cleanEan.length >= 7) {
          base64 = await getBase64Image(`https://images.openfoodfacts.org/images/products/${cleanEan}/1.jpg`, 150, 150);
        }

        // Fallback 3: Try Brand/Manufacturer Logo
        if (!base64) {
          const brandLogo = getManufacturerLogo(manufacturer || description);
          if (brandLogo) {
            base64 = await getBase64Image(brandLogo, 150, 150);
          }
        }

        // Fallback 4: Canvas generated badge with product title
        if (!base64) {
          base64 = createCanvasFallbackImage(description || 'PRODUTO', manufacturer || 'VENDAS HBN1');
        }

        if (base64) {
          // Store under all potential keys so any lookup method finds it
          const keys = [
            item.product?.id,
            item.id,
            String(item.id),
            item.ean,
            String(item.ean),
            item.product?.ean,
            item.code,
            item.description,
            item.product?.description,
            matchedProduct?.id,
            String(matchedProduct?.id),
            matchedProduct?.ean,
            String(matchedProduct?.ean),
            matchedProduct?.description
          ];
          keys.forEach((k) => {
            if (k !== undefined && k !== null && String(k).trim() !== '') {
              imagesMap[String(k)] = base64;
            }
          });
        }
      })
    );
  }

  return imagesMap;
};

