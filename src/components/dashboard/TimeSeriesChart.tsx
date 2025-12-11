import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TimeSeriesData } from "@/types/dashboard";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  isLoading: boolean;
  title?: string;
}

export const TimeSeriesChart = ({ data, isLoading, title = "Receita ao Longo do Tempo" }: TimeSeriesChartProps) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metric, setMetric] = useState<'value' | 'items'>('value');

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="text-sm font-medium mb-1">{label}</p>
          <p className="text-sm text-primary">
            {metric === 'value' ? formatCurrency(payload[0].value) : `${payload[0].value} itens`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button
              variant={metric === 'value' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setMetric('value')}
            >
              Valor
            </Button>
            <Button
              variant={metric === 'items' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setMetric('items')}
            >
              Itens
            </Button>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button
              variant={chartType === 'area' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setChartType('area')}
            >
              Área
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setChartType('bar')}
            >
              Barras
            </Button>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={metric === 'value' ? (v) => `R$${(v / 1000).toFixed(0)}k` : undefined}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorMetric)"
                />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={metric === 'value' ? (v) => `R$${(v / 1000).toFixed(0)}k` : undefined}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={metric}
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
