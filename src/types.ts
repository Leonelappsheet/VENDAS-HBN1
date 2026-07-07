export interface Product {
  id: string;
  ean: string;
  description: string;
  stock: number;
  salePrice: number;
  discount: number;
  finalPrice: number;
  category: string;
  manufacturer: string;
  photo: string;
  type: 'normal' | 'offer' | 'new';
  discountExpiryDate?: string | null;
}

export interface Client {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  seller: string;
  email: string;
  address: string;
  city: string;
  state: string;
  buyer: string;
  phone: string;
  regional: string;
  photo?: string;
}

export interface OrderItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  email: string;
  seller: string;
  phone: string;
  total: number;
  status: 'Novo' | 'Confirmado' | 'Entregue' | 'Cancelado' | 'Rascunho';
  items: OrderItem[];
  observation: string;
  pdfUrl?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  role: 'admin' | 'vendedor' | 'promotor';
  phone: string;
  email: string;
  regional: string;
}

export interface Favorite {
  clientId: string;
  productId: string;
  description: string;
  addedBy: string;
  dateAdded: string;
}

export interface Visit {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  timestamp: number;
  seller: string;
  latitude?: number;
  longitude?: number;
}

export interface BannerMessage {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  targetRegional?: string;
}
