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
