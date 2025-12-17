// Tipos do Dashboard baseados no Data Dictionary

export interface TinyOrder {
  order_id: string;
  order_date: string;
  order_time?: string;
  created_at: string;
  status: string;
  payment_status?: string;
  customer_id: string;
  customer_name: string;
  total_paid: number;
  discount: number;
  tax: number;
  freight_cost: number;
  net_revenue: number;
  items_count: number;
  sku_list: string[];
  product_name?: string;
  product_category: string;
  product_brand: string;
  sales_channel: string;
  payment_method: string;
  shipping_state: string;
  shipping_city: string;
  cep: string;
  delivery_promised_date?: string;
  delivery_actual_date?: string;
  delivery_status: string;
  returned_flag: boolean;
}

export interface OrderItem {
  sku: string;
  product_name: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface CustomerData {
  customer_id: string;
  customer_name: string;
  total_orders: number;
  total_spend: number;
  avg_ticket: number;
  items_count: number;
  avg_items_per_order: number;
  first_order_date: string;
  last_order_date: string;
  days_since_last_purchase: number;
  avg_days_between_purchases: number;
  is_active: boolean;
  cltv_3y: number;
  orders: TinyOrder[];
  products: ProductPurchase[];
  top_payment_method?: string;
}

export interface ProductPurchase {
  sku: string;
  product_name: string;
  qty_total: number;
  spend_total: number;
  last_purchase_date: string;
}

export interface ProductData {
  sku: string;
  product_name: string;
  total_qty: number;
  total_revenue: number;
  total_orders: number;
  last_sale_date: string;
  abc_class: 'A' | 'B' | 'C';
  days_without_sale: number;
  customers: string[];
  sales_by_weekday: number[];
  sales_by_monthday: number[];
  max_gap_without_sale: number;
}

export interface DashboardFilters {
  dateStart: Date;
  dateEnd: Date;
  salesChannel: string[];
  paymentMethod: string[];
  productCategory: string[];
  timeRange: { start: number; end: number };
  customerId: string | null;
  period: 'today' | 'mtd' | 'last30' | 'custom';
  granularity: 'daily' | 'weekly' | 'monthly';
}

export interface KPIData {
  total_revenue: number;
  total_orders: number;
  avg_ticket: number;
  unique_customers: number;
  prev_total_revenue: number;
  prev_total_orders: number;
  prev_avg_ticket: number;
  prev_unique_customers: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  items?: number;
}

export interface HeatmapData {
  day: number;
  hour?: number;
  value: number;
}

export interface CategoryDistribution {
  category: string;
  value: number;
  count: number;
}

// Funções utilitárias
export const normalizeChannel = (channel: string): string => {
  const normalized = channel?.toLowerCase().replace(/[-_\s]/g, '_') || 'unknown';
  const mappings: Record<string, string> = {
    'mp_a': 'marketplace_a',
    'mpa': 'marketplace_a',
    'marketplace-a': 'marketplace_a',
    'site': 'site',
    'loja': 'loja',
  };
  return mappings[normalized] || normalized;
};

export const normalizeStatus = (status: string): string => {
  const lower = status?.toLowerCase() || '';
  if (['cancelado', 'canceled', 'cancelled'].includes(lower)) {
    return 'cancelled';
  }
  if (['faturado', 'paid', 'confirmed'].includes(lower)) {
    return 'faturado';
  }
  return lower;
};

export const isValidOrder = (order: TinyOrder): boolean => {
  const status = normalizeStatus(order.status);
  return status === 'faturado' && order.total_paid > 0;
};

export const calculateNetRevenue = (order: TinyOrder): number => {
  return order.total_paid - (order.discount || 0) - (order.tax || 0) - (order.freight_cost || 0);
};

// Corrigido: parse de data brasileira DD/MM/YYYY
const parseBrazilianDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
};

export const calculateDaysSinceLastPurchase = (lastOrderDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = parseBrazilianDate(lastOrderDate);
  lastDate.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - lastDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

export const isActiveCustomer = (lastOrderDate: string): boolean => {
  return calculateDaysSinceLastPurchase(lastOrderDate) <= 60;
};

export const calculateCLTV3Y = (avgRevenuePerOrder: number, avgOrdersPerYear: number, margin = 0.30): number => {
  return avgRevenuePerOrder * avgOrdersPerYear * 3 * margin;
};

export const calculateAvgDaysBetweenPurchases = (orders: TinyOrder[]): number => {
  if (orders.length < 2) return 0;
  
  const sortedOrders = [...orders].sort((a, b) => 
    parseBrazilianDate(a.order_date).getTime() - parseBrazilianDate(b.order_date).getTime()
  );
  
  let totalDays = 0;
  let gaps = 0;
  
  for (let i = 1; i < sortedOrders.length; i++) {
    const prevDate = parseBrazilianDate(sortedOrders[i - 1].order_date);
    const currDate = parseBrazilianDate(sortedOrders[i].order_date);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      totalDays += diffDays;
      gaps++;
    }
  }
  
  return gaps > 0 ? Math.round(totalDays / gaps) : 0;
};
