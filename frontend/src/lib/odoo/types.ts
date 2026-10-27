/**
 * Tipos compartidos para el cliente JSON-RPC de Odoo.
 * Proyecto 309 — capa de datos (headless).
 */

/** Dominio Odoo: lista de condiciones y operadores lógicos. */
export type DomainOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'ilike' | 'in' | 'not in' | 'child_of' | 'parent_of';

export type DomainLeaf = [string, DomainOperator, unknown];

export type Domain = Array<DomainLeaf | '&' | '|' | '!' | Domain>;

/** Odoo devuelve los Many2one como [id, display_name] o false. */
export type Many2One = [number, string] | false;

export type OdooId = number;

export interface OdooRecord {
  id: OdooId;
  [field: string]: unknown;
}

export interface SearchReadOptions {
  domain?: Domain;
  fields?: string[];
  offset?: number;
  limit?: number;
  order?: string;
}

export interface OdooVersion {
  server_version: string;
  server_version_info: Array<string | number>;
  server_serie: string;
  protocol_version: number;
}

export interface OdooUser {
  id: OdooId;
  name: string;
  login: string;
  company_id: Many2One;
  company_name: string;
  lang: string;
}

/* ------------------------------ Inventario ------------------------------ */

export interface Product {
  id: OdooId;
  name: string;
  default_code: string | false;
  barcode: string | false;
  qty_available: number;
  virtual_available: number;
  free_qty: number;
  uom_id: Many2One;
  categ_id: Many2One;
  list_price: number;
  standard_price: number;
  type: string;
  detailed_type?: string;
}

export interface StockLocation {
  id: OdooId;
  complete_name: string;
  usage: 'view' | 'internal' | 'transit' | 'inventory' | 'customer' | 'supplier' | 'production';
  location_id: Many2One;
  warehouse_id?: Many2One;
}

export interface StockQuant {
  id: OdooId;
  product_id: Many2One;
  location_id: Many2One;
  quantity: number;
  reserved_quantity: number;
}

/* -------------------------------- Clientes ------------------------------- */

export interface Partner {
  id: OdooId;
  name: string;
  email: string | false;
  phone: string | false;
  mobile?: string | false;
  vat: string | false;
  street: string | false;
  city: string | false;
  country_id: Many2One;
  customer_rank: number;
  sale_order_count?: number;
  is_company: boolean;
}

export interface PartnerInput {
  name: string;
  email?: string;
  phone?: string;
  vat?: string;
  street?: string;
  city?: string;
  isCompany?: boolean;
}

/* --------------------------------- Ventas -------------------------------- */

export interface CartLine {
  productId: OdooId;
  quantity: number;
  /** Precio unitario sin impuestos. */
  unitPrice: number;
  /** Descripción override de la línea (por defecto el nombre del producto). */
  description?: string;
}

export interface SaleInput {
  partnerId: OdooId;
  lines: CartLine[];
  note?: string;
}

export interface Invoice extends OdooRecord {
  id: OdooId;
  name: string | false;
  state: 'draft' | 'posted' | 'cancel';
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  invoice_date: string | false;
  partner_id: Many2One;
  currency_id: Many2One;
}

export interface SaleOrder extends OdooRecord {
  id: OdooId;
  name: string;
  state: string;
  amount_total: number;
  partner_id: Many2One;
}
