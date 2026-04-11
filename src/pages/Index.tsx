import { useState, useEffect } from "react";
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
import { useDashboardData } from "@/hooks/useDashboardData";
import { useToast } from "@/hooks/use-toast";
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
    customers,
    products,
    kpis,
    timeSeriesData,
    filterOptions,
    filters,
    setFilters,
    isLoading,
    error,
    fetchOrders,
  } = useDashboardData();

  const { toast } = useToast();

  useEffect(() => {
    const today = new Date();

    fetchOrders(formatDate(today), formatDate(today)).then(() => {
      setLastUpdate(new Date());
    });
  }, [fetchOrders]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar dados",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const today = new Date();

    await fetchOrders(formatDate(today), formatDate(today), true);
    setLastUpdate(new Date());
    setIsRefreshing(false);
    toast({
      title: "Dados sincronizados",
      description: "Dashboard atualizado com sucesso.",
    });
  };

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveItem("customer-detail");
  };

  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

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
            <CustomersListView
              customers={customers}
              isLoading={isLoading}
              onCustomerClick={handleCustomerClick}
            />
          </div>
        );

      case "products":
        return (
          <ProductsView
            products={products}
            orders={orders}
            isLoading={isLoading}
            onCustomerClick={handleCustomerClick}
          />
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
            <OrdersTable orders={orders} isLoading={isLoading} onCustomerClick={handleCustomerClick} />
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
