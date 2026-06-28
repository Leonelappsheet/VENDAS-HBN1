import { z } from 'zod';

export const ClientSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  tradeName: z.string().min(2, "Nome fantasia deve ter pelo menos 2 caracteres"),
  cnpj: z.string().min(14, "CNPJ inv\u00E1lido").max(18, "CNPJ inv\u00E1lido"),
  email: z.string().email("E-mail inv\u00E1lido").or(z.literal('')),
  phone: z.string().min(10, "Telefone inv\u00E1lido"),
  city: z.string().min(2, "Cidade \u00E9 obrigat\u00F3ria"),
  state: z.string().length(2, "Estado deve ter 2 d\u00EDgitos"),
  regional: z.string().min(1, "Regional \u00E9 obrigat\u00F3ria"),
});

export const OrderItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
  salePrice: z.number(),
  finalPrice: z.number(),
});

export const OrderSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  total: z.number().positive(),
  items: z.array(OrderItemSchema).min(1, "O pedido deve ter pelo menos um item"),
  status: z.enum(['Novo', 'Confirmado', 'Entregue', 'Cancelado', 'Rascunho']),
});
