import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { WebhookConfig } from "@/components/dashboard/WebhookConfig";
import { useTinyOrders } from "@/hooks/useTinyOrders";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
} from "lucide-react";

// Mock data para gráficos (será substituído quando tivermos mais endpoints)
const mockRevenueData = [
  { name: 'Jul', receita: 45000, custos: 28000 },
  { name: 'Ago', receita: 52000, custos: 31000 },
  { name: 'Set', receita: 48000, custos: 29000 },
  { name: 'Out', receita: 61000, custos: 35000 },
  { name: 'Nov', receita: 55000, custos: 32000 },
  { name: 'Dez', receita: 67000, custos: 38000 },
];

const mockSalesData = [
  { name: 'Eletrônicos', vendas: 245 },
  { name: 'Vestuário', vendas: 189 },
  { name: 'Alimentos', vendas: 312 },
  { name: 'Casa & Jardim', vendas: 156 },
  { name: 'Esportes', vendas: 98 },
];

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

  // Calcular estatísticas dos pedidos
  const totalRevenue = orders.reduce((sum, order) => sum + order.valor, 0);
  const totalOrders = orders.length;

  const renderContent = () => {
    if (activeItem === "webhooks") {
      return (
        <div className="max-w-2xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">API & Webhooks</h1>
            <p className="text-muted-foreground">Configure a integração com seu ERP</p>
          </div>
          <WebhookConfig onSave={handleSaveConfig} currentConfig={apiConfig || undefined} />
        </div>
      );
    }

    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos dados do seu ERP - Tiny</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Receita Total"
            value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            change={12.5}
            changeLabel="vs mês anterior"
            icon={DollarSign}
            delay={0}
          />
          <StatCard
            title="Pedidos"
            value={totalOrders.toString()}
            change={8.2}
            changeLabel="vs mês anterior"
            icon={ShoppingCart}
            delay={50}
          />
          <StatCard
            title="Clientes Ativos"
            value="3.426"
            change={-2.4}
            changeLabel="vs mês anterior"
            icon={Users}
            delay={100}
          />
          <StatCard
            title="Produtos em Estoque"
            value="8.942"
            change={5.1}
            changeLabel="vs mês anterior"
            icon={Package}
            delay={150}
          />
        </div>

        {/* Charts Grid */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <RevenueChart data={mockRevenueData} />
          <SalesChart data={mockSalesData} />
        </div>

        {/* Recent Orders */}
        <RecentOrders orders={orders} isLoading={isLoading} />
      </>
    );
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
