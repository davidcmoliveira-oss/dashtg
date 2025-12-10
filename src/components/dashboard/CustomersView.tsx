import { Users, UserCheck, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
  id: string;
  cliente: string;
  valor: number;
  status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
  data: string;
}

interface CustomersViewProps {
  orders: Order[];
  isLoading?: boolean;
}

interface CustomerData {
  nome: string;
  totalPedidos: number;
  valorTotal: number;
  ultimoPedido: string;
}

export const CustomersView = ({ orders, isLoading }: CustomersViewProps) => {
  // Agregar dados por cliente
  const customerMap = new Map<string, CustomerData>();
  
  orders.forEach(order => {
    const existing = customerMap.get(order.cliente);
    if (existing) {
      existing.totalPedidos += 1;
      existing.valorTotal += order.valor;
      existing.ultimoPedido = order.data;
    } else {
      customerMap.set(order.cliente, {
        nome: order.cliente,
        totalPedidos: 1,
        valorTotal: order.valor,
        ultimoPedido: order.data,
      });
    }
  });

  const customers = Array.from(customerMap.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  const totalClientes = customers.length;
  const clientesRecorrentes = customers.filter(c => c.totalPedidos > 1).length;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-muted-foreground">Visão geral dos clientes do Tiny ERP</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total de Clientes</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : totalClientes}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <UserCheck className="h-4 w-4" />
            <span className="text-sm">Clientes Recorrentes</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : clientesRecorrentes}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Taxa de Recorrência</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : `${totalClientes > 0 ? Math.round((clientesRecorrentes / totalClientes) * 100) : 0}%`}
          </p>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Ranking de Clientes</h3>
        
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          ) : (
            customers.map((customer, index) => (
              <div 
                key={customer.nome}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}º
                  </div>
                  <div>
                    <p className="font-medium">{customer.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.totalPedidos} pedido{customer.totalPedidos > 1 ? 's' : ''} • Último: {customer.ultimoPedido}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    R$ {customer.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">Total gasto</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
