import { useMemo } from "react";
import {
  TinyOrder,
  CustomerData,
  ProductData,
  isValidPaymentMethod,
} from "@/types/dashboard";

export type ComparisonPreset =
  | "month_vs_prev"
  | "week_vs_prev_month_week"
  | "today_vs_yesterday"
  | "custom_vs_prev_equal";

const parseBR = (s: string): Date => {
  if (!s) return new Date(NaN);
  const p = s.split("/");
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  return new Date(s);
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  prevLabel: string;
}

export const buildPeriodRange = (
  preset: ComparisonPreset,
  custom?: { start: Date; end: Date },
): PeriodRange => {
  const now = new Date();
  if (preset === "today_vs_yesterday") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const prevStart = startOfDay(new Date(now.getTime() - 86400000));
    const prevEnd = endOfDay(new Date(now.getTime() - 86400000));
    return { start, end, prevStart, prevEnd, label: "Hoje", prevLabel: "Ontem" };
  }
  if (preset === "week_vs_prev_month_week") {
    const day = now.getDay();
    const start = startOfDay(new Date(now.getTime() - day * 86400000));
    const end = endOfDay(now);
    const prevStart = new Date(start);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(end);
    prevEnd.setMonth(prevEnd.getMonth() - 1);
    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: "Esta semana",
      prevLabel: "Mesma semana mês passado",
    };
  }
  if (preset === "month_vs_prev") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = endOfDay(now);
    const prevEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    const prevStart = startOfDay(
      new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1),
    );
    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: "Mês atual",
      prevLabel: "Mês anterior",
    };
  }
  // custom_vs_prev_equal
  const start = startOfDay(custom?.start ?? new Date(now.getTime() - 30 * 86400000));
  const end = endOfDay(custom?.end ?? now);
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return {
    start,
    end,
    prevStart,
    prevEnd,
    label: "Período",
    prevLabel: "Período anterior equivalente",
  };
};

const isFaturado = (o: TinyOrder) => (o.status || "").toLowerCase() === "faturado";

const inRange = (o: TinyOrder, s: Date, e: Date) => {
  const d = parseBR(o.order_date);
  return !isNaN(d.getTime()) && d >= s && d <= e;
};

interface ExecKPIs {
  revenue: number;
  orders: number;
  unique_customers: number;
  avg_ticket: number;
  items_per_order: number;
  recurring_customers: number;
  new_customers: number;
  inactive_customers: number;
}

const blankKPIs = (): ExecKPIs => ({
  revenue: 0,
  orders: 0,
  unique_customers: 0,
  avg_ticket: 0,
  items_per_order: 0,
  recurring_customers: 0,
  new_customers: 0,
  inactive_customers: 0,
});

const computeKPIs = (
  orders: TinyOrder[],
  s: Date,
  e: Date,
  allOrdersByCustomer: Map<string, Date[]>,
): ExecKPIs => {
  const inWin = orders.filter((o) => isFaturado(o) && inRange(o, s, e));
  const revenue = inWin.reduce((a, o) => a + (o.net_revenue || o.total_paid || 0), 0);
  const ordersCount = inWin.length;
  const customersInWin = new Set(inWin.map((o) => o.customer_id));
  const items = inWin.reduce((a, o) => a + (o.items_count || 1), 0);

  // Recurring vs new vs inactive (relative to end date)
  let recurring = 0,
    newC = 0;
  customersInWin.forEach((cid) => {
    const dates = allOrdersByCustomer.get(cid) || [];
    const firstDate = dates[0];
    if (firstDate && firstDate >= s && firstDate <= e) newC++;
    if (dates.length >= 2) recurring++;
  });

  // Inactive: customers whose last order < (e - 60 days)
  let inactive = 0;
  const cutoff = new Date(e.getTime() - 60 * 86400000);
  allOrdersByCustomer.forEach((dates) => {
    const last = dates[dates.length - 1];
    if (last && last < cutoff) inactive++;
  });

  return {
    revenue,
    orders: ordersCount,
    unique_customers: customersInWin.size,
    avg_ticket: ordersCount ? revenue / ordersCount : 0,
    items_per_order: ordersCount ? items / ordersCount : 0,
    recurring_customers: recurring,
    new_customers: newC,
    inactive_customers: inactive,
  };
};

const pct = (curr: number, prev: number) => {
  if (!prev) return curr ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

export interface ExecutiveBlock {
  range: PeriodRange;
  current: ExecKPIs;
  previous: ExecKPIs;
  delta: Record<keyof ExecKPIs, { abs: number; pct: number }>;
  series: Array<{ date: string; current: number; previous: number }>;
}

export interface InactivityBucket {
  label: string;
  min: number;
  max: number | null;
  customers: number;
  potential_value: number;
}

export interface InactiveCustomer {
  customer_id: string;
  customer_name: string;
  last_order_date: string;
  days_inactive: number;
  total_spend: number;
  total_orders: number;
  avg_ticket: number;
  top_category?: string;
  top_payment?: string;
  potential_lost: number;
}

export interface StaleProduct {
  sku: string;
  product_name: string;
  category: string;
  last_sale_date: string;
  days_without_sale: number;
  qty_total: number;
  revenue_total: number;
  qty_prev_period: number;
  level: "ok" | "warn" | "alert" | "critical";
}

export interface CustomerCluster {
  id: string;
  label: string;
  description: string;
  customers: CustomerData[];
  count: number;
  avg_ticket: number;
  total_spend: number;
  avg_orders: number;
  avg_days_between: number;
  top_category?: string;
  top_payment?: string;
  top_product?: string;
}

export interface RepurchaseStats {
  rate: number;
  avg_days_to_second: number;
  avg_repurchase_ticket: number;
  top_repurchasers: Array<{ name: string; spend: number; orders: number }>;
  cohort: Array<{ cohort: string; m0: number; m1: number; m2: number; m3: number; m6: number; m12: number }>;
}

export interface ParetoEntry {
  name: string;
  value: number;
  cumPct: number;
}

export interface ParetoStats {
  customers: ParetoEntry[];
  products: ParetoEntry[];
  top10_customers_pct: number;
  top10_products_pct: number;
  by_category: Array<{ category: string; value: number; pct: number }>;
}

export interface BasketStats {
  by_category: Array<{
    category: string;
    avg_ticket_with: number;
    avg_items_with: number;
    appearances: number;
  }>;
  cooccurrence: Array<{ a: string; b: string; count: number }>;
}

export interface SeasonalityStats {
  weekday_hour: number[][]; // 7 x 8 (3h buckets)
  by_monthday: Array<{ day: number; orders: number; revenue: number }>;
}

export interface AnchorStats {
  anchors: Array<{ name: string; appearances_high_ticket: number; revenue: number }>;
  pairs: Array<{ a: string; b: string; count: number }>;
}

export type BehaviorClassification =
  | "acelerando"
  | "desacelerando"
  | "subindo_ticket"
  | "caindo_ticket"
  | "em_risco"
  | "estavel";

export interface BehaviorChangeRow {
  customer_id: string;
  name: string;
  deltaFreq: number;
  deltaTicket: number;
  freqBefore: number;
  freqAfter: number;
  ticketBefore: number;
  ticketAfter: number;
  classification: BehaviorClassification;
  last_order_date: string;
  spark: number[];
}

export interface CrossSellRelated {
  sku: string;
  product_name: string;
  category: string;
  count: number;
  pct_of_anchor: number;
  combined_revenue: number;
  avg_price: number;
}

export interface CustomerRecommendation extends CrossSellRelated {
  reason: string;
}

export interface ProductIndexEntry {
  sku: string;
  name: string;
  category: string;
  avg_price: number;
}

export interface ReportsAnalytics {
  executive: ExecutiveBlock;
  inactiveBuckets: InactivityBucket[];
  inactiveList: InactiveCustomer[];
  staleProducts: StaleProduct[];
  clusters: CustomerCluster[];
  trendSeries: Array<{ bucket: string; orders: number; revenue: number; avgTicket: number }>;
  behaviorChange: BehaviorChangeRow[];
  repurchase: RepurchaseStats;
  pareto: ParetoStats;
  basket: BasketStats;
  seasonality: SeasonalityStats;
  anchor: AnchorStats;
  productIndex: Map<string, ProductIndexEntry>;
  productList: ProductIndexEntry[];
  getRelatedBySku: (sku: string, n?: number) => CrossSellRelated[];
  getRecommendationsForCustomer: (customerId: string, n?: number) => CustomerRecommendation[];
}

export const useReportsAnalytics = (
  orders: TinyOrder[],
  customers: CustomerData[],
  products: ProductData[],
  preset: ComparisonPreset,
  custom?: { start: Date; end: Date },
): ReportsAnalytics => {
  return useMemo(() => {
    const range = buildPeriodRange(preset, custom);

    const validOrders = orders.filter(isFaturado);

    // Index of all orders by customer (sorted asc)
    const ordersByCustomer = new Map<string, Date[]>();
    validOrders.forEach((o) => {
      const d = parseBR(o.order_date);
      if (isNaN(d.getTime())) return;
      if (!ordersByCustomer.has(o.customer_id)) ordersByCustomer.set(o.customer_id, []);
      ordersByCustomer.get(o.customer_id)!.push(d);
    });
    ordersByCustomer.forEach((arr) => arr.sort((a, b) => a.getTime() - b.getTime()));

    // Executive block
    const current = computeKPIs(validOrders, range.start, range.end, ordersByCustomer);
    const previous = computeKPIs(validOrders, range.prevStart, range.prevEnd, ordersByCustomer);
    const delta = (Object.keys(current) as Array<keyof ExecKPIs>).reduce((acc, k) => {
      acc[k] = { abs: current[k] - previous[k], pct: pct(current[k], previous[k]) };
      return acc;
    }, {} as Record<keyof ExecKPIs, { abs: number; pct: number }>);

    // Daily series (current vs previous shifted)
    const dailyCurr = new Map<string, number>();
    const dailyPrev = new Map<string, number>();
    validOrders.forEach((o) => {
      const d = parseBR(o.order_date);
      if (isNaN(d.getTime())) return;
      const v = o.net_revenue || o.total_paid || 0;
      if (d >= range.start && d <= range.end) {
        dailyCurr.set(dayKey(d), (dailyCurr.get(dayKey(d)) || 0) + v);
      }
      if (d >= range.prevStart && d <= range.prevEnd) {
        const offset = range.start.getTime() - range.prevStart.getTime();
        const shifted = new Date(d.getTime() + offset);
        dailyPrev.set(dayKey(shifted), (dailyPrev.get(dayKey(shifted)) || 0) + v);
      }
    });
    const series: ExecutiveBlock["series"] = [];
    const dayMs = 86400000;
    for (let t = range.start.getTime(); t <= range.end.getTime(); t += dayMs) {
      const k = dayKey(new Date(t));
      series.push({
        date: k,
        current: dailyCurr.get(k) || 0,
        previous: dailyPrev.get(k) || 0,
      });
    }

    const executive: ExecutiveBlock = { range, current, previous, delta, series };

    // Inactive customers
    const todayRef = range.end;
    const inactiveBucketsDef = [
      { label: "15-29 dias", min: 15, max: 29 },
      { label: "30-44 dias", min: 30, max: 44 },
      { label: "45-59 dias", min: 45, max: 59 },
      { label: "60-89 dias", min: 60, max: 89 },
      { label: "90+ dias", min: 90, max: null as number | null },
    ];
    const inactiveList: InactiveCustomer[] = customers
      .filter((c) => c.days_since_last_purchase >= 15)
      .map((c) => {
        const ordersOfCustomer = (c.orders || []).filter(isFaturado);
        const catCount = new Map<string, number>();
        const payCount = new Map<string, number>();
        ordersOfCustomer.forEach((o) => {
          if (o.product_category) catCount.set(o.product_category, (catCount.get(o.product_category) || 0) + 1);
          if (isValidPaymentMethod(o.payment_method)) payCount.set(o.payment_method, (payCount.get(o.payment_method) || 0) + 1);
        });
        const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const topPay = [...payCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const freqYear = c.avg_days_between_purchases > 0 ? 365 / c.avg_days_between_purchases : 0;
        const lostOrders = freqYear * (c.days_since_last_purchase / 365);
        return {
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          last_order_date: c.last_order_date,
          days_inactive: c.days_since_last_purchase,
          total_spend: c.total_spend,
          total_orders: c.total_orders,
          avg_ticket: c.avg_ticket,
          top_category: topCat,
          top_payment: topPay,
          potential_lost: c.avg_ticket * Math.max(1, lostOrders),
        };
      })
      .sort((a, b) => b.potential_lost - a.potential_lost);

    const inactiveBuckets: InactivityBucket[] = inactiveBucketsDef.map((b) => {
      const list = inactiveList.filter(
        (c) => c.days_inactive >= b.min && (b.max === null || c.days_inactive <= b.max),
      );
      return {
        label: b.label,
        min: b.min,
        max: b.max,
        customers: list.length,
        potential_value: list.reduce((a, c) => a + c.potential_lost, 0),
      };
    });

    // Stale products
    const staleProducts: StaleProduct[] = products
      .map((p) => {
        const days = p.days_without_sale;
        let level: StaleProduct["level"] = "ok";
        if (days >= 60) level = "critical";
        else if (days >= 30) level = "alert";
        else if (days >= 7) level = "warn";

        // Qty in previous comparable period (using all orders)
        let qtyPrev = 0;
        validOrders.forEach((o) => {
          const d = parseBR(o.order_date);
          if (d >= range.prevStart && d <= range.prevEnd) {
            const items = (o as any)._items || [];
            items.forEach((it: any) => {
              if (it.sku === p.sku) qtyPrev += Number(it.qty) || 0;
            });
          }
        });

        return {
          sku: p.sku,
          product_name: p.product_name,
          category: p.product_category,
          last_sale_date: p.last_sale_date,
          days_without_sale: days,
          qty_total: p.total_qty,
          revenue_total: p.total_revenue,
          qty_prev_period: qtyPrev,
          level,
        };
      })
      .sort((a, b) => b.days_without_sale - a.days_without_sale);

    // Customer clusters (rule-based)
    const ticketMedian = (() => {
      const arr = customers.map((c) => c.avg_ticket).filter((x) => x > 0).sort((a, b) => a - b);
      return arr[Math.floor(arr.length / 2)] || 0;
    })();
    const buildCluster = (
      id: string,
      label: string,
      description: string,
      pred: (c: CustomerData) => boolean,
    ): CustomerCluster => {
      const list = customers.filter(pred);
      const total_spend = list.reduce((a, c) => a + c.total_spend, 0);
      const total_orders = list.reduce((a, c) => a + c.total_orders, 0);
      const catCount = new Map<string, number>();
      const payCount = new Map<string, number>();
      const prodCount = new Map<string, number>();
      list.forEach((c) => {
        c.orders.forEach((o) => {
          if (o.product_category) catCount.set(o.product_category, (catCount.get(o.product_category) || 0) + 1);
          if (isValidPaymentMethod(o.payment_method)) payCount.set(o.payment_method, (payCount.get(o.payment_method) || 0) + 1);
        });
        c.products?.forEach((p) => {
          prodCount.set(p.product_name, (prodCount.get(p.product_name) || 0) + p.qty_total);
        });
      });
      return {
        id,
        label,
        description,
        customers: list,
        count: list.length,
        avg_ticket: list.length ? list.reduce((a, c) => a + c.avg_ticket, 0) / list.length : 0,
        total_spend,
        avg_orders: list.length ? total_orders / list.length : 0,
        avg_days_between: list.length
          ? list.reduce((a, c) => a + c.avg_days_between_purchases, 0) / list.length
          : 0,
        top_category: [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
        top_payment: [...payCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
        top_product: [...prodCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
      };
    };
    const clusters: CustomerCluster[] = [
      buildCluster(
        "weekly_plus",
        "Mais de 1×/semana",
        "Compram mais de uma vez por semana",
        (c) => c.avg_days_between_purchases > 0 && c.avg_days_between_purchases < 7 && c.is_active,
      ),
      buildCluster(
        "weekly",
        "Semanais",
        "Compram aproximadamente toda semana",
        (c) => c.avg_days_between_purchases >= 7 && c.avg_days_between_purchases <= 10 && c.is_active,
      ),
      buildCluster(
        "monthly",
        "Mensais",
        "Compram aproximadamente todo mês",
        (c) => c.avg_days_between_purchases >= 25 && c.avg_days_between_purchases <= 35 && c.is_active,
      ),
      buildCluster("one_shot", "Compraram uma vez", "Único pedido no histórico", (c) => c.total_orders === 1),
      buildCluster(
        "high_value_low_freq",
        "Alto valor / baixa frequência",
        "Ticket alto mas compram pouco",
        (c) => c.avg_ticket >= ticketMedian * 1.5 && c.avg_days_between_purchases > 30,
      ),
      buildCluster(
        "low_value_high_freq",
        "Baixo valor / alta frequência",
        "Compram muito mas com ticket baixo",
        (c) => c.avg_ticket < ticketMedian && c.avg_days_between_purchases > 0 && c.avg_days_between_purchases < 14,
      ),
      buildCluster(
        "inactive_strong",
        "Inativos com histórico forte",
        "Já gastaram bastante mas pararam",
        (c) => !c.is_active && c.total_spend >= ticketMedian * 5,
      ),
    ].filter((cl) => cl.count > 0);

    // Trend series (weekly bucket within range)
    const weeklyMap = new Map<string, { orders: number; revenue: number }>();
    validOrders.forEach((o) => {
      const d = parseBR(o.order_date);
      if (isNaN(d.getTime()) || d < range.start || d > range.end) return;
      const day = d.getDay();
      const monday = new Date(d.getTime() - day * 86400000);
      const k = dayKey(monday);
      const cur = weeklyMap.get(k) || { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += o.net_revenue || o.total_paid || 0;
      weeklyMap.set(k, cur);
    });
    const trendSeries = [...weeklyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, v]) => ({
        bucket,
        orders: v.orders,
        revenue: v.revenue,
        avgTicket: v.orders ? v.revenue / v.orders : 0,
      }));

    // Behavior change: split window in half
    const mid = new Date((range.start.getTime() + range.end.getTime()) / 2);
    const halfStats = (s: Date, e: Date) => {
      const map = new Map<string, { freq: number; ticket: number; orders: number }>();
      validOrders.forEach((o) => {
        const d = parseBR(o.order_date);
        if (d < s || d > e) return;
        const cur = map.get(o.customer_id) || { freq: 0, ticket: 0, orders: 0 };
        cur.freq += 1;
        cur.ticket += o.net_revenue || o.total_paid || 0;
        cur.orders += 1;
        map.set(o.customer_id, cur);
      });
      return map;
    };
    const h1 = halfStats(range.start, mid);
    const h2 = halfStats(mid, range.end);
    const behaviorChange: BehaviorChangeRow[] = [];
    const allCust = new Set([...h1.keys(), ...h2.keys()]);
    const weeks = 8;
    const sparkMap = new Map<string, number[]>();
    validOrders.forEach((o) => {
      const d = parseBR(o.order_date);
      if (isNaN(d.getTime())) return;
      const diff = (range.end.getTime() - d.getTime()) / 86400000;
      if (diff < 0 || diff > weeks * 7) return;
      const idx = weeks - 1 - Math.min(weeks - 1, Math.floor(diff / 7));
      if (!sparkMap.has(o.customer_id)) sparkMap.set(o.customer_id, Array(weeks).fill(0));
      sparkMap.get(o.customer_id)![idx] += o.net_revenue || o.total_paid || 0;
    });
    allCust.forEach((cid) => {
      const a = h1.get(cid) || { freq: 0, ticket: 0, orders: 0 };
      const b = h2.get(cid) || { freq: 0, ticket: 0, orders: 0 };
      const ta = a.orders ? a.ticket / a.orders : 0;
      const tb = b.orders ? b.ticket / b.orders : 0;
      const customer = customers.find((c) => c.customer_id === cid);
      const deltaFreq = b.freq - a.freq;
      const deltaTicket = tb - ta;
      let classification: BehaviorClassification = "estavel";
      if (b.freq === 0 && a.freq > 0) classification = "em_risco";
      else if (deltaFreq >= 2) classification = "acelerando";
      else if (deltaFreq <= -2) classification = "desacelerando";
      else if (ta > 0 && (tb - ta) / ta >= 0.2) classification = "subindo_ticket";
      else if (ta > 0 && (tb - ta) / ta <= -0.2) classification = "caindo_ticket";
      behaviorChange.push({
        customer_id: cid,
        name: customer?.customer_name || cid,
        deltaFreq,
        deltaTicket,
        freqBefore: a.freq,
        freqAfter: b.freq,
        ticketBefore: ta,
        ticketAfter: tb,
        classification,
        last_order_date: customer?.last_order_date || "",
        spark: sparkMap.get(cid) || Array(weeks).fill(0),
      });
    });
    behaviorChange.sort((x, y) => (Math.abs(y.deltaFreq) * 100 + Math.abs(y.deltaTicket)) - (Math.abs(x.deltaFreq) * 100 + Math.abs(x.deltaTicket)));

    // Repurchase
    let withSecond = 0;
    let totalDaysToSecond = 0;
    let repurchaseRevenue = 0;
    let repurchaseCount = 0;
    const repurchasers: Array<{ name: string; spend: number; orders: number }> = [];
    customers.forEach((c) => {
      if (c.total_orders >= 2) {
        withSecond++;
        const dates = (c.orders || []).map((o) => parseBR(o.order_date)).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
        if (dates.length >= 2) {
          totalDaysToSecond += (dates[1].getTime() - dates[0].getTime()) / 86400000;
        }
        const repurchaseOrders = c.orders.slice(1);
        repurchaseOrders.forEach((o) => {
          repurchaseRevenue += o.net_revenue || o.total_paid || 0;
          repurchaseCount++;
        });
        repurchasers.push({ name: c.customer_name, spend: c.total_spend, orders: c.total_orders });
      }
    });
    repurchasers.sort((a, b) => b.spend - a.spend);

    // Cohort
    const cohortMap = new Map<string, { customers: Set<string>; m: Record<number, Set<string>> }>();
    customers.forEach((c) => {
      const dates = (c.orders || []).map((o) => parseBR(o.order_date)).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
      if (!dates.length) return;
      const first = dates[0];
      const cohort = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
      if (!cohortMap.has(cohort)) cohortMap.set(cohort, { customers: new Set(), m: {} });
      const slot = cohortMap.get(cohort)!;
      slot.customers.add(c.customer_id);
      dates.forEach((d) => {
        const monthsAfter = (d.getFullYear() - first.getFullYear()) * 12 + (d.getMonth() - first.getMonth());
        if (!slot.m[monthsAfter]) slot.m[monthsAfter] = new Set();
        slot.m[monthsAfter].add(c.customer_id);
      });
    });
    const cohort = [...cohortMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([k, v]) => {
        const total = v.customers.size || 1;
        const at = (n: number) => Math.round(((v.m[n]?.size || 0) / total) * 100);
        return {
          cohort: k,
          m0: at(0),
          m1: at(1),
          m2: at(2),
          m3: at(3),
          m6: at(6),
          m12: at(12),
        };
      });

    const repurchase: RepurchaseStats = {
      rate: customers.length ? withSecond / customers.length : 0,
      avg_days_to_second: withSecond ? totalDaysToSecond / withSecond : 0,
      avg_repurchase_ticket: repurchaseCount ? repurchaseRevenue / repurchaseCount : 0,
      top_repurchasers: repurchasers.slice(0, 10),
      cohort,
    };

    // Pareto
    const sortedCustomers = [...customers].sort((a, b) => b.total_spend - a.total_spend);
    const totalCustSpend = sortedCustomers.reduce((a, c) => a + c.total_spend, 0) || 1;
    let cumC = 0;
    const customersPareto: ParetoEntry[] = sortedCustomers.slice(0, 30).map((c) => {
      cumC += c.total_spend;
      return { name: c.customer_name, value: c.total_spend, cumPct: (cumC / totalCustSpend) * 100 };
    });
    const top10CustPct =
      sortedCustomers.slice(0, 10).reduce((a, c) => a + c.total_spend, 0) / totalCustSpend * 100;

    const sortedProducts = [...products].sort((a, b) => b.total_revenue - a.total_revenue);
    const totalProdRev = sortedProducts.reduce((a, p) => a + p.total_revenue, 0) || 1;
    let cumP = 0;
    const productsPareto: ParetoEntry[] = sortedProducts.slice(0, 30).map((p) => {
      cumP += p.total_revenue;
      return { name: p.product_name, value: p.total_revenue, cumPct: (cumP / totalProdRev) * 100 };
    });
    const top10ProdPct =
      sortedProducts.slice(0, 10).reduce((a, p) => a + p.total_revenue, 0) / totalProdRev * 100;

    const catRevenue = new Map<string, number>();
    products.forEach((p) => {
      catRevenue.set(p.product_category, (catRevenue.get(p.product_category) || 0) + p.total_revenue);
    });
    const totalCat = [...catRevenue.values()].reduce((a, b) => a + b, 0) || 1;
    const by_category = [...catRevenue.entries()]
      .map(([category, value]) => ({ category, value, pct: (value / totalCat) * 100 }))
      .sort((a, b) => b.value - a.value);

    const pareto: ParetoStats = {
      customers: customersPareto,
      products: productsPareto,
      top10_customers_pct: top10CustPct,
      top10_products_pct: top10ProdPct,
      by_category,
    };

    // Basket per category
    const basketByCat = new Map<string, { tickets: number[]; items: number[] }>();
    const cooccur = new Map<string, number>();
    validOrders.forEach((o) => {
      const items = (o as any)._items || [];
      const cats = new Set<string>(items.map((i: any) => i.categoria).filter(Boolean));
      cats.forEach((c) => {
        if (!basketByCat.has(c)) basketByCat.set(c, { tickets: [], items: [] });
        const slot = basketByCat.get(c)!;
        slot.tickets.push(o.net_revenue || o.total_paid || 0);
        slot.items.push(o.items_count || 1);
      });
      const arr = [...cats].sort();
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const k = `${arr[i]}|${arr[j]}`;
          cooccur.set(k, (cooccur.get(k) || 0) + 1);
        }
      }
    });
    const basket: BasketStats = {
      by_category: [...basketByCat.entries()]
        .map(([category, v]) => ({
          category,
          avg_ticket_with: v.tickets.length ? v.tickets.reduce((a, b) => a + b, 0) / v.tickets.length : 0,
          avg_items_with: v.items.length ? v.items.reduce((a, b) => a + b, 0) / v.items.length : 0,
          appearances: v.tickets.length,
        }))
        .sort((a, b) => b.avg_ticket_with - a.avg_ticket_with),
      cooccurrence: [...cooccur.entries()]
        .map(([k, count]) => {
          const [a, b] = k.split("|");
          return { a, b, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };

    // Seasonality
    const weekday_hour: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
    const monthdayMap = new Map<number, { orders: number; revenue: number }>();
    validOrders.forEach((o) => {
      const d = parseBR(o.order_date);
      if (isNaN(d.getTime())) return;
      let h = 12;
      if (o.order_time) {
        const parts = o.order_time.split(":");
        if (parts.length >= 1) h = parseInt(parts[0]) || 12;
      }
      const bucket = Math.min(7, Math.floor(h / 3));
      weekday_hour[d.getDay()][bucket] += 1;
      const md = d.getDate();
      const cur = monthdayMap.get(md) || { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += o.net_revenue || o.total_paid || 0;
      monthdayMap.set(md, cur);
    });
    const seasonality: SeasonalityStats = {
      weekday_hour,
      by_monthday: [...monthdayMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, v]) => ({ day, ...v })),
    };

    // Anchor & complementary products
    const ticketsArr = validOrders.map((o) => o.net_revenue || o.total_paid || 0).sort((a, b) => a - b);
    const highTicketCutoff = ticketsArr[Math.floor(ticketsArr.length * 0.75)] || 0;
    const anchorMap = new Map<string, { count: number; revenue: number }>();
    const pairsMap = new Map<string, number>();
    validOrders.forEach((o) => {
      const items: any[] = (o as any)._items || [];
      const isHigh = (o.net_revenue || o.total_paid || 0) >= highTicketCutoff;
      const seen = new Set<string>();
      items.forEach((it) => {
        const name = it.product_name || it.sku;
        if (!name || seen.has(name)) return;
        seen.add(name);
        if (isHigh) {
          const cur = anchorMap.get(name) || { count: 0, revenue: 0 };
          cur.count += 1;
          cur.revenue += it.total || 0;
          anchorMap.set(name, cur);
        }
      });
      const sorted = [...seen].sort();
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const k = `${sorted[i]}||${sorted[j]}`;
          pairsMap.set(k, (pairsMap.get(k) || 0) + 1);
        }
      }
    });
    const anchor: AnchorStats = {
      anchors: [...anchorMap.entries()]
        .map(([name, v]) => ({ name, appearances_high_ticket: v.count, revenue: v.revenue }))
        .sort((a, b) => b.appearances_high_ticket - a.appearances_high_ticket)
        .slice(0, 15),
      pairs: [...pairsMap.entries()]
        .map(([k, count]) => {
          const [a, b] = k.split("||");
          return { a, b, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    };

    // Cancellations
    const cancelled = orders.filter((o) => (o.status || "").toLowerCase() === "cancelled");
    const byDayMap = new Map<string, { count: number; value: number }>();
    cancelled.forEach((o) => {
      const k = o.order_date;
      const cur = byDayMap.get(k) || { count: 0, value: 0 };
      cur.count += 1;
      cur.value += o.total_paid || 0;
      byDayMap.set(k, cur);
    });
    const cancellations: CancellationStats = {
      count: cancelled.length,
      value: cancelled.reduce((a, o) => a + (o.total_paid || 0), 0),
      by_day: [...byDayMap.entries()].map(([date, v]) => ({ date, ...v })),
      recent: cancelled.slice(0, 10).map((o) => ({
        id: o.order_id,
        date: o.order_date,
        value: o.total_paid || 0,
        customer: o.customer_name,
      })),
    };

    // Channel recurrence
    const byChannel = new Map<string, { customers: Set<string>; orders: number; repurchasers: Set<string> }>();
    const customerChannelOrders = new Map<string, Map<string, number>>();
    validOrders.forEach((o) => {
      const ch = o.sales_channel || "unknown";
      if (!byChannel.has(ch)) byChannel.set(ch, { customers: new Set(), orders: 0, repurchasers: new Set() });
      const slot = byChannel.get(ch)!;
      slot.customers.add(o.customer_id);
      slot.orders += 1;
      if (!customerChannelOrders.has(ch)) customerChannelOrders.set(ch, new Map());
      const m = customerChannelOrders.get(ch)!;
      m.set(o.customer_id, (m.get(o.customer_id) || 0) + 1);
    });
    customerChannelOrders.forEach((m, ch) => {
      m.forEach((cnt, cid) => {
        if (cnt >= 2) byChannel.get(ch)!.repurchasers.add(cid);
      });
    });
    const channelRecurrence: ChannelRecurrenceStats = {
      by_channel: [...byChannel.entries()]
        .map(([channel, v]) => ({
          channel,
          customers: v.customers.size,
          repurchase_rate: v.customers.size ? v.repurchasers.size / v.customers.size : 0,
          avg_orders: v.customers.size ? v.orders / v.customers.size : 0,
        }))
        .sort((a, b) => b.customers - a.customers),
    };

    return {
      executive,
      inactiveBuckets,
      inactiveList,
      staleProducts,
      clusters,
      trendSeries,
      behaviorChange: behaviorChange.slice(0, 15),
      repurchase,
      pareto,
      basket,
      seasonality,
      anchor,
      cancellations,
      channelRecurrence,
    };
  }, [orders, customers, products, preset, custom?.start, custom?.end]);
};
