import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { WebhookConfig } from "@/components/dashboard/WebhookConfig";
import { SalesView } from "@/components/dashboard/SalesView";
import { CustomersView } from "@/components/dashboard/CustomersView";
import { ReportsView } from "@/components/dashboard/ReportsView";
import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { useTinyOrders } from "@/hooks/useTinyOrders";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp,
} from "lucide-react";

const Index = () => {
  const [activeItem, setActiveItem] = useState("dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [apiConfig, setApiConfig] = useState<{ apiUrl: string; apiKey: string } | null>(null);
  
  const { orders, isLoading, error, fetchOrders } = useTinyOrders();
  const { toast } = useToast();

  // Buscar pedidos ao carregar
  useEffect(() => {
    fetchOrders().then(() => {
      setLastUpdate(new Date());
    });
  }, [fetchOrders]);

  // Mostrar erro se houver
  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar pedidos",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setLastUpdate(new Date());
    setIsRefreshing(false);
    toast({
      title: "Dados atualizados",
      description: "Os pedidos foram sincronizados com o Tiny ERP.",
    });
  };

  const handleSaveConfig = (config: { apiUrl: string; apiKey: string }) => {
    setApiConfig(config);
  };

  // Calcular estatísticas reais dos pedidos
  const totalRevenue = orders.reduce((sum, order) => sum + order.valor, 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(orders.map(o => o.cliente)).size;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Gerar dados para gráfico de receita baseado nos pedidos
  const revenueChartData = (() => {
    const monthMap = new Map<string, number>();
    orders.forEach(order => {
      // Extrair mês da data (formato dd/mm/yyyy)
      const parts = order.data.split('/');
      if (parts.length >= 2) {
        const month = parts[1];
        const monthNames: Record<string, string> = {
          '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
          '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
          '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
        };
        const monthName = monthNames[month] || month;
        monthMap.set(monthName, (monthMap.get(monthName) || 0) + order.valor);
      }
    });
    
    return Array.from(monthMap.entries()).map(([name, receita]) => ({
      name,
      receita,
      custos: Math.round(receita * 0.6) // Estimativa de custos
    }));
  })();

  const renderContent = () => {
    switch (activeItem) {
      case "webhooks":
        return (
          <div className="max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">API & Webhooks</h1>
              <p className="text-muted-foreground">Configure a integração com seu ERP</p>
            </div>
            <WebhookConfig onSave={handleSaveConfig} currentConfig={apiConfig || undefined} />
          </div>
        );
      
      case "sales":
        return <SalesView orders={orders} isLoading={isLoading} />;
      
      case "customers":
        return <CustomersView orders={orders} isLoading={isLoading} />;
      
      case "reports":
        return <ReportsView orders={orders} isLoading={isLoading} />;
      
      case "analytics":
        return <AnalyticsView orders={orders} isLoading={isLoading} />;
      
      case "settings":
        return (
          <div className="max-w-2xl animate-slide-up">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Configurações</h1>
              <p className="text-muted-foreground">Gerencie as configurações do dashboard</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Informações do Sistema</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Versão</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Integração</span>
                  <span className="font-medium text-success">Tiny ERP (Ativo)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Última sincronização</span>
                  <span className="font-medium">{lastUpdate?.toLocaleString('pt-BR') || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Visão geral dos dados do Tiny ERP</p>
            </div>

            {/* Stats Grid */}
            <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Receita Total"
                value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                change={0}
                changeLabel="período atual"
                icon={DollarSign}
                delay={0}
              />
              <StatCard
                title="Pedidos"
                value={totalOrders.toString()}
                change={0}
                changeLabel="período atual"
                icon={ShoppingCart}
                delay={50}
              />
              <StatCard
                title="Clientes Únicos"
                value={uniqueCustomers.toString()}
                change={0}
                changeLabel="período atual"
                icon={Users}
                delay={100}
              />
              <StatCard
                title="Ticket Médio"
                value={`R$ ${averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                change={0}
                changeLabel="período atual"
                icon={TrendingUp}
                delay={150}
              />
            </div>

            {/* Chart */}
            <div className="mb-8">
              <RevenueChart data={revenueChartData.length > 0 ? revenueChartData : [{ name: 'Sem dados', receita: 0, custos: 0 }]} />
            </div>

            {/* Recent Orders */}
            <RecentOrders orders={orders} isLoading={isLoading} />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      
      <div className="pl-64">
        <Header 
          onRefresh={handleRefresh} 
          isRefreshing={isRefreshing || isLoading}
          lastUpdate={lastUpdate}
        />
        
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
