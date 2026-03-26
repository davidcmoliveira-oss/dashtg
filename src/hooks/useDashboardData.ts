import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TinyOrder,
  CustomerData,
  DashboardFilters,
  KPIData,
  ProductData,
  normalizeChannel,
  normalizeStatus,
  calculateDaysSinceLastPurchase,
  isActiveCustomer,
  calculateCLTV3Y,
  calculateAvgDaysBetweenPurchases,
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

  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    return {
      dateStart: thirtyDaysAgo,
      dateEnd: today,
      salesChannel: [],
      paymentMethod: [],
      productCategory: [],
      timeRange: { start: 0, end: 24 },
      customerId: null,
      period: 'last30',
      granularity: 'daily',
    };
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
        addLog(`Fetching page ${pagina}/${totalPaginas}...`);
        const { data, error: fnError } = await supabase.functions.invoke('tiny-orders', {
          body: { action: 'list', pagina, dataInicial, dataFinal },
        });

        if (fnError) throw new Error(fnError.message);
        if (data.error) throw new Error(data.error);

        allOrders.push(...(data.pedidos || []));
        totalPaginas = parseInt(data.numero_paginas) || 1;
        pagina++;
      } while (pagina <= totalPaginas);

      setRawOrders(allOrders);
      addLog(`Fetched ${allOrders.length} orders across ${totalPaginas} pages`);
      
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

      return {
        order_id: `ORD-${pedido.id}`,
        order_date: orderDate,
        order_time: '12:00', // Fallback - API não retorna horário
        created_at: orderDate,
        status: normalizeStatus(pedido.situacao),
        customer_id: pedido.nome,
        customer_name: pedido.nome || 'Cliente não informado',
        total_paid: pedido.valor || 0,
        discount: 0,
        tax: 0,
        freight_cost: 0,
        net_revenue: pedido.valor || 0,
        items_count: 1,
        sku_list: [],
        product_name: `Produto ${pedido.id}`,
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
      
      if (orderDate < filters.dateStart || orderDate > filters.dateEnd) {
        return false;
      }

      if (filters.salesChannel.length > 0 && !filters.salesChannel.includes(order.sales_channel)) {
        return false;
      }

      if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(order.payment_method)) {
        return false;
      }

      if (filters.productCategory.length > 0 && !filters.productCategory.includes(order.product_category)) {
        return false;
      }

      if (filters.customerId && order.customer_id !== filters.customerId) {
        return false;
      }

      return true;
    });
  }, [orders, filters]);

  // Calculate KPIs - Usando apenas total_paid
  const kpis: KPIData = useMemo(() => {
    const validOrders = filteredOrders.filter(o => normalizeStatus(o.status) === 'faturado');
    
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total_paid, 0);
    const totalOrders = validOrders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(validOrders.map(o => o.customer_id)).size;

    return {
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      avg_ticket: avgTicket,
      unique_customers: uniqueCustomers,
      prev_total_revenue: 0,
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
      paymentMethods: Map<string, number>;
    }>();

    filteredOrders.forEach(order => {
      const existing = customerMap.get(order.customer_id);
      if (existing) {
        existing.orders.push(order);
        // Contar métodos de pagamento
        const pmCount = existing.paymentMethods.get(order.payment_method) || 0;
        existing.paymentMethods.set(order.payment_method, pmCount + 1);
      } else {
        const paymentMethods = new Map<string, number>();
        paymentMethods.set(order.payment_method, 1);
        customerMap.set(order.customer_id, {
          orders: [order],
          productMap: new Map(),
          paymentMethods,
        });
      }
    });

    return Array.from(customerMap.entries()).map(([customerId, data]) => {
      const sortedOrders = data.orders.sort((a, b) => 
        parseBrazilianDate(b.order_date).getTime() - parseBrazilianDate(a.order_date).getTime()
      );

      const totalSpend = data.orders.reduce((sum, o) => sum + o.total_paid, 0);
      const totalOrders = data.orders.length;
      const itemsCount = data.orders.reduce((sum, o) => sum + o.items_count, 0);
      const firstOrder = sortedOrders[sortedOrders.length - 1];
      const lastOrder = sortedOrders[0];

      const firstOrderDate = parseBrazilianDate(firstOrder.order_date);
      const yearsSinceFirst = Math.max(1, (new Date().getTime() - firstOrderDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
      const ordersPerYear = totalOrders / yearsSinceFirst;

      // Encontrar método de pagamento mais usado
      let topPaymentMethod = 'Não informado';
      let maxCount = 0;
      data.paymentMethods.forEach((count, method) => {
        if (count > maxCount) {
          maxCount = count;
          topPaymentMethod = method;
        }
      });

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
        avg_days_between_purchases: calculateAvgDaysBetweenPurchases(data.orders),
        is_active: isActiveCustomer(lastOrder.order_date),
        cltv_3y: calculateCLTV3Y(totalSpend / totalOrders, ordersPerYear),
        orders: sortedOrders,
        products: Array.from(data.productMap.values()),
        top_payment_method: topPaymentMethod,
      };
    }).sort((a, b) => b.total_spend - a.total_spend);
  }, [filteredOrders]);

  // Products data for Products view
  const products: ProductData[] = useMemo(() => {
    const productMap = new Map<string, {
      name: string;
      qty: number;
      revenue: number;
      orders: number;
      lastSale: string;
      customers: Set<string>;
      weekdaySales: number[];
      monthdaySales: number[];
      saleDates: Date[];
    }>();

    filteredOrders.forEach(order => {
      const productKey = order.product_name || `Produto ${order.order_id}`;
      const existing = productMap.get(productKey);
      const orderDate = parseBrazilianDate(order.order_date);
      
      if (existing) {
        existing.qty += order.items_count;
        existing.revenue += order.total_paid;
        existing.orders++;
        existing.customers.add(order.customer_id);
        existing.weekdaySales[orderDate.getDay()]++;
        existing.monthdaySales[orderDate.getDate() - 1]++;
        existing.saleDates.push(orderDate);
        if (parseBrazilianDate(existing.lastSale) < orderDate) {
          existing.lastSale = order.order_date;
        }
      } else {
        const weekdaySales = Array(7).fill(0);
        const monthdaySales = Array(31).fill(0);
        weekdaySales[orderDate.getDay()] = 1;
        monthdaySales[orderDate.getDate() - 1] = 1;
        
        productMap.set(productKey, {
          name: productKey,
          qty: order.items_count,
          revenue: order.total_paid,
          orders: 1,
          lastSale: order.order_date,
          customers: new Set([order.customer_id]),
          weekdaySales,
          monthdaySales,
          saleDates: [orderDate],
        });
      }
    });

    // Calculate ABC classification
    const productsList = Array.from(productMap.entries())
      .map(([sku, data]) => ({
        sku,
        ...data,
        customersArray: Array.from(data.customers),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = productsList.reduce((sum, p) => sum + p.revenue, 0);
    let cumulativeRevenue = 0;

    return productsList.map(p => {
      cumulativeRevenue += p.revenue;
      const cumulativePercent = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;
      
      let abcClass: 'A' | 'B' | 'C' = 'C';
      if (cumulativePercent <= 80) abcClass = 'A';
      else if (cumulativePercent <= 95) abcClass = 'B';

      // Calculate max gap without sale
      const sortedDates = [...p.saleDates].sort((a, b) => a.getTime() - b.getTime());
      let maxGap = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        const gap = Math.floor((sortedDates[i].getTime() - sortedDates[i-1].getTime()) / (1000 * 60 * 60 * 24));
        if (gap > maxGap) maxGap = gap;
      }

      const today = new Date();
      const lastSaleDate = parseBrazilianDate(p.lastSale);
      const daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        sku: p.sku,
        product_name: p.name,
        total_qty: p.qty,
        total_revenue: p.revenue,
        total_orders: p.orders,
        last_sale_date: p.lastSale,
        abc_class: abcClass,
        days_without_sale: daysSinceLastSale,
        customers: p.customersArray,
        sales_by_weekday: p.weekdaySales,
        sales_by_monthday: p.monthdaySales,
        max_gap_without_sale: maxGap,
      };
    });
  }, [filteredOrders]);

  // Time series data for charts
  const timeSeriesData = useMemo(() => {
    const dataMap = new Map<string, { value: number; items: number }>();
    
    filteredOrders.forEach(order => {
      const dateKey = order.order_date;
      const existing = dataMap.get(dateKey) || { value: 0, items: 0 };
      existing.value += order.total_paid;
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
    products,
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
