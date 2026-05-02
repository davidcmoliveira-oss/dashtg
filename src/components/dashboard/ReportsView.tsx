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
import { CrossSellReport } from "./reports/CrossSellReport";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, BarChart3, Users, Package, Activity, Brain } from "lucide-react";

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
        <p className="text-muted-foreground">
          Painel executivo de decisão — {analytics.executive.range.label} vs {analytics.executive.range.prevLabel}
        </p>
      </div>

      <Tabs defaultValue="cross-sell" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/40 p-1">
          <TabsTrigger value="executive" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Visão Executiva
          </TabsTrigger>
          <TabsTrigger value="cross-sell" className="gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Cross-sell
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5">
            <Users className="h-4 w-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1.5">
            <Activity className="h-4 w-4" /> Comportamento
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Brain className="h-4 w-4" /> IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive" className="space-y-6 mt-4">
          <ReportsExecutivePanel
            block={analytics.executive}
            preset={preset}
            onPresetChange={setPreset}
          />
          <RevenueConcentrationReport data={analytics.pareto} />
        </TabsContent>

        <TabsContent value="cross-sell" className="mt-4">
          <CrossSellReport
            productList={analytics.productList}
            customers={customers}
            getRelatedBySku={analytics.getRelatedBySku}
            getRecommendationsForCustomer={analytics.getRecommendationsForCustomer}
          />
        </TabsContent>

        <TabsContent value="customers" className="space-y-6 mt-4">
          <InactiveCustomersReport
            buckets={analytics.inactiveBuckets}
            customers={analytics.inactiveList}
          />
          <CustomerClustersReport clusters={analytics.clusters} />
          <RepurchaseReport data={analytics.repurchase} />
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-4">
          <StaleProductsReport products={analytics.staleProducts} />
          <AnchorProductsReport data={analytics.anchor} />
          <BasketByCategoryReport data={analytics.basket} />
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6 mt-4">
          <CustomerTrendsReport
            trendSeries={analytics.trendSeries}
            behaviorChange={analytics.behaviorChange}
          />
          <SeasonalityReport data={analytics.seasonality} />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiCustomReport snapshot={aiSnapshot} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
