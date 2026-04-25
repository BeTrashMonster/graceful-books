/**
 * CPG Quick Start Worksheet Types
 *
 * These types match the database schema for seamless data import
 */

export interface Category {
  id: string;
  name: string;
  variants: string[];
  sort_order: number;
}

export interface FinishedProduct {
  id: string;
  name: string;
  msrp: string;
  sku: string;
  category_id?: string;
  variant?: string;
}

export interface RecipeItem {
  category_id: string;
  variant?: string;
  quantity: string;
  unit: string;
}

export interface Recipe {
  product_id: string;
  items: RecipeItem[];
}

export interface InvoiceItem {
  category_id: string;
  variant?: string;
  quantity: string;
  unit: string;
  unit_cost: string;
}

export interface Invoice {
  id: string;
  vendor_name: string;
  invoice_date: string;
  invoice_number?: string;
  items: InvoiceItem[];
  notes?: string;
}

export interface WorksheetData {
  version: string;
  created_at: string;
  categories: Category[];
  finished_products: FinishedProduct[];
  recipes: Recipe[];
  invoices: Invoice[];
}

export type WizardStep = 'welcome' | 'categories' | 'products' | 'recipes' | 'invoices' | 'review';
