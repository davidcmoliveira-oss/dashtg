import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TinyOrder,
  CustomerData,
  DashboardFilters,
  KPIData,
  normalizeChannel,
  normalizeStatus,
  isValidOrder,
  calculateNetRevenue,
  calculateDaysSinceLastPurchase,
  isActiveCustomer,
  calculateCLTV3Y,
  ProductPurchase,
} from "@/types/dashboard";

interface TinyOrderRaw {
  pedido: {
    id: number;
    numero: number;
    numero_ecommerce?: string;
    data_pedido: string;
    data_prevista?: string;
    nome: string;
    valor: number;
    id_vendedor?: number;
    nome_vendedor?: string;
    situacao: string;
    codigo_rastreamento?: string;
  };
}

const parseBrazilianDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
};

const formatDateToBrazilian = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const useDashboardData = () => {
  const [rawOrders, setRawOrders] = useState<TinyOrderRaw[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [filters, setFilters] = useState<DashboardFilters>({
    dateStart: new Date(),
    dateEnd: new Date(),
    salesChannel: [],
    paymentMethod: [],
    productCategory: [],
    timeRange: { start: 0, end: 24 },
    customerId: null,
    period: 'today',
    granularity: 'daily',
  });

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const fetchOrders = useCallback(async (dataInicial?: string, dataFinal?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const allOrders: TinyOrderRaw[] = [];
      let pagina = 1;
      let totalPaginas = 1;

      do {
        const { data, error: fnError } = await supabase.functions.invoke('tiny-orders', {
          body: { action: 'list', pagina, dataInicial, dataFinal },
        });

        if (fnError) throw new Error(fnError.message);
        if (data.error) throw new Error(data.error);

        allOrders.push(...(data.pedidos || []));
        totalPaginas = data.numero_paginas || 1;
        pagina++;
      } while (pagina <= totalPaginas && pagina <= 10); // Limitar a 10 páginas

      setRawOrders(allOrders);
      addLog(`Fetched ${allOrders.length} orders`);
      
      return allOrders;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar pedidos';
      setError(message);
      addLog(`Error: ${message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Transform raw orders to TinyOrder format
  const orders: TinyOrder[] = useMemo(() => {
    return rawOrders.map(item => {
      const pedido = item.pedido;
      const orderDate = pedido.data_pedido || '';
      const netRevenue = pedido.valor; // Simplificado, sem discount/tax/freight

      return {
        order_id: `ORD-${pedido.id}`,
        order_date: orderDate,
        created_at: orderDate,
        status: normalizeStatus(pedido.situacao),
        customer_id: pedido.nome, // Usando nome como ID temporário
        customer_name: pedido.nome || 'Cliente não informado',
        total_paid: pedido.valor || 0,
        discount: 0,
        tax: 0,
        freight_cost: 0,
        net_revenue: netRevenue,
        items_count: 1, // Fallback
        sku_list: [],
        product_category: 'Sem categoria',
        product_brand: 'Sem marca',
        sales_channel: normalizeChannel('site'),
        payment_method: 'Não informado',
        shipping_state: '',
        shipping_city: 'sem cidade',
        cep: '',
        delivery_status: '',
        returned_flag: false,
      };
    }).filter(order => {
      // Filtrar pedidos com data futura
      const orderDate = parseBrazilianDate(order.order_date);
      const today = new Date();
      if (orderDate > today) {
        addLog(`Order ${order.order_id} ignored: future date ${order.order_date}`);
        return false;
      }
      return true;
    });
  }, [rawOrders]);

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = parseBrazilianDate(order.order_date);
      
      // Date filter
      if (orderDate < filters.dateStart || orderDate > filters.dateEnd) {
        return false;
      }

      // Sales channel filter
      if (filters.salesChannel.length > 0 && !filters.salesChannel.includes(order.sales_channel)) {
        return false;
      }

      // Payment method filter
      if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(order.payment_method)) {
        return false;
      }

      // Category filter
      if (filters.productCategory.length > 0 && !filters.productCategory.includes(order.product_category)) {
        return false;
      }

      // Customer filter
      if (filters.customerId && order.customer_id !== filters.customerId) {
        return false;
      }

      return true;
    });
  }, [orders, filters]);

  // Calculate KPIs
  const kpis: KPIData = useMemo(() => {
    const validOrders = filteredOrders.filter(o => normalizeStatus(o.status) === 'faturado');
    
    const grossRevenue = validOrders.reduce((sum, o) => sum + o.total_paid, 0);
    const netRevenue = validOrders.reduce((sum, o) => sum + calculateNetRevenue(o), 0);
    const totalOrders = validOrders.length;
    const avgTicket = totalOrders > 0 ? netRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(validOrders.map(o => o.customer_id)).size;

    // Previous period comparison (placeholder - would need historical data)
    return {
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      total_orders: totalOrders,
      avg_ticket: avgTicket,
      unique_customers: uniqueCustomers,
      prev_gross_revenue: 0,
      prev_net_revenue: 0,
      prev_total_orders: 0,
      prev_avg_ticket: 0,
      prev_unique_customers: 0,
    };
  }, [filteredOrders]);

  // Aggregate customers
  const customers: CustomerData[] = useMemo(() => {
    const customerMap = new Map<string, {
      orders: TinyOrder[];
      productMap: Map<string, ProductPurchase>;
    }>();

    filteredOrders.forEach(order => {
      const existing = customerMap.get(order.customer_id);
      if (existing) {
        existing.orders.push(order);
      } else {
        customerMap.set(order.customer_id, {
          orders: [order],
          productMap: new Map(),
        });
      }
    });

    return Array.from(customerMap.entries()).map(([customerId, data]) => {
      const sortedOrders = data.orders.sort((a, b) => 
        parseBrazilianDate(b.order_date).getTime() - parseBrazilianDate(a.order_date).getTime()
      );

      const totalSpend = data.orders.reduce((sum, o) => sum + calculateNetRevenue(o), 0);
      const totalOrders = data.orders.length;
      const itemsCount = data.orders.reduce((sum, o) => sum + o.items_count, 0);
      const firstOrder = sortedOrders[sortedOrders.length - 1];
      const lastOrder = sortedOrders[0];

      const firstOrderDate = parseBrazilianDate(firstOrder.order_date);
      const lastOrderDate = parseBrazilianDate(lastOrder.order_date);
      const yearsSinceFirst = Math.max(1, (new Date().getTime() - firstOrderDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
      const ordersPerYear = totalOrders / yearsSinceFirst;

      return {
        customer_id: customerId,
        customer_name: lastOrder.customer_name,
        total_orders: totalOrders,
        total_spend: totalSpend,
        avg_ticket: totalOrders > 0 ? totalSpend / totalOrders : 0,
        items_count: itemsCount,
        avg_items_per_order: totalOrders > 0 ? itemsCount / totalOrders : 0,
        first_order_date: firstOrder.order_date,
        last_order_date: lastOrder.order_date,
        days_since_last_purchase: calculateDaysSinceLastPurchase(lastOrder.order_date),
        is_active: isActiveCustomer(lastOrder.order_date),
        cltv_3y: calculateCLTV3Y(totalSpend / totalOrders, ordersPerYear),
        orders: sortedOrders,
        products: Array.from(data.productMap.values()),
      };
    }).sort((a, b) => b.total_spend - a.total_spend);
  }, [filteredOrders]);

  // Time series data for charts
  const timeSeriesData = useMemo(() => {
    const dataMap = new Map<string, { value: number; items: number }>();
    
    filteredOrders.forEach(order => {
      const dateKey = order.order_date;
      const existing = dataMap.get(dateKey) || { value: 0, items: 0 };
      existing.value += calculateNetRevenue(order);
      existing.items += order.items_count;
      dataMap.set(dateKey, existing);
    });

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({
        date,
        value: data.value,
        items: data.items,
      }))
      .sort((a, b) => parseBrazilianDate(a.date).getTime() - parseBrazilianDate(b.date).getTime());
  }, [filteredOrders]);

  // Get unique values for filters
  const filterOptions = useMemo(() => ({
    salesChannels: [...new Set(orders.map(o => o.sales_channel))],
    paymentMethods: [...new Set(orders.map(o => o.payment_method))],
    categories: [...new Set(orders.map(o => o.product_category))],
    customers: [...new Set(orders.map(o => o.customer_name))],
  }), [orders]);

  return {
    orders: filteredOrders,
    allOrders: orders,
    customers,
    kpis,
    timeSeriesData,
    filterOptions,
    filters,
    setFilters,
    isLoading,
    error,
    logs,
    fetchOrders,
  };
};
