import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
  id: string;
  cliente: string;
  valor: number;
  status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
  data: string;
}

interface RecentOrdersProps {
  orders: Order[];
  isLoading?: boolean;
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  processando: { label: 'Processando', className: 'bg-primary/10 text-primary border-primary/20' },
  concluido: { label: 'Concluído', className: 'bg-success/10 text-success border-success/20' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const OrderSkeleton = () => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
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
);

export const RecentOrders = ({ orders, isLoading }: RecentOrdersProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pedidos Recentes</h3>
          <p className="text-sm text-muted-foreground">Últimos pedidos do Tiny ERP</p>
        </div>
        <button className="text-sm font-medium text-primary hover:underline">
          Ver todos
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        ) : (
          orders.slice(0, 5).map((order) => (
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
                <span className="font-semibold">
                  R$ {order.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
