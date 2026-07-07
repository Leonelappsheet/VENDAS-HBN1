export const REGIONALS = {
  'TIMON-MA': { id: '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs', label: 'TIMON - MA' },
  'THE': { id: '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs', label: 'TERESINA - PI' },
  'IMP': { id: '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs', label: 'IMPERATRIZ - MA' }
} as const;

export type RegionalKey = keyof typeof REGIONALS;

export const getSpreadsheetId = (regional?: string): string => {
  const getNormalizedKey = (r?: string): string => {
    if (!r) return 'TIMON-MA';
    const upper = r.toUpperCase();
    if (upper.includes('TIMON') || upper.includes('TIMAO')) return 'TIMON-MA';
    if (upper.includes('THE') || upper.includes('TERESINA')) return 'THE';
    if (upper.includes('IMP') || upper.includes('IMPERATRIZ')) return 'IMP';
    return 'TIMON-MA';
  };

  const normalized = getNormalizedKey(regional);
  
  try {
    const customId = localStorage.getItem(`CUSTOM_SPREADSHEET_ID_${normalized}`);
    if (customId && customId.trim()) {
      const trimmed = customId.trim();
      // Auto-cleanup old default spreadsheet IDs if they were stored in localStorage
      if (trimmed === '1I79E8X9b8O-g1wIc5fsKuO2DW9GCU24uZFkpTEQAcEk' || 
          trimmed === '1z2a_wzBrVPUEk8RrTEsIV9MsV9XBZQd9eZM6AwMwVyE') {
        console.log(`[Spreadsheet ID Migration] Cleared old default spreadsheet ID for ${normalized} from localStorage: ${trimmed}`);
        localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${normalized}`);
      } else {
        return trimmed;
      }
    }
  } catch (e) {
    console.warn('LocalStorage not available for custom spreadsheet ID', e);
  }
                     
  return REGIONALS[normalized as RegionalKey].id || REGIONALS['TIMON-MA'].id;
};

export const setCustomSpreadsheetId = (regional: string, id: string) => {
  const getNormalizedKey = (r?: string): string => {
    if (!r) return 'TIMON-MA';
    const upper = r.toUpperCase();
    if (upper.includes('TIMON') || upper.includes('TIMAO')) return 'TIMON-MA';
    if (upper.includes('THE') || upper.includes('TERESINA')) return 'THE';
    if (upper.includes('IMP') || upper.includes('IMPERATRIZ')) return 'IMP';
    return 'TIMON-MA';
  };

  const normalized = getNormalizedKey(regional);
  try {
    if (id && id.trim()) {
      localStorage.setItem(`CUSTOM_SPREADSHEET_ID_${normalized}`, id.trim());
    } else {
      localStorage.removeItem(`CUSTOM_SPREADSHEET_ID_${normalized}`);
    }
  } catch (e) {
    console.error('Error saving custom spreadsheet ID', e);
  }
};

export const getRegionalLabel = (regional?: string): string => {
  if (!regional) return REGIONALS['TIMON-MA'].label;
  
  const upper = regional.toUpperCase();
  if (upper.includes('TIMON') || upper.includes('TIMAO')) return REGIONALS['TIMON-MA'].label;
  if (upper.includes('THE') || upper.includes('TERESINA')) return REGIONALS['THE'].label;
  if (upper.includes('IMP') || upper.includes('IMPERATRIZ')) return REGIONALS['IMP'].label;
  
  return regional;
};
