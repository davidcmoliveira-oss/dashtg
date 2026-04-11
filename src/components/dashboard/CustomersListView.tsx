import { useState, useMemo } from "react";
import { Search, Users, UserCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerData } from "@/types/dashboard";
import { MetricTooltip } from "./MetricTooltip";
import { AiInsightsPanel } from "./AiInsightsPanel";

interface CustomersListViewProps {
  customers: CustomerData[];
  isLoading: boolean;
  onCustomerClick: (customerId: string) => void;
}

export const CustomersListView = ({ customers, isLoading, onCustomerClick }: CustomersListViewProps) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCustomers = customers.filter(c => c.is_active).length;
  const recurrenceRate = customers.length > 0
    ? (customers.filter(c => c.total_orders > 1).length / customers.length * 100)
    : 0;

  const avgTicketGeral = useMemo(() => {
    if (customers.length === 0) return 0;
    return customers.reduce((s, c) => s + c.avg_ticket, 0) / customers.length;
  }, [customers]);

  const totalRevenue = useMemo(() => {
    return customers.reduce((s, c) => s + c.total_spend, 0);
  }, [customers]);

  const aiDefaultPrompt = `Analise os indicadores gerais da base de clientes: ${customers.length} clientes totais, ${activeCustomers} ativos, taxa de recorrência ${recurrenceRate.toFixed(1)}%, ticket médio geral ${formatCurrency(avgTicketGeral)}, receita total ${formatCurrency(totalRevenue)}. Identifique padrões, oportunidades e riscos.`;

  const aiContextData = useMemo(() => ({
    total_clientes: customers.length,
    clientes_ativos: activeCustomers,
    taxa_recorrencia: recurrenceRate,
    ticket_medio_geral: avgTicketGeral,
    receita_total: totalRevenue,
    top_10_clientes: customers.slice(0, 10).map(c => ({
      nome: c.customer_name,
      total_gasto: c.total_spend,
      pedidos: c.total_orders,
      ticket_medio: c.avg_ticket,
      dias_sem_compra: c.days_since_last_purchase,
      ativo: c.is_active,
    })),
  }), [customers, activeCustomers, recurrenceRate, avgTicketGeral, totalRevenue]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative rounded-xl border border-border bg-card p-4">
          <MetricTooltip description="Número total de clientes distintos que realizaram pelo menos um pedido no período filtrado." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total de Clientes</span>
          </div>
          <p className="text-2xl font-bold">{customers.length}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4">
          <MetricTooltip description="Cliente ativo: realizou pelo menos uma compra nos últimos 60 dias. Clientes inativos não compraram nesse período." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <UserCheck className="h-4 w-4" />
            <span className="text-sm">Clientes Ativos (60 dias)</span>
          </div>
          <p className="text-2xl font-bold">{activeCustomers}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4">
          <MetricTooltip description="Percentual de clientes que fizeram mais de um pedido. Calculado como: (clientes com 2+ pedidos / total de clientes) × 100." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Taxa de Recorrência</span>
          </div>
          <p className="text-2xl font-bold">{recurrenceRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* AI Insights */}
      <AiInsightsPanel defaultPrompt={aiDefaultPrompt} contextData={aiContextData} />

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      {/* Customers List */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Ranking de Clientes por Valor</h3>

        <div className="space-y-3">
          {paginatedCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          ) : (
            paginatedCustomers.map((customer, index) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50 cursor-pointer"
                onClick={() => onCustomerClick(customer.customer_id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(currentPage - 1) * itemsPerPage + index + 1}º
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{customer.customer_name}</p>
                      <Badge variant={customer.is_active ? "default" : "secondary"} className="text-xs">
                        {customer.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {customer.total_orders} pedido{customer.total_orders > 1 ? 's' : ''} • 
                      Último: {customer.last_order_date} • 
                      {customer.days_since_last_purchase} dias atrás
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(customer.total_spend)}</p>
                  <p className="text-sm text-muted-foreground">
                    Ticket: {formatCurrency(customer.avg_ticket)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} de {filteredCustomers.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
