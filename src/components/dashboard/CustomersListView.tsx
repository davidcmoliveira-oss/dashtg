import { useState, useMemo } from "react";
import { Search, Users, UserCheck, TrendingUp, ShoppingBag, Package, Clock, RotateCcw, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerData, TinyOrder } from "@/types/dashboard";
import { MetricTooltip } from "./MetricTooltip";
import { AiInsightsPanel } from "./AiInsightsPanel";
import { NewVsReturningChart } from "./NewVsReturningChart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface CustomersListViewProps {
  customers: CustomerData[];
  orders: TinyOrder[];
  allOrders: TinyOrder[];
  isLoading: boolean;
  onCustomerClick: (customerId: string) => void;
}

export const CustomersListView = ({ customers, orders, allOrders, isLoading, onCustomerClick }: CustomersListViewProps) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'value' | 'orders' | 'items'>('value');
  const itemsPerPage = 20;

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const filteredCustomers = customers
    .filter(c => c.customer_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'orders') return b.total_orders - a.total_orders;
      if (sortBy === 'items') return b.items_count - a.items_count;
      return b.total_spend - a.total_spend;
    });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCustomers = customers.filter(c => c.is_active).length;
  const recurrenceRate = customers.length > 0
    ? (customers.filter(c => c.total_orders > 1).length / customers.length * 100)
    : 0;

  // Aggregated metrics matching customer detail cards
  const avgTicketGeral = useMemo(() => {
    if (customers.length === 0) return 0;
    return customers.reduce((s, c) => s + c.avg_ticket, 0) / customers.length;
  }, [customers]);

  const totalRevenue = useMemo(() => {
    return customers.reduce((s, c) => s + c.total_spend, 0);
  }, [customers]);

  const totalOrders = useMemo(() => {
    return customers.reduce((s, c) => s + c.total_orders, 0);
  }, [customers]);

  const avgItemsPerOrder = useMemo(() => {
    if (customers.length === 0) return 0;
    return customers.reduce((s, c) => s + c.avg_items_per_order, 0) / customers.length;
  }, [customers]);

  const avgDaysSinceLastPurchase = useMemo(() => {
    if (customers.length === 0) return 0;
    return Math.round(customers.reduce((s, c) => s + c.days_since_last_purchase, 0) / customers.length);
  }, [customers]);

  const avgDaysBetweenPurchases = useMemo(() => {
    const withPurchases = customers.filter(c => c.avg_days_between_purchases > 0);
    if (withPurchases.length === 0) return 0;
    return Math.round(withPurchases.reduce((s, c) => s + c.avg_days_between_purchases, 0) / withPurchases.length);
  }, [customers]);

  const topPaymentMethod = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach(c => {
      const m = (c.top_payment_method || '').trim();
      if (!m || m.toLowerCase() === 'não informado' || m.toLowerCase() === 'nao informado') return;
      map.set(m, (map.get(m) || 0) + 1);
    });
    let best = '-';
    let max = 0;
    map.forEach((count, method) => {
      if (count > max) { max = count; best = method; }
    });
    return best;
  }, [customers]);

  // Charts data from orders (same as customer detail)
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(dateStr);
  };

  const timeSeriesData = useMemo(() => {
    const map = new Map<string, { value: number; items: number }>();
    orders.forEach(o => {
      const existing = map.get(o.order_date) || { value: 0, items: 0 };
      existing.value += o.total_paid;
      existing.items += o.items_count;
      map.set(o.order_date, existing);
    });
    return Array.from(map.entries())
      .map(([date, d]) => ({ date, value: d.value, items: d.items }))
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  }, [orders]);

  const dayOfWeekData = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      day: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i],
      value: 0,
      revenue: 0,
    }));
    orders.forEach(o => {
      const d = parseDate(o.order_date);
      data[d.getDay()].value++;
      data[d.getDay()].revenue += o.total_paid;
    });
    return data;
  }, [orders]);

  const dayOfMonthData = useMemo(() => {
    const data = Array.from({ length: 31 }, (_, i) => ({ day: i + 1, value: 0, revenue: 0 }));
    orders.forEach(o => {
      const idx = parseDate(o.order_date).getDate() - 1;
      if (idx >= 0 && idx < 31) { data[idx].value++; data[idx].revenue += o.total_paid; }
    });
    return data;
  }, [orders]);

  const hasTimeData = orders.some(o => !!o.order_time);
  const hourBuckets = useMemo(() => {
    const buckets = [
      { hour: '00h-03h', count: 0 }, { hour: '03h-06h', count: 0 },
      { hour: '06h-09h', count: 0 }, { hour: '09h-12h', count: 0 },
      { hour: '12h-15h', count: 0 }, { hour: '15h-18h', count: 0 },
      { hour: '18h-21h', count: 0 }, { hour: '21h-24h', count: 0 },
    ];
    orders.forEach(o => {
      if (o.order_time) {
        const h = parseInt(o.order_time.split(':')[0], 10);
        if (!isNaN(h)) buckets[Math.min(Math.floor(h / 3), 7)].count++;
      }
    });
    return buckets;
  }, [orders]);

  const categoryData = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    orders.forEach(o => {
      const items = ((o as any)._items || []) as Array<{ categoria?: string; total?: number }>;
      if (items.length > 0) {
        items.forEach(item => {
          const category = item.categoria || o.product_category;
          const e = map.get(category) || { value: 0, count: 0 };
          map.set(category, { value: e.value + (Number(item.total) || 0), count: e.count + 1 });
        });
        return;
      }
      const e = map.get(o.product_category) || { value: 0, count: 0 };
      map.set(o.product_category, { value: e.value + o.total_paid, count: e.count + 1 });
    });
    return Array.from(map.entries()).map(([name, d]) => ({ name, value: d.value, count: d.count }));
  }, [orders]);

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
      {/* Top 3 Stats */}
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

      {/* 7 Detail Cards (same as customer detail) */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Ticket Médio Geral: média do ticket médio de todos os clientes no período." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs">Ticket Médio</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(avgTicketGeral)}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Total Gasto: soma de todos os valores pagos por todos os clientes no período." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="text-xs">Total Gasto</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Quantidade de Pedidos: número total de pedidos faturados de todos os clientes no período." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs">Qtd Pedidos</span>
          </div>
          <p className="text-lg font-bold">{totalOrders}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Média de Itens por Pedido: média geral de itens por pedido entre todos os clientes." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs">Média Itens/Pedido</span>
          </div>
          <p className="text-lg font-bold">{avgItemsPerOrder.toFixed(1)}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Média de dias desde a última compra entre todos os clientes. Indica o quão recente é a base." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs">Dias s/ Compra (média)</span>
          </div>
          <p className="text-lg font-bold">{avgDaysSinceLastPurchase}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Média de dias entre compras: média geral dos intervalos entre pedidos consecutivos de todos os clientes." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            <span className="text-xs">Média Dias entre Compras</span>
          </div>
          <p className="text-lg font-bold">{avgDaysBetweenPurchases || '-'}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <MetricTooltip description="Pagamento Mais Usado: forma de pagamento mais frequente entre todos os clientes (moda)." />
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs">Pagamento Mais Usado</span>
          </div>
          <p className="text-sm font-bold truncate">{topPaymentMethod}</p>
        </div>
      </div>

      {/* AI Insights */}
      <AiInsightsPanel defaultPrompt={aiDefaultPrompt} contextData={aiContextData} />

      {/* Clientes Novos vs Recorrentes */}
      <NewVsReturningChart orders={orders} allOrders={allOrders} />

      {/* Charts (same as customer detail) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time Series */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Histórico de Compras</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorValueCust" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#colorValueCust)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day of Week */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Heatmap - Dias da Semana</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [
                    name === 'value' ? `${value} pedidos` : formatCurrency(value),
                    name === 'value' ? 'Quantidade' : 'Receita'
                  ]}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day of Month */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Heatmap - Dias do Mês</h3>
          <div className="grid grid-cols-7 gap-1">
            {dayOfMonthData.map(d => (
              <div
                key={d.day}
                className="aspect-square flex items-center justify-center text-xs rounded"
                style={{
                  backgroundColor: d.value > 0
                    ? `hsl(var(--primary) / ${Math.min(0.2 + (d.value / Math.max(...dayOfMonthData.map(x => x.value), 1)) * 0.8, 1)})`
                    : 'hsl(var(--secondary))',
                }}
                title={`Dia ${d.day}: ${d.value} pedidos, ${formatCurrency(d.revenue)}`}
              >
                {d.day}
              </div>
            ))}
          </div>
        </div>

        {/* Hour Histogram */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Distribuição por Horário (buckets 3h)</h3>
          <div className="h-[200px]">
            {hasTimeData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourBuckets}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <Clock className="w-4 h-4 mr-2" />
                Horário não disponível nos dados
              </div>
            )}
          </div>
        </div>

        {/* Categories by value */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Categorias (por valor)</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories by count */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Categorias (por quantidade)</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Ranking de Clientes</h3>
          <div className="flex gap-1">
            <Button variant={sortBy === 'value' ? 'default' : 'ghost'} size="sm" onClick={() => { setSortBy('value'); setCurrentPage(1); }}>Por valor</Button>
            <Button variant={sortBy === 'orders' ? 'default' : 'ghost'} size="sm" onClick={() => { setSortBy('orders'); setCurrentPage(1); }}>Por pedidos</Button>
            <Button variant={sortBy === 'items' ? 'default' : 'ghost'} size="sm" onClick={() => { setSortBy('items'); setCurrentPage(1); }}>Por itens</Button>
          </div>
        </div>

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
