import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar } from "lucide-react";

interface Order {
  id: string;
  cliente: string;
  valor: number;
  status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
  data: string;
}

interface SalesViewProps {
  orders: Order[];
  isLoading?: boolean;
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  processando: { label: 'Processando', className: 'bg-primary/10 text-primary border-primary/20' },
  concluido: { label: 'Concluído', className: 'bg-success/10 text-success border-success/20' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const SalesView = ({ orders, isLoading }: SalesViewProps) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.valor, 0);
  const completedOrders = orders.filter(o => o.status === 'concluido');
  const pendingOrders = orders.filter(o => o.status === 'pendente' || o.status === 'processando');
  const averageTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">Acompanhe todas as vendas do Tiny ERP</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Total de Vendas</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Pedidos Concluídos</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : completedOrders.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Pedidos Pendentes</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : pendingOrders.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Ticket Médio</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Todos os Pedidos</h3>
        
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido encontrado
            </div>
          ) : (
            orders.map((order) => (
              <div 
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                    #{order.id.slice(-4)}
                  </div>
                  <div>
                    <p className="font-medium">{order.cliente}</p>
                    <p className="text-sm text-muted-foreground">{order.data}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className={cn("border", statusConfig[order.status].className)}>
                    {statusConfig[order.status].label}
                  </Badge>
                  <span className="font-semibold min-w-[100px] text-right">
                    R$ {order.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
