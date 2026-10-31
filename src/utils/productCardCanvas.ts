import { formatCurrency } from '../lib/utils';
import type { Product } from '../types';

export interface GenerateCardOptions {
  product: Product;
  sellerName?: string;
  sellerPhone?: string;
  imageUrl?: string;
}

/**
 * Helper to safely load an image for canvas drawing with CORS fallback
 */
export async function loadCanvasImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => {
      // If direct load fails (CORS), try loading through local proxy
      if (!url.includes('/api/proxy-image') && !url.startsWith('data:')) {
        const proxyImg = new Image();
        proxyImg.crossOrigin = 'anonymous';
        proxyImg.onload = () => resolve(proxyImg);
        proxyImg.onerror = () => resolve(null);
        proxyImg.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      } else {
        resolve(null);
      }
    };

    img.src = url;
  });
}

/**
 * Draws rounded rectangle path
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws wrapped text with max lines
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
): number {
  const words = text.split(' ');
  let line = '';
  let linesCount = 0;
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      linesCount++;
      if (linesCount >= maxLines) {
        ctx.fillText(line.trim() + '...', x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line.trim().length > 0) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

/**
 * Renders the product offer card onto an HTML5 Canvas and returns a Blob & Data URL
 */
export async function generateProductCardCanvas(
  options: GenerateCardOptions
): Promise<{ blob: Blob | null; dataUrl: string | null }> {
  const { product, sellerName, sellerPhone, imageUrl } = options;

  const width = 920;
  const height = 540;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: null, dataUrl: null };

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. White Background with rounded card border
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 0, 0, width, height, 32);
  ctx.fill();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, width - 2, height - 2, 32);
  ctx.stroke();

  // 2. Header
  // Logo Star Icon (Brand Orange)
  const starX = 35;
  const starY = 22;
  const starSize = 36;
  ctx.fillStyle = '#FF6B00';
  roundRect(ctx, starX, starY, starSize, starSize, 10);
  ctx.fill();

  // White star inside
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const cx = starX + starSize / 2;
  const cy = starY + starSize / 2;
  const spikes = 5;
  const outerRadius = 11;
  const innerRadius = 5.5;
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();

  // Header Titles
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NAZÁRIA DISTRIBUIDORA', starX + starSize + 12, starY + 16);

  ctx.fillStyle = '#EA580C';
  ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CATÁLOGO DE OFERTAS • VENDAS HBN1', starX + starSize + 12, starY + 31);

  // Top Badges (Right side)
  let badgeRightX = width - 35;
  const hasStock = (product.stock || 0) > 0;

  // Stock Badge
  const stockText = hasStock ? `${(product.stock || 0).toLocaleString('pt-BR')} Em Estoque` : 'Sem Estoque';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const stockWidth = ctx.measureText(stockText).width + 20;
  badgeRightX -= stockWidth;

  ctx.fillStyle = hasStock ? '#DCFCE7' : '#FEE2E2';
  roundRect(ctx, badgeRightX, 22, stockWidth, 32, 8);
  ctx.fill();
  ctx.strokeStyle = hasStock ? '#86EFAC' : '#FCA5A5';
  ctx.lineWidth = 1;
  roundRect(ctx, badgeRightX, 22, stockWidth, 32, 8);
  ctx.stroke();

  ctx.fillStyle = hasStock ? '#15803D' : '#DC2626';
  ctx.fillText(stockText, badgeRightX + 10, 42);

  // EAN Badge
  if (product.ean) {
    const eanText = `EAN: ${product.ean}`;
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const eanWidth = ctx.measureText(eanText).width + 18;
    badgeRightX -= (eanWidth + 8);

    ctx.fillStyle = '#F1F5F9';
    roundRect(ctx, badgeRightX, 22, eanWidth, 32, 8);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    roundRect(ctx, badgeRightX, 22, eanWidth, 32, 8);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillText(eanText, badgeRightX + 9, 42);
  }

  // ID Badge
  const idText = `ID: ${product.id}`;
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const idWidth = ctx.measureText(idText).width + 18;
  badgeRightX -= (idWidth + 8);

  ctx.fillStyle = '#F1F5F9';
  roundRect(ctx, badgeRightX, 22, idWidth, 32, 8);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  roundRect(ctx, badgeRightX, 22, idWidth, 32, 8);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.fillText(idText, badgeRightX + 9, 42);

  // Separator below header
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 68);
  ctx.lineTo(width - 35, 68);
  ctx.stroke();

  // 3. Product Image Card (Left Side)
  const imgBoxX = 35;
  const imgBoxY = 82;
  const imgBoxSize = 350;

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, 24);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, 24);
  ctx.stroke();

  // Draw product photo
  if (imageUrl) {
    const loadedImg = await loadCanvasImage(imageUrl);
    if (loadedImg && loadedImg.width > 0 && loadedImg.height > 0) {
      // Calculate aspect ratio containment
      const padding = 24;
      const targetW = imgBoxSize - padding * 2;
      const targetH = imgBoxSize - padding * 2;

      let drawW = targetW;
      let drawH = (loadedImg.height / loadedImg.width) * drawW;

      if (drawH > targetH) {
        drawH = targetH;
        drawW = (loadedImg.width / loadedImg.height) * drawH;
      }

      const drawX = imgBoxX + (imgBoxSize - drawW) / 2;
      const drawY = imgBoxY + (imgBoxSize - drawH) / 2;

      ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);
    }
  }

  // Type Badges on top of image
  if (product.type === 'offer') {
    ctx.fillStyle = '#EA580C';
    roundRect(ctx, imgBoxX + 14, imgBoxY + 14, 86, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('🔥 OFERTA', imgBoxX + 24, imgBoxY + 31);
  } else if (product.type === 'new') {
    ctx.fillStyle = '#9333EA';
    roundRect(ctx, imgBoxX + 14, imgBoxY + 14, 110, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✨ LANÇAMENTO', imgBoxX + 22, imgBoxY + 31);
  }

  // 4. Right Side - Title, Brand, Category, Prices
  const rightX = 415;
  let textY = 110;

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  textY = drawWrappedText(ctx, (product.description || 'PRODUTO').toUpperCase(), rightX, textY, 470, 28, 3);

  // Brand
  if (product.manufacturer) {
    ctx.fillStyle = '#64748B';
    ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`MARCA: ${product.manufacturer.toUpperCase()}`, rightX, textY + 6);
    textY += 20;
  }

  // Category
  if (product.category) {
    ctx.fillStyle = '#EA580C';
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Categoria: ${product.category}`, rightX, textY + 4);
    textY += 16;
  }

  // 5. Price Panel Box
  const salePrice = Number(product.salePrice) || 0;
  const finalPrice = Number(product.finalPrice) || 0;
  const discountVal = Number(product.discount) || 0;
  const hasDiscount = salePrice > finalPrice && finalPrice > 0 && discountVal > 0 && discountVal < 100;
  const economy = hasDiscount ? salePrice - finalPrice : 0;
  const finalDiscount = hasDiscount ? discountVal : 0;

  const priceBoxY = Math.max(textY + 16, 255);
  const priceBoxH = 175;
  const priceBoxW = 470;

  // Background
  ctx.fillStyle = '#FFF7ED';
  roundRect(ctx, rightX, priceBoxY, priceBoxW, priceBoxH, 24);
  ctx.fill();

  ctx.strokeStyle = '#FED7AA';
  ctx.lineWidth = 1.5;
  roundRect(ctx, rightX, priceBoxY, priceBoxW, priceBoxH, 24);
  ctx.stroke();

  if (hasDiscount) {
    // Row 1: "De: R$ 8,54" and "13,38% OFF" badge
    const deText = `De: ${formatCurrency(salePrice)}`;
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(deText, rightX + 22, priceBoxY + 36);

    // Strikethrough line
    const deWidth = ctx.measureText(deText).width;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rightX + 22, priceBoxY + 31);
    ctx.lineTo(rightX + 22 + deWidth, priceBoxY + 31);
    ctx.stroke();

    // Discount Pill
    const offText = `${finalDiscount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% OFF`;
    ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const offWidth = ctx.measureText(offText).width + 24;
    const offX = rightX + 22 + deWidth + 16;

    ctx.fillStyle = '#EF4444';
    roundRect(ctx, offX, priceBoxY + 16, offWidth, 30, 15);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(offText, offX + 12, priceBoxY + 36);

    // Row 2: Final Price and "Preço Final"
    const priceText = formatCurrency(finalPrice);
    ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.fillText(priceText, rightX + 22, priceBoxY + 95);

    const priceWidth = ctx.measureText(priceText).width;
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Preço Final', rightX + 22 + priceWidth + 12, priceBoxY + 91);

    // Row 3: "Você economiza: R$ X,XX por unidade"
    if (economy > 0.01) {
      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#15803D';
      ctx.fillText(`Você economiza: ${formatCurrency(economy)} por unidade`, rightX + 22, priceBoxY + 138);
    }
  } else {
    // Normal single price
    const priceText = formatCurrency(finalPrice);
    ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.fillText(priceText, rightX + 22, priceBoxY + 80);

    ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Preço Unitário', rightX + 22, priceBoxY + 115);
  }

  // 6. Footer (Discreet seller contact & validity)
  const footerY = height - 42;
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(35, footerY);
  ctx.lineTo(width - 35, footerY);
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const sellerText = sellerName ? `Vendedor: ${sellerName}${sellerPhone ? ` • ${sellerPhone}` : ''}` : 'Vendas HBN1';
  ctx.fillText(sellerText, 35, footerY + 24);

  const disclaimer = 'Oferta sujeita à disponibilidade de estoque';
  const discWidth = ctx.measureText(disclaimer).width;
  ctx.fillText(disclaimer, width - 35 - discWidth, footerY + 24);

  // Return PNG Blob and Data URL
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ blob, dataUrl });
      },
      'image/png',
      1.0
    );
  });
}
