import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
  data: Array<{
    name: string;
    receita: number;
    custos: number;
  }>;
}

export const RevenueChart = ({ data }: RevenueChartProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Receita vs Custos</h3>
          <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-chart-1" />
            <span className="text-sm text-muted-foreground">Receita</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-chart-3" />
            <span className="text-sm text-muted-foreground">Custos</span>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199 89% 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(199 89% 48%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 16%)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222 47% 8%)',
                border: '1px solid hsl(222 47% 16%)',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
              }}
              labelStyle={{ color: 'hsl(210 40% 98%)' }}
              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
            />
            <Area
              type="monotone"
              dataKey="receita"
              stroke="hsl(199 89% 48%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorReceita)"
            />
            <Area
              type="monotone"
              dataKey="custos"
              stroke="hsl(38 92% 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCustos)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
