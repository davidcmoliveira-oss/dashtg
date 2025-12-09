import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  cliente: string;
  valor: number;
  status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
  data: string;
}

interface RecentOrdersProps {
  orders: Order[];
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  processando: { label: 'Processando', className: 'bg-primary/10 text-primary border-primary/20' },
  concluido: { label: 'Concluído', className: 'bg-success/10 text-success border-success/20' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const RecentOrders = ({ orders }: RecentOrdersProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pedidos Recentes</h3>
          <p className="text-sm text-muted-foreground">Últimas transações do ERP</p>
        </div>
        <button className="text-sm font-medium text-primary hover:underline">
          Ver todos
        </button>
      </div>

      <div className="space-y-4">
        {orders.map((order, index) => (
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
        ))}
      </div>
    </div>
  );
};
