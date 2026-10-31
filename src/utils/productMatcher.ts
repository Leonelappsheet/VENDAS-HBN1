import { normalizeEAN } from '../lib/utils';

export interface MatchResult {
  product: any | null;
  score: number;
  isEanMatch?: boolean;
}

export function findBestMatchingProduct(rawSearchText: string, catalogProducts: any[]): MatchResult {
  if (!rawSearchText || !catalogProducts || catalogProducts.length === 0) {
    return { product: null, score: 0 };
  }

  // 1. Check if rawSearchText contains an 8 to 14 digit EAN or ID Code
  const digitsMatches = rawSearchText.match(/\b\d{8,14}\b/g);
  if (digitsMatches) {
    for (const rawCode of digitsMatches) {
      const norm = normalizeEAN(rawCode);
      if (norm) {
        const exact = catalogProducts.find(p => normalizeEAN(p.ean) === norm || String(p.id) === norm);
        if (exact) {
          return { product: exact, score: 100, isEanMatch: true };
        }
      }
    }
  }

  // 2. Normalize and tokenize text
  const cleanAndTokenize = (text: string) => {
    const cleaned = text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^A-Z0-9\s]/g, ' ')   // replace non-alphanumeric with space
      .replace(/\s+/g, ' ')
      .trim();
    
    // Common stop words to ignore during description matching
    const stopWords = new Set([
      'DE', 'DA', 'DO', 'DOS', 'DAS', 'COM', 'SEM', 'E', 'EM', 'PARA', 'OU', 
      'UN', 'UND', 'UNID', 'UNIDADE', 'C', 'CX', 'PCT', 'R', 'RS', 'KG', 'G', 
      'ML', 'L', 'O', 'A', 'N'
    ]);
    
    return cleaned.split(' ').filter(w => w.length >= 2 && !stopWords.has(w));
  };

  const queryTokens = cleanAndTokenize(rawSearchText);
  if (queryTokens.length === 0) {
    return { product: null, score: 0 };
  }

  let bestProduct: any = null;
  let bestScore = 0;

  for (const prod of catalogProducts) {
    const prodDesc = prod.description || '';
    const prodTokens = cleanAndTokenize(prodDesc);
    if (prodTokens.length === 0) continue;

    let matchedCount = 0;
    for (const qToken of queryTokens) {
      if (prodTokens.some(pToken => pToken === qToken || (qToken.length >= 4 && pToken.includes(qToken)) || (pToken.length >= 4 && qToken.includes(pToken)))) {
        matchedCount++;
      }
    }

    if (matchedCount === 0) continue;

    // Calculate match ratio based on query tokens matched
    const queryRatio = matchedCount / queryTokens.length;
    const prodRatio = matchedCount / prodTokens.length;
    
    // Score combines query token recall and precision
    const score = Math.round(((queryRatio * 0.75) + (prodRatio * 0.25)) * 100);

    if (score > bestScore) {
      bestScore = score;
      bestProduct = prod;
    }
  }

  // Require minimum score to propose a match
  if (bestProduct && bestScore >= 20) {
    return { product: bestProduct, score: Math.min(99, bestScore), isEanMatch: false };
  }

  return { product: null, score: 0 };
}
