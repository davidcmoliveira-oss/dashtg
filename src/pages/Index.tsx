import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { WebhookConfig } from "@/components/dashboard/WebhookConfig";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  TrendingUp
} from "lucide-react";

// Mock data - será substituído pelos dados reais da API
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

const mockOrders = [
  { id: 'ORD-2024-1234', cliente: 'Maria Silva', valor: 1250.00, status: 'concluido' as const, data: '09/12/2024 14:32' },
  { id: 'ORD-2024-1235', cliente: 'João Santos', valor: 890.50, status: 'processando' as const, data: '09/12/2024 13:45' },
  { id: 'ORD-2024-1236', cliente: 'Ana Costa', valor: 2340.00, status: 'pendente' as const, data: '09/12/2024 12:18' },
  { id: 'ORD-2024-1237', cliente: 'Pedro Oliveira', valor: 567.80, status: 'concluido' as const, data: '09/12/2024 11:05' },
  { id: 'ORD-2024-1238', cliente: 'Carla Mendes', valor: 1890.00, status: 'cancelado' as const, data: '09/12/2024 10:22' },
];

const Index = () => {
  const [activeItem, setActiveItem] = useState("dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(new Date());
  const [apiConfig, setApiConfig] = useState<{ apiUrl: string; apiKey: string } | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulating data refresh
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  const handleSaveConfig = (config: { apiUrl: string; apiKey: string }) => {
    setApiConfig(config);
  };

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
          <p className="text-muted-foreground">Visão geral dos dados do seu ERP</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Receita Total"
            value="R$ 328.500"
            change={12.5}
            changeLabel="vs mês anterior"
            icon={DollarSign}
            delay={0}
          />
          <StatCard
            title="Pedidos"
            value="1.248"
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
        <RecentOrders orders={mockOrders} />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      
      <div className="pl-64">
        <Header 
          onRefresh={handleRefresh} 
          isRefreshing={isRefreshing}
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
