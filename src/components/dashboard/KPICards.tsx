import { DollarSign, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KPIData, TimeSeriesData } from "@/types/dashboard";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { MetricTooltip } from "./MetricTooltip";

interface KPICardsProps {
  kpis: KPIData;
  sparklineData: TimeSeriesData[];
  isLoading: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  sparkline: { value: number }[];
  isLoading: boolean;
  delay?: number;
  tooltip: string;
}

const KPICard = ({ title, value, change, icon: Icon, sparkline, isLoading, delay = 0, tooltip }: KPICardProps) => {
  const isPositive = change >= 0;
  
  return (
    <div 
      className="relative rounded-xl border border-border bg-card p-5 animate-slide-up shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      <MetricTooltip description={tooltip} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          {!isLoading && sparkline.length > 1 && (
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    fill={`url(#gradient-${title})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <>
              <span className={`text-sm font-medium ${isPositive ? 'text-accent' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">vs período anterior</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TOOLTIPS: Record<string, string> = {
  "Receita Total": "Soma do valor total pago (total_paid) de todos os pedidos faturados no período selecionado.",
  "Nº de Pedidos": "Quantidade total de pedidos faturados/confirmados no período. Pedidos cancelados ou pendentes não são contabilizados.",
  "Ticket Médio": "Receita total dividida pelo número de pedidos no período. Indica o valor médio gasto por pedido.",
  "Clientes Únicos": "Quantidade de clientes distintos que realizaram pelo menos um pedido no período selecionado.",
};

export const KPICards = ({ kpis, sparklineData, isLoading }: KPICardsProps) => {
  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const calculateChange = (current: number, prev: number) => {
    if (prev === 0) return 0;
    return ((current - prev) / prev) * 100;
  };

  const cards = [
    {
      title: "Receita Total",
      value: formatCurrency(kpis.total_revenue),
      change: calculateChange(kpis.total_revenue, kpis.prev_total_revenue),
      icon: DollarSign,
    },
    {
      title: "Nº de Pedidos",
      value: kpis.total_orders.toString(),
      change: calculateChange(kpis.total_orders, kpis.prev_total_orders),
      icon: ShoppingCart,
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(kpis.avg_ticket),
      change: calculateChange(kpis.avg_ticket, kpis.prev_avg_ticket),
      icon: TrendingUp,
    },
    {
      title: "Clientes Únicos",
      value: kpis.unique_customers.toString(),
      change: calculateChange(kpis.unique_customers, kpis.prev_unique_customers),
      icon: Users,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {cards.map((card, index) => (
        <KPICard
          key={card.title}
          {...card}
          tooltip={TOOLTIPS[card.title] || ""}
          sparkline={sparklineData.map(d => ({ value: d.value }))}
          isLoading={isLoading}
          delay={index * 50}
        />
      ))}
    </div>
  );
};
