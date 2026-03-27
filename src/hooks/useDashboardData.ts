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

interface EnrichedDetail {
  hora?: string;
  forma_pagamento: string;
  items: { sku: string; product_name: string; qty: number; unit_price: number; total: number }[];
  frete: number;
  desconto: number;
  total_produtos: number;
  endereco_entrega?: { cidade: string; uf: string; cep: string } | null;
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
  const [orderDetails, setOrderDetails] = useState<Record<string, EnrichedDetail>>({});
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

  // Fetch details in batches of 20
  const fetchBatchDetails = useCallback(async (allIds: number[]) => {
    const details: Record<string, EnrichedDetail> = {};
    const batchSize = 20;

    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      addLog(`Fetching details batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allIds.length / batchSize)} (${batch.length} orders)...`);
      
      try {
        const { data, error: fnError } = await supabase.functions.invoke('tiny-orders', {
          body: { action: 'batch-details', ids: batch },
        });

        if (fnError) {
          addLog(`Batch error: ${fnError.message}`);
          continue;
        }

        if (data?.enriched) {
          Object.assign(details, data.enriched);
        }
      } catch (err) {
        addLog(`Batch fetch error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return details;
  }, []);

  const fetchOrders = useCallback(async (dataInicial?: string, dataFinal?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Fetch all order listings
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

      // Step 2: Fetch details for all orders to get product names, time, payment
      const orderIds = allOrders.map(o => o.pedido.id);
      addLog(`Fetching details for ${orderIds.length} orders...`);
      const details = await fetchBatchDetails(orderIds);
      setOrderDetails(details);
      addLog(`Enriched ${Object.keys(details).length} orders with details`);
      
      return allOrders;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar pedidos';
      setError(message);
      addLog(`Error: ${message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchBatchDetails]);

  // Transform raw orders to TinyOrder format, enriched with details
  const orders: TinyOrder[] = useMemo(() => {
    return rawOrders.map(item => {
      const pedido = item.pedido;
      const orderDate = pedido.data_pedido || '';
      const detail = orderDetails[String(pedido.id)];

      // Build product name from items
      let productName = 'Sem nome';
      let productCategory = 'Sem categoria';
      let itemsCount = 1;
      let skuList: string[] = [];
      let discount = 0;
      let freightCost = 0;
      let paymentMethod = 'Não informado';
      let orderTime: string | undefined;
      let shippingCity = 'sem cidade';
      let shippingState = '';
      let cep = '';

      if (detail) {
        orderTime = detail.hora || undefined;
        paymentMethod = detail.forma_pagamento || 'Não informado';
        discount = detail.desconto || 0;
        freightCost = detail.frete || 0;

        if (detail.items && detail.items.length > 0) {
          productName = detail.items.map(i => i.product_name).join(', ');
          skuList = detail.items.map(i => i.sku).filter(Boolean);
          itemsCount = detail.items.reduce((sum, i) => sum + i.qty, 0);
          // Use first item's name as primary product name for grouping
          productName = detail.items[0].product_name || 'Sem nome';
        }

        if (detail.endereco_entrega) {
          shippingCity = detail.endereco_entrega.cidade || 'sem cidade';
          shippingState = detail.endereco_entrega.uf || '';
          cep = detail.endereco_entrega.cep || '';
        }
      }

      const netRevenue = (pedido.valor || 0) - discount - freightCost;

      return {
        order_id: `ORD-${pedido.id}`,
        order_date: orderDate,
        order_time: orderTime,
        created_at: orderDate,
        status: normalizeStatus(pedido.situacao),
        customer_id: pedido.nome,
        customer_name: pedido.nome || 'Cliente não informado',
        total_paid: pedido.valor || 0,
        discount,
        tax: 0,
        freight_cost: freightCost,
        net_revenue: netRevenue,
        items_count: itemsCount,
        sku_list: skuList,
        product_name: productName,
        product_category: productCategory,
        product_brand: 'Sem marca',
        sales_channel: normalizeChannel(pedido.nome_vendedor || 'site'),
        payment_method: paymentMethod,
        shipping_state: shippingState,
        shipping_city: shippingCity,
        cep,
        delivery_status: '',
        returned_flag: false,
        // Store all items for drill-down
        _items: detail?.items || [],
      } as TinyOrder & { _items: any[] };
    }).filter(order => {
      const orderDate = parseBrazilianDate(order.order_date);
      const today = new Date();
      if (orderDate > today) {
        addLog(`Order ${order.order_id} ignored: future date ${order.order_date}`);
        return false;
      }
      return true;
    });
  }, [rawOrders, orderDetails]);

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = parseBrazilianDate(order.order_date);
      orderDate.setHours(0, 0, 0, 0);
      
      const startDate = new Date(filters.dateStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.dateEnd);
      endDate.setHours(23, 59, 59, 999);
      
      if (orderDate < startDate || orderDate > endDate) return false;
      if (filters.salesChannel.length > 0 && !filters.salesChannel.includes(order.sales_channel)) return false;
      if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(order.payment_method)) return false;
      if (filters.productCategory.length > 0 && !filters.productCategory.includes(order.product_category)) return false;
      if (filters.customerId && order.customer_id !== filters.customerId) return false;

      // Time filter
      if (order.order_time && filters.timeRange) {
        const [h] = order.order_time.split(':').map(Number);
        if (h < filters.timeRange.start || h >= filters.timeRange.end) return false;
      }

      return true;
    });
  }, [orders, filters]);

  // Calculate KPIs
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

      // Aggregate products per customer from _items
      const items = (order as any)._items || [];
      const data = customerMap.get(order.customer_id)!;
      items.forEach((item: any) => {
        const key = item.sku || item.product_name;
        const existing = data.productMap.get(key);
        if (existing) {
          existing.qty_total += item.qty;
          existing.spend_total += item.total;
          existing.last_purchase_date = order.order_date;
        } else {
          data.productMap.set(key, {
            sku: item.sku || '',
            product_name: item.product_name || 'Sem nome',
            qty_total: item.qty,
            spend_total: item.total,
            last_purchase_date: order.order_date,
          });
        }
      });
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

      let topPaymentMethod = 'Não informado';
      let maxCount = 0;
      data.paymentMethods.forEach((count, method) => {
        if (count > maxCount) {
          maxCount = count;
          topPaymentMethod = method;
        }
      });

      // Top 5 products by value
      const productsList = Array.from(data.productMap.values())
        .sort((a, b) => b.spend_total - a.spend_total);

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
        products: productsList,
        top_payment_method: topPaymentMethod,
      };
    }).sort((a, b) => b.total_spend - a.total_spend);
  }, [filteredOrders]);

  // Products data - aggregate from all order items
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
      const items = (order as any)._items || [];
      const orderDate = parseBrazilianDate(order.order_date);

      if (items.length === 0) {
        // Fallback: use order-level product info
        const productKey = order.product_name || `Produto ${order.order_id}`;
        updateProductMap(productMap, productKey, productKey, order.items_count, order.total_paid, order.customer_id, orderDate, order.order_date);
      } else {
        items.forEach((item: any) => {
          const productKey = item.product_name || item.sku || 'Sem nome';
          updateProductMap(productMap, productKey, productKey, item.qty, item.total, order.customer_id, orderDate, order.order_date);
        });
      }
    });

    // ABC classification
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

  // Time series data
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
      .map(([date, data]) => ({ date, value: data.value, items: data.items }))
      .sort((a, b) => parseBrazilianDate(a.date).getTime() - parseBrazilianDate(b.date).getTime());
  }, [filteredOrders]);

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

// Helper to update product map
function updateProductMap(
  map: Map<string, any>,
  key: string,
  name: string,
  qty: number,
  revenue: number,
  customerId: string,
  orderDate: Date,
  orderDateStr: string,
) {
  const existing = map.get(key);
  if (existing) {
    existing.qty += qty;
    existing.revenue += revenue;
    existing.orders++;
    existing.customers.add(customerId);
    existing.weekdaySales[orderDate.getDay()]++;
    existing.monthdaySales[orderDate.getDate() - 1]++;
    existing.saleDates.push(orderDate);
    if (parseBrazilianDate(existing.lastSale) < orderDate) {
      existing.lastSale = orderDateStr;
    }
  } else {
    const weekdaySales = Array(7).fill(0);
    const monthdaySales = Array(31).fill(0);
    weekdaySales[orderDate.getDay()] = 1;
    monthdaySales[orderDate.getDate() - 1] = 1;
    map.set(key, {
      name,
      qty,
      revenue,
      orders: 1,
      lastSale: orderDateStr,
      customers: new Set([customerId]),
      weekdaySales,
      monthdaySales,
      saleDates: [orderDate],
    });
  }
}

function parseBrazilianDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
}
