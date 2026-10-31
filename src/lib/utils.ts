import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatCNPJ(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Returns the public shared base URL for the app.
 * If running on Google AI Studio development container (ais-dev-*), converts it to the public
 * shared production URL (ais-pre-*) so external clients, Safari and WhatsApp never hit the
 * developer authentication / cookie barrier ("Action required to load your app").
 */
export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace('-dev-', '-pre-');
}

/**
 * Universal safe clipboard writer with fallback for iframes and mobile webviews
 */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fallback below
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.setAttribute("readonly", "");
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn("safeCopyToClipboard fallback failed:", err);
    return false;
  }
}

/**
 * Copies a PNG or JPEG image blob to system clipboard
 */
export async function copyImageBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn("copyImageBlobToClipboard failed:", err);
  }
  return false;
}

/**
 * Converts any image URL (even remote) to an in-memory base64 data URL to avoid CORS taints
 */
export async function urlToDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  
  try {
    // Try direct fetch first
    let res = await fetch(url, { mode: 'cors' }).catch(() => null);
    
    // Fallback through proxy-image if blocked
    if (!res || !res.ok) {
      res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`).catch(() => null);
    }
    
    if (res && res.ok) {
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string || url);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn('urlToDataUrl conversion error:', e);
  }
  return url;
}

/**
 * Flexibly parses any numeric value from Google Sheets or files into a number.
 * Correctly handles:
 * - Numbers already typed as numbers: 18.84, 18, 0
 * - Portuguese / BR currency & percentage strings: "R$ 18,84", "13,00%", "R$ 1.234,56"
 * - US formatted strings: "R$ 18.84", "13.00%", "$1,234.56"
 * - Strings with non-breaking spaces or currency symbols
 * - Commas vs dots as decimal separators
 */
export function parseFlexibleNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let s = String(val).trim();
  if (!s) return 0;

  // Remove currency signs (R$, $, €, BRL), %, quotes, spaces, non-breaking spaces
  s = s.replace(/R\$/gi, '')
       .replace(/\$/g, '')
       .replace(/€/g, '')
       .replace(/BRL/gi, '')
       .replace(/%/g, '')
       .replace(/["']/g, '')
       .replace(/\u00A0/g, ' ')
       .trim();

  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // e.g. 1.234,56 (BR format)
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. 1,234.56 (US format)
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma present. In Portuguese / BRL, comma is ALWAYS the decimal separator for prices & discounts.
    // e.g. "103,15", "103,150", "0,00", "13,50", "1234,56"
    s = s.replace(/\s+/g, '').replace(',', '.');
  } else if (hasDot) {
    // Only dot present.
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // e.g. 1.234.567 (multiple dots = thousands)
      s = s.replace(/\./g, '');
    }
    // Single dot (e.g. "103.15", "103.150", "1234.56", "0.00") is standard decimal format
  }

  // Keep digits, minus sign, and dot
  s = s.replace(/[^\d.-]/g, '');

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Specifically parses integer inventory / stock counts.
 * Correctly handles:
 * - Numbers: 29584, 29, 0
 * - Thousands formatted strings: "29.584", "29,584", "29.800", "29.000", "1.500"
 * - Decimals with trailing zeros: "29.584,00", "29,584.00", "29.00"
 */
export function parseStockNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);

  let s = String(val).trim();
  if (!s) return 0;

  // Remove currency symbols, %, quotes, non-breaking spaces
  s = s.replace(/R\$/gi, '')
       .replace(/\$/g, '')
       .replace(/€/g, '')
       .replace(/%/g, '')
       .replace(/["']/g, '')
       .replace(/\u00A0/g, ' ')
       .trim();

  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // e.g. 1.234,56 or 29.584,00 (BR format) -> strip dots, replace comma with dot
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. 1,234.56 or 29,584.00 (US format) -> strip commas
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaParts = s.split(',');
    if (commaParts.length === 2 && commaParts[1].length === 3) {
      // e.g. "29,584" (thousands separator)
      s = s.replace(',', '');
    } else {
      // e.g. "29,00" or "29,0"
      s = s.replace(',', '.');
    }
  } else if (hasDot) {
    const dotParts = s.split('.');
    if (dotParts.length > 2) {
      // e.g. "1.234.567"
      s = s.replace(/\./g, '');
    } else if (dotParts.length === 2) {
      // e.g. "29.584" or "1.500" or "29.00"
      if (dotParts[1].length === 3) {
        // 3 digits after dot -> thousands separator! e.g. "29.584" -> 29584
        s = s.replace('.', '');
      }
    }
  }

  // Keep digits, minus sign, and dot
  s = s.replace(/[^\d.-]/g, '');

  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.round(num);
}

export function normalizeEAN(ean: any): string {
  if (ean === null || ean === undefined) return '';
  // Convert to string and trim
  let s = String(ean).trim();
  // Remove any non-numeric characters
  s = s.replace(/[^0-9]/g, '');
  if (!s) return '';
  // If the EAN has length > 0 and less than 13, pad with leading zeros to 13 digits
  if (s.length > 0 && s.length < 13) {
    s = s.padStart(13, '0');
  }
  return s;
}
