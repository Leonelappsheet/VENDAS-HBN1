import { Client } from '../types';

export function formatCNPJ(val?: string): string {
  if (!val) return 'N/A';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return val;
}

export function findBestMatchingClient(
  cnpj?: string,
  clientName?: string,
  clients: Client[] = []
): Client | null {
  if (!clients || clients.length === 0) return null;

  const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : '';
  const cleanName = clientName ? clientName.trim().toLowerCase() : '';

  // 1. If CNPJ is provided, match strictly by CNPJ or ID first
  if (cleanCnpj && cleanCnpj.length >= 8) {
    const matchedByCnpj = clients.find(c => {
      const dbCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
      const dbId = c.id ? String(c.id).replace(/\D/g, '') : '';
      return (dbCnpj && dbCnpj === cleanCnpj) || (dbId && dbId === cleanCnpj);
    });
    if (matchedByCnpj) {
      return matchedByCnpj;
    }
    // CRITICAL: If a CNPJ was provided in the imported order, DO NOT match a DB client with a conflicting CNPJ!
  }

  // 2. Exact name or trade name match
  if (cleanName && cleanName !== 'cliente não identificado' && cleanName !== 'n/a') {
    const exactName = clients.find(c => {
      const dbName = (c.name || '').trim().toLowerCase();
      const dbTrade = (c.tradeName || '').trim().toLowerCase();
      
      const dbCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
      if (cleanCnpj && dbCnpj && cleanCnpj !== dbCnpj) return false;

      return dbName === cleanName || dbTrade === cleanName;
    });
    if (exactName) return exactName;

    // 3. Substring match for distinct names (excluding generic words)
    const genericWords = ['farma', 'drogaria', 'farmacia', 'loja', 'cliente', 'ltda', 'me', 'eireli', 'sa', 's/a', 'comercio'];
    const distinctiveWords = cleanName.split(/\s+/).filter(w => w.length > 2 && !genericWords.includes(w));

    if (distinctiveWords.length > 0) {
      const partialMatch = clients.find(c => {
        const dbName = (c.name || '').trim().toLowerCase();
        const dbTrade = (c.tradeName || '').trim().toLowerCase();
        
        const dbCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
        if (cleanCnpj && dbCnpj && cleanCnpj !== dbCnpj) return false;

        const matchesName = distinctiveWords.every(w => dbName.includes(w));
        const matchesTrade = distinctiveWords.every(w => dbTrade.includes(w));
        return matchesName || matchesTrade;
      });
      if (partialMatch) return partialMatch;
    }
  }

  return null;
}
