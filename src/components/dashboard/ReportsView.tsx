import { FileText, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
  id: string;
  cliente: string;
  valor: number;
  status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
  data: string;
}

interface ReportsViewProps {
  orders: Order[];
  isLoading?: boolean;
}

export const ReportsView = ({ orders, isLoading }: ReportsViewProps) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.valor, 0);
  const completedOrders = orders.filter(o => o.status === 'concluido');
  const cancelledOrders = orders.filter(o => o.status === 'cancelado');
  const pendingOrders = orders.filter(o => o.status === 'pendente' || o.status === 'processando');
  
  const completedRevenue = completedOrders.reduce((sum, order) => sum + order.valor, 0);
  const cancelledRevenue = cancelledOrders.reduce((sum, order) => sum + order.valor, 0);
  const pendingRevenue = pendingOrders.reduce((sum, order) => sum + order.valor, 0);

  const taxaConclusao = orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0;
  const taxaCancelamento = orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Análise detalhada dos dados do Tiny ERP</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Receita Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? <Skeleton className="h-8 w-24" /> : `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm">Total de Pedidos</span>
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-16" /> : orders.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm">Taxa de Conclusão</span>
          </div>
          <p className="text-2xl font-bold text-success">
            {isLoading ? <Skeleton className="h-8 w-16" /> : `${taxaConclusao.toFixed(1)}%`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-sm">Taxa de Cancelamento</span>
          </div>
          <p className="text-2xl font-bold text-destructive">
            {isLoading ? <Skeleton className="h-8 w-16" /> : `${taxaCancelamento.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Resumo por Situação</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium text-success">Concluídos</p>
                <p className="text-sm text-muted-foreground">{completedOrders.length} pedidos</p>
              </div>
              <p className="text-lg font-bold text-success">
                R$ {completedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div>
                <p className="font-medium text-warning">Pendentes</p>
                <p className="text-sm text-muted-foreground">{pendingOrders.length} pedidos</p>
              </div>
              <p className="text-lg font-bold text-warning">
                R$ {pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div>
                <p className="font-medium text-destructive">Cancelados</p>
                <p className="text-sm text-muted-foreground">{cancelledOrders.length} pedidos</p>
              </div>
              <p className="text-lg font-bold text-destructive">
                R$ {cancelledRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Top 5 Clientes</h3>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            ) : (
              (() => {
                const customerTotals = new Map<string, number>();
                orders.forEach(order => {
                  customerTotals.set(order.cliente, (customerTotals.get(order.cliente) || 0) + order.valor);
                });
                return Array.from(customerTotals.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([cliente, total], index) => (
                    <div key={cliente} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <p className="font-medium">{cliente}</p>
                      </div>
                      <p className="font-semibold">
                        R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ));
              })()
            )}
            {!isLoading && orders.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
