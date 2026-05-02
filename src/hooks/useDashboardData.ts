import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TinyOrder,
  CustomerData,
  DashboardFilters,
  KPIData,
  ProductData,
  normalizeChannel,
  normalizeStatus,
  normalizePaymentMethod,
  isValidPaymentMethod,
  resolveProductCategory,
  calculateDaysSinceLastPurchase,
  isActiveCustomer,
  calculateCLTV3Y,
  calculateAvgDaysBetweenPurchases,
  ProductPurchase,
} from "@/types/dashboard";

interface CachedOrder {
  tiny_order_id: number;
  numero: number | null;
  data_pedido: string | null;
  nome: string | null;
  valor: number | null;
  situacao: string | null;
  codigo_rastreamento: string | null;
  raw_json: any;
  fetched_at: string;
}

interface CachedDetail {
  tiny_order_id: number;
  hora: string | null;
  forma_pagamento: string | null;
  items: any[] | null;
  frete: number | null;
  desconto: number | null;
  total_produtos: number | null;
  numero_ecommerce: string | null;
  obs: string | null;
  endereco_entrega: any | null;
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

const getDefaultDateRange = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

interface ProductCacheEntry {
  sku: string;
  nome: string | null;
  categoria: string | null;
  unidade?: string | null;
}

export const useDashboardData = () => {
  const [cachedOrders, setCachedOrders] = useState<CachedOrder[]>([]);
  const [cachedDetails, setCachedDetails] = useState<Map<number, CachedDetail>>(new Map());
  const [productCache, setProductCache] = useState<Map<string, ProductCacheEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [filters, setFiltersState] = useState<DashboardFilters>(() => {
    const { start, end } = getDefaultDateRange();
    return {
      dateStart: start,
      dateEnd: end,
      salesChannel: [],
      paymentMethod: [],
      productCategory: [],
      timeRange: { start: 0, end: 24 },
      customerId: null,
      period: 'last30',
      granularity: 'daily',
    };
  });

  const setFilters = useCallback((nextFilters: DashboardFilters) => {
    setFiltersState(nextFilters);
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  // Read orders from local DB cache (paginated to get ALL rows)
  const loadFromCache = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      addLog('Carregando dados do banco local...');

      // Fetch ALL cached orders using pagination
      const PAGE_SIZE = 1000;
      let allOrders: CachedOrder[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: chunk, error: ordersErr } = await supabase
          .from('tiny_orders_cache')
          .select('*')
          .order('tiny_order_id', { ascending: false })
          .range(from, to);

        if (ordersErr) throw new Error(ordersErr.message);
        if (chunk && chunk.length > 0) {
          allOrders = allOrders.concat(chunk);
          page++;
          if (chunk.length < PAGE_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      setCachedOrders(allOrders);
      addLog(`Carregados ${allOrders.length} pedidos do cache`);

      // Fetch all cached details
      if (allOrders.length > 0) {
        const allIds = allOrders.map(o => o.tiny_order_id);
        
        // Fetch in chunks of 500 (supabase .in() limit)
        const detailsMap = new Map<number, CachedDetail>();
        for (let i = 0; i < allIds.length; i += 500) {
          const chunk = allIds.slice(i, i + 500);
          const { data: detailsData, error: detailsErr } = await supabase
            .from('tiny_order_details_cache')
            .select('*')
            .in('tiny_order_id', chunk);

          if (detailsErr) {
            console.error('Details fetch error:', detailsErr.message);
            continue;
          }
          (detailsData || []).forEach(d => detailsMap.set(d.tiny_order_id, d as CachedDetail));
        }
        setCachedDetails(detailsMap);
        addLog(`Carregados ${detailsMap.size} detalhes do cache`);
      }

      // Load product cache (sku -> nome, categoria) for enrichment
      const productMap = new Map<string, ProductCacheEntry>();
      let pPage = 0;
      while (true) {
        const pFrom = pPage * PAGE_SIZE;
        const pTo = pFrom + PAGE_SIZE - 1;
        const { data: pChunk, error: pErr } = await supabase
          .from('tiny_products_cache')
          .select('sku, nome, categoria, unidade')
          .range(pFrom, pTo);
        if (pErr) { console.error('Products cache error:', pErr.message); break; }
        if (!pChunk || pChunk.length === 0) break;
        pChunk.forEach((p: any) => {
          if (p.sku) productMap.set(String(p.sku).trim(), p as ProductCacheEntry);
        });
        if (pChunk.length < PAGE_SIZE) break;
        pPage++;
      }
      setProductCache(productMap);
      addLog(`Carregados ${productMap.size} produtos do cache`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cache';
      setError(message);
      addLog(`Erro: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger sync via edge function
  const triggerSync = useCallback(async (mode: 'full' | 'incremental' = 'incremental') => {
    setIsSyncing(true);
    addLog(`Iniciando sincronização ${mode}...`);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tiny-sync', {
        body: { mode },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      addLog(`Sync completo: ${data.orders_synced} pedidos${data.rate_limited ? ' (rate limited)' : ''}`);
      setLastSyncTime(new Date());

      // Reload from cache after sync
      await loadFromCache();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na sincronização';
      addLog(`Sync erro: ${message}`);
      // Don't set error state for background sync failures
      if (mode === 'full') setError(message);
    } finally {
      setIsSyncing(false);
    }
  }, [loadFromCache]);

  // fetchOrders for backwards compatibility - now just loads from cache
  const fetchOrders = useCallback(async (_dataInicial?: string, _dataFinal?: string, forceRefresh = false) => {
    if (forceRefresh) {
      await triggerSync('incremental');
    } else {
      await loadFromCache();
    }
    return [];
  }, [triggerSync, loadFromCache]);

  // Initial load from cache (manual sync only via button)
  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  // Transform cached data to TinyOrder format
  const orders: TinyOrder[] = useMemo(() => {
    const mapped = cachedOrders.map(cached => {
      const detail = cachedDetails.get(cached.tiny_order_id);
      const orderDate = cached.data_pedido || '';

      let productName = '';
      let productCategory = '';
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
        paymentMethod = normalizePaymentMethod(detail.forma_pagamento);
        discount = Number(detail.desconto) || 0;
        freightCost = Number(detail.frete) || 0;

        const rawItems = detail.items || [];
        // Enriquecer cada item com nome+categoria do cache de produtos
        const items = rawItems.map((it: any) => {
          const skuKey = String(it.sku || '').trim();
          const cached = skuKey ? productCache.get(skuKey) : undefined;
          const productName = cached?.nome || it.product_name || it.descricao || skuKey || '';
          const unit = cached?.unidade || it.unidade || it.unit || '';
          return {
            sku: skuKey,
            product_name: productName,
            categoria: resolveProductCategory(cached?.categoria || it.categoria || it.category, productName, skuKey, unit),
            qty: Number(it.qty) || 1,
            unit_price: Number(it.unit_price) || 0,
            total: Number(it.total) || 0,
            unidade: unit,
          };
        });
        if (items.length > 0) {
          const firstItem = items[0];
          // Use o primeiro item com categoria preenchida
          const itemWithCat = items.find((i: any) => i.categoria) || firstItem;
          productName = firstItem.product_name || '';
          productCategory = itemWithCat.categoria || '';
          skuList = items.map((i: any) => i.sku).filter(Boolean);
          // items_count = produtos distintos no pedido (cada linha conta 1, ignorando peso/qty fracionária)
          itemsCount = items.length;
          // overwrite detail.items para uso no _items abaixo
          (detail as any)._enrichedItems = items;
        }

        if (detail.endereco_entrega) {
          shippingCity = detail.endereco_entrega.cidade || 'sem cidade';
          shippingState = detail.endereco_entrega.uf || '';
          cep = detail.endereco_entrega.cep || '';
        }
      }

      // Fallbacks: never use placeholder "Sem nome" — use order number identifier
      if (!productName) {
        productName = `Pedido #${cached.numero || cached.tiny_order_id}`;
      }
      if (!productCategory) {
        productCategory = 'Sem categoria';
      }

      const valor = Number(cached.valor) || 0;
      const netRevenue = valor - discount - freightCost;
      const vendedor = cached.raw_json?.pedido?.nome_vendedor || 'site';

      return {
        order_id: `ORD-${cached.tiny_order_id}`,
        order_date: orderDate,
        order_time: orderTime,
        created_at: orderDate,
        status: normalizeStatus(cached.situacao || ''),
        customer_id: cached.nome || '',
        customer_name: cached.nome || 'Cliente não informado',
        total_paid: valor,
        discount,
        tax: 0,
        freight_cost: freightCost,
        net_revenue: netRevenue,
        items_count: itemsCount,
        sku_list: skuList,
        product_name: productName,
        product_category: productCategory,
        product_brand: 'Sem marca',
        sales_channel: normalizeChannel(vendedor),
        payment_method: paymentMethod,
        shipping_state: shippingState,
        shipping_city: shippingCity,
        cep,
        delivery_status: '',
        returned_flag: false,
        _numero: cached.numero || 0,
        _items: (detail as any)?._enrichedItems || detail?.items || [],
      } as TinyOrder & { _items: any[]; _numero: number };
    }).filter(order => {
      if (!order.order_date) return false;
      const orderDate = parseBrazilianDate(order.order_date);
      const today = new Date();
      return orderDate <= today;
    });

    // Estimate order times from sequential order numbers within each day
    const BUSINESS_START = 8;
    const BUSINESS_END = 20;
    const BUSINESS_HOURS = BUSINESS_END - BUSINESS_START;

    const ordersByDate = new Map<string, typeof mapped>();
    mapped.forEach(o => {
      const key = o.order_date;
      if (!ordersByDate.has(key)) ordersByDate.set(key, []);
      ordersByDate.get(key)!.push(o);
    });

    ordersByDate.forEach((dayOrders) => {
      const needsEstimation = dayOrders.filter(o => !o.order_time);
      if (needsEstimation.length === 0) return;
      needsEstimation.sort((a, b) => ((a as any)._numero || 0) - ((b as any)._numero || 0));
      const count = needsEstimation.length;
      needsEstimation.forEach((order, index) => {
        const fraction = count > 1 ? index / (count - 1) : 0.5;
        const totalMinutes = BUSINESS_START * 60 + fraction * BUSINESS_HOURS * 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        order.order_time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      });
    });

    return mapped;
  }, [cachedOrders, cachedDetails, productCache]);

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
      if (filters.productCategory.length > 0) {
        const itemCategories = ((order as any)._items || []).map((item: any) => item.categoria).filter(Boolean);
        const matchesCategory = filters.productCategory.some(cat =>
          order.product_category === cat || itemCategories.includes(cat)
        );
        if (!matchesCategory) return false;
      }
      if (filters.customerId && order.customer_id !== filters.customerId) return false;

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
    // Para "cliente ativo" usar a ÚLTIMA compra real do cliente (dataset completo, sem filtro de data)
    const lastOrderDateByCustomer = new Map<string, string>();
    orders.filter(o => normalizeStatus(o.status) === 'faturado').forEach(o => {
      const cur = lastOrderDateByCustomer.get(o.customer_id);
      if (!cur || parseBrazilianDate(o.order_date) > parseBrazilianDate(cur)) {
        lastOrderDateByCustomer.set(o.customer_id, o.order_date);
      }
    });

    const customerMap = new Map<string, {
      orders: TinyOrder[];
      productMap: Map<string, ProductPurchase>;
      paymentMethods: Map<string, number>;
    }>();

    filteredOrders.filter(o => normalizeStatus(o.status) === 'faturado').forEach(order => {
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

      const items = (order as any)._items || [];
      const data = customerMap.get(order.customer_id)!;
      items.forEach((item: any) => {
        const key = item.sku || item.product_name;
        if (!key) return;
        const existing = data.productMap.get(key);
        if (existing) {
          existing.qty_total += item.qty;
          existing.spend_total += item.total;
          existing.last_purchase_date = order.order_date;
        } else {
          data.productMap.set(key, {
            sku: item.sku || '',
            product_name: item.product_name || item.sku || 'Produto sem identificação',
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

      // Top payment method — usa apenas pagamentos válidos (ignora "Não informado")
      let topPaymentMethod = 'Não informado';
      let maxCount = 0;
      data.paymentMethods.forEach((count, method) => {
        if (!isValidPaymentMethod(method)) return;
        if (count > maxCount) {
          maxCount = count;
          topPaymentMethod = method;
        }
      });

      const productsList = Array.from(data.productMap.values())
        .sort((a, b) => b.spend_total - a.spend_total);

      // Última compra REAL (não restrita ao período filtrado) — base para "cliente ativo"
      const realLastOrderDate = lastOrderDateByCustomer.get(customerId) || lastOrder.order_date;
      const realDaysSinceLast = calculateDaysSinceLastPurchase(realLastOrderDate);

      return {
        customer_id: customerId,
        customer_name: lastOrder.customer_name,
        total_orders: totalOrders,
        total_spend: totalSpend,
        avg_ticket: totalOrders > 0 ? totalSpend / totalOrders : 0,
        items_count: itemsCount,
        avg_items_per_order: totalOrders > 0 ? itemsCount / totalOrders : 0,
        first_order_date: firstOrder.order_date,
        last_order_date: realLastOrderDate,
        days_since_last_purchase: realDaysSinceLast,
        avg_days_between_purchases: calculateAvgDaysBetweenPurchases(data.orders),
        is_active: realDaysSinceLast <= 60,
        cltv_3y: calculateCLTV3Y(totalSpend / totalOrders, ordersPerYear),
        orders: sortedOrders,
        products: productsList,
        top_payment_method: topPaymentMethod,
      };
    }).sort((a, b) => b.total_spend - a.total_spend);
  }, [filteredOrders, orders]);

  // Products data
  const products: ProductData[] = useMemo(() => {
    const productMap = new Map<string, any>();

    filteredOrders.forEach(order => {
      const items = (order as any)._items || [];
      const orderDate = parseBrazilianDate(order.order_date);

      // Only aggregate products from orders that have detailed items
      if (items.length === 0) return;

      items.forEach((item: any) => {
        const productKey = item.product_name || item.sku;
        if (!productKey) return;
        updateProductMap(productMap, productKey, productKey, item.qty, item.total, order.customer_id, orderDate, order.order_date);
      });
    });

    const productsList = Array.from(productMap.entries())
      .map(([sku, data]) => ({ sku, ...data, customersArray: Array.from(data.customers) }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = productsList.reduce((sum, p) => sum + p.revenue, 0);
    let cumulativeRevenue = 0;

    return productsList.map(p => {
      cumulativeRevenue += p.revenue;
      const cumulativePercent = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;
      
      let abcClass: 'A' | 'B' | 'C' = 'C';
      if (cumulativePercent <= 80) abcClass = 'A';
      else if (cumulativePercent <= 95) abcClass = 'B';

      const sortedDates = [...p.saleDates].sort((a: Date, b: Date) => a.getTime() - b.getTime());
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
    isSyncing,
    error,
    logs,
    fetchOrders,
    triggerSync,
    lastSyncTime,
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
      name, qty, revenue, orders: 1,
      lastSale: orderDateStr,
      customers: new Set([customerId]),
      weekdaySales, monthdaySales,
      saleDates: [orderDate],
    });
  }
}

