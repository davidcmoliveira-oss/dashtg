import { useState, useMemo } from "react";
import { TinyOrder, CustomerData, ProductData } from "@/types/dashboard";
import { useReportsAnalytics, ComparisonPreset } from "@/hooks/useReportsAnalytics";
import { ReportsExecutivePanel } from "./reports/ReportsExecutivePanel";
import { InactiveCustomersReport } from "./reports/InactiveCustomersReport";
import { StaleProductsReport } from "./reports/StaleProductsReport";
import { CustomerClustersReport } from "./reports/CustomerClustersReport";
import { CustomerTrendsReport } from "./reports/CustomerTrendsReport";
import { AiCustomReport } from "./reports/AiCustomReport";
import { RepurchaseReport } from "./reports/RepurchaseReport";
import { RevenueConcentrationReport } from "./reports/RevenueConcentrationReport";
import { BasketByCategoryReport } from "./reports/BasketByCategoryReport";
import { SeasonalityReport } from "./reports/SeasonalityReport";
import { AnchorProductsReport } from "./reports/AnchorProductsReport";
import { CancellationsReport } from "./reports/CancellationsReport";
import { ChannelRecurrenceReport } from "./reports/ChannelRecurrenceReport";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ReportsViewProps {
  orders: TinyOrder[];
  customers: CustomerData[];
  products: ProductData[];
  isLoading?: boolean;
}

export const ReportsView = ({ orders, customers, products, isLoading }: ReportsViewProps) => {
  const [preset, setPreset] = useState<ComparisonPreset>("month_vs_prev");
  const analytics = useReportsAnalytics(orders, customers, products, preset);

  const aiSnapshot = useMemo(() => ({
    period: {
      label: analytics.executive.range.label,
      prevLabel: analytics.executive.range.prevLabel,
      start: analytics.executive.range.start.toISOString(),
      end: analytics.executive.range.end.toISOString(),
    },
    kpis_current: analytics.executive.current,
    kpis_previous: analytics.executive.previous,
    delta: analytics.executive.delta,
    inactive_buckets: analytics.inactiveBuckets,
    top_inactive_customers: analytics.inactiveList.slice(0, 10).map((c) => ({
      name: c.customer_name,
      days_inactive: c.days_inactive,
      total_spend: c.total_spend,
      avg_ticket: c.avg_ticket,
      potential_lost: c.potential_lost,
    })),
    stale_products: analytics.staleProducts.slice(0, 15).map((p) => ({
      name: p.product_name,
      category: p.category,
      days_without_sale: p.days_without_sale,
      level: p.level,
      revenue_total: p.revenue_total,
    })),
    clusters: analytics.clusters.map((cl) => ({
      label: cl.label,
      count: cl.count,
      avg_ticket: cl.avg_ticket,
      total_spend: cl.total_spend,
      top_category: cl.top_category,
      top_payment: cl.top_payment,
    })),
    repurchase: {
      rate: analytics.repurchase.rate,
      avg_days_to_second: analytics.repurchase.avg_days_to_second,
      avg_repurchase_ticket: analytics.repurchase.avg_repurchase_ticket,
    },
    revenue_concentration: {
      top10_customers_pct: analytics.pareto.top10_customers_pct,
      top10_products_pct: analytics.pareto.top10_products_pct,
      top_categories: analytics.pareto.by_category.slice(0, 5),
    },
    cancellations: { count: analytics.cancellations.count, value: analytics.cancellations.value },
    behavior_change_top: analytics.behaviorChange.slice(0, 8),
  }), [analytics]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Painel executivo de decisão</p>
      </div>

      <ReportsExecutivePanel
        block={analytics.executive}
        preset={preset}
        onPresetChange={setPreset}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <InactiveCustomersReport
          buckets={analytics.inactiveBuckets}
          customers={analytics.inactiveList}
        />
        <StaleProductsReport products={analytics.staleProducts} />
      </div>

      <CustomerClustersReport clusters={analytics.clusters} />

      <CustomerTrendsReport
        trendSeries={analytics.trendSeries}
        behaviorChange={analytics.behaviorChange}
      />

      <AiCustomReport snapshot={aiSnapshot} />

      <div>
        <h2 className="text-xl font-bold mb-3">Relatórios complementares</h2>
        <Tabs defaultValue="repurchase">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="repurchase">Recompra</TabsTrigger>
            <TabsTrigger value="concentration">Concentração</TabsTrigger>
            <TabsTrigger value="basket">Cesta por categoria</TabsTrigger>
            <TabsTrigger value="channel">Canal × recorrência</TabsTrigger>
            <TabsTrigger value="seasonality">Sazonalidade</TabsTrigger>
            <TabsTrigger value="anchor">Âncoras / kits</TabsTrigger>
            <TabsTrigger value="cancellations">Cancelamentos</TabsTrigger>
          </TabsList>
          <TabsContent value="repurchase" className="mt-4"><RepurchaseReport data={analytics.repurchase} /></TabsContent>
          <TabsContent value="concentration" className="mt-4"><RevenueConcentrationReport data={analytics.pareto} /></TabsContent>
          <TabsContent value="basket" className="mt-4"><BasketByCategoryReport data={analytics.basket} /></TabsContent>
          <TabsContent value="channel" className="mt-4"><ChannelRecurrenceReport data={analytics.channelRecurrence} /></TabsContent>
          <TabsContent value="seasonality" className="mt-4"><SeasonalityReport data={analytics.seasonality} /></TabsContent>
          <TabsContent value="anchor" className="mt-4"><AnchorProductsReport data={analytics.anchor} /></TabsContent>
          <TabsContent value="cancellations" className="mt-4"><CancellationsReport data={analytics.cancellations} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
