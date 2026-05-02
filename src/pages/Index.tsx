import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { KPICards } from "@/components/dashboard/KPICards";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { TopItemsCards } from "@/components/dashboard/TopItemsCards";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { CustomersListView } from "@/components/dashboard/CustomersListView";
import { CustomerDetailView } from "@/components/dashboard/CustomerDetailView";
import { ProductsView } from "@/components/dashboard/ProductsView";
import { WebhookConfig } from "@/components/dashboard/WebhookConfig";
import { ReportsView } from "@/components/dashboard/ReportsView";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const [activeItem, setActiveItem] = useState("dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<{ apiUrl: string; apiKey: string } | null>(null);

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const {
    orders,
    allOrders,
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
    fetchOrders,
    triggerSync,
    lastSyncTime,
  } = useDashboardData();

  // No need to fetch on filter change - data is already loaded from cache
  // Filters are applied client-side via useMemo in useDashboardData
  useEffect(() => {
    if (lastSyncTime) {
      setLastUpdate(lastSyncTime);
    }
  }, [lastSyncTime]);

  useEffect(() => {
    if (error) {
      toast.error("Erro ao carregar dados", { description: error });
    }
  }, [error]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Em paralelo (não bloqueia): catálogo completo de produtos + backfill de detalhes faltantes
    const productsAllPromise = supabase.functions.invoke('tiny-products-sync', { body: { mode: 'all', maxPages: 25, limit: 100 } })
      .then(({ data }) => {
        if (data?.products_cached > 0 || data?.categories_enriched > 0) {
          toast.success(`Catálogo: ${data.products_cached || 0} produtos, ${data.categories_enriched || 0} categorias`);
        }
      })
      .catch(() => { /* silencioso */ });

    const backfillPromise = supabase.functions.invoke('tiny-sync', { body: { mode: 'backfill', limit: 200 } })
      .then(({ data }) => {
        if (data?.fetched > 0) {
          toast.success(`${data.fetched} detalhes de pedidos antigos sincronizados`);
        }
      })
      .catch(() => { /* silencioso */ });

    await triggerSync('incremental');
    // aguarda também os paralelos para recarregar com tudo
    await Promise.allSettled([productsAllPromise, backfillPromise]);
    setLastUpdate(new Date());
    setIsRefreshing(false);
    toast.success("Dados sincronizados", { description: "Dashboard atualizado com sucesso." });
  };

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveItem("customer-detail");
  };

  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const dashboardAiContext = useMemo(() => ({
    receita_total: kpis.total_revenue,
    num_pedidos: kpis.total_orders,
    ticket_medio: kpis.avg_ticket,
    clientes_unicos: kpis.unique_customers,
    top_produtos: products.slice(0, 5).map(p => ({ nome: p.product_name, receita: p.total_revenue, qtd: p.total_qty })),
    top_clientes: customers.slice(0, 5).map(c => ({ nome: c.customer_name, gasto: c.total_spend, pedidos: c.total_orders })),
  }), [kpis, products, customers]);

  const dashboardAiPrompt = `Analise os indicadores do dashboard: receita total ${formatCurrency(kpis.total_revenue)}, ${kpis.total_orders} pedidos, ticket médio ${formatCurrency(kpis.avg_ticket)}, ${kpis.unique_customers} clientes únicos. Identifique padrões, oportunidades e riscos.`;

  const productsAiContext = useMemo(() => ({
    total_produtos: products.length,
    classe_a: products.filter(p => p.abc_class === 'A').length,
    classe_b: products.filter(p => p.abc_class === 'B').length,
    classe_c: products.filter(p => p.abc_class === 'C').length,
    sem_venda_30d: products.filter(p => p.days_without_sale >= 30).length,
    top_10: products.slice(0, 10).map(p => ({ nome: p.product_name, receita: p.total_revenue, qtd: p.total_qty, classe: p.abc_class })),
  }), [products]);

  const productsAiPrompt = `Analise os indicadores de produtos: ${products.length} produtos, ${products.filter(p => p.abc_class === 'A').length} classe A, ${products.filter(p => p.abc_class === 'B').length} classe B, ${products.filter(p => p.abc_class === 'C').length} classe C, ${products.filter(p => p.days_without_sale >= 30).length} sem venda há 30+ dias. Identifique oportunidades e riscos.`;

  const renderContent = () => {
    if (activeItem === "customer-detail" && selectedCustomerId) {
      return (
        <CustomerDetailView
          customer={selectedCustomer || null}
          isLoading={isLoading}
          onBack={() => {
            setSelectedCustomerId(null);
            setActiveItem("customers");
          }}
        />
      );
    }

    switch (activeItem) {
      case "webhooks":
        return (
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">API & Webhooks</h1>
              <p className="text-muted-foreground">Configure a integração com seu ERP</p>
            </div>
            <WebhookConfig onSave={setApiConfig} currentConfig={apiConfig || undefined} />
          </div>
        );

      case "customers":
        return (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Clientes</h1>
              <p className="text-muted-foreground">Gestão e análise de clientes</p>
            </div>
            <GlobalFilters filters={filters} onFiltersChange={setFilters} filterOptions={filterOptions} />
            <CustomersListView
              customers={customers}
              orders={orders}
              allOrders={allOrders}
              isLoading={isLoading}
              onCustomerClick={handleCustomerClick}
            />
          </div>
        );

      case "products":
        return (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Produtos</h1>
              <p className="text-muted-foreground">Análise de produtos e Curva ABC</p>
            </div>
            <GlobalFilters filters={filters} onFiltersChange={setFilters} filterOptions={filterOptions} />
            <ProductsView
              products={products}
              orders={orders}
              isLoading={isLoading}
              onCustomerClick={handleCustomerClick}
            />
            <div className="mt-6">
              <AiInsightsPanel defaultPrompt={productsAiPrompt} contextData={productsAiContext} />
            </div>
          </div>
        );

      case "reports":
        return (
          <div className="animate-slide-up">
            <ReportsView
              orders={orders}
              customers={customers}
              products={products}
              isLoading={isLoading}
            />
          </div>
        );

      case "settings":
        return (
          <div className="max-w-2xl animate-slide-up">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Configurações</h1>
              <p className="text-muted-foreground">Gerencie as configurações do dashboard</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Informações do Sistema</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Versão</span>
                    <span className="font-medium">2.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Integração</span>
                    <span className="font-medium text-accent">Tiny ERP (Ativo)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Última sincronização</span>
                    <span className="font-medium">{lastUpdate?.toLocaleString('pt-BR') || '-'}</span>
                  </div>
                </div>
              </div>
              <Link to="/backup">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para versão anterior
                </Button>
              </Link>
            </div>
          </div>
        );

      default:
        return (
          <div className="animate-slide-up">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Visão geral do Tiny ERP • Timezone: America/Sao_Paulo</p>
            </div>
            <GlobalFilters filters={filters} onFiltersChange={setFilters} filterOptions={filterOptions} />
            <KPICards kpis={kpis} sparklineData={timeSeriesData} isLoading={isLoading} />
            <TimeSeriesChart data={timeSeriesData} isLoading={isLoading} />
            <TopItemsCards orders={orders} customers={customers} products={products} isLoading={isLoading} onCustomerClick={handleCustomerClick} />
            <AiInsightsPanel defaultPrompt={dashboardAiPrompt} contextData={dashboardAiContext} />
            <div className="mt-6">
              <OrdersTable orders={orders} isLoading={isLoading} onCustomerClick={handleCustomerClick} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      <div className="pl-64">
        <Header onRefresh={handleRefresh} isRefreshing={isRefreshing || isLoading} lastUpdate={lastUpdate} />
        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Index;
