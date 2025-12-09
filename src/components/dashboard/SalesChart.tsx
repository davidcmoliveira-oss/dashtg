import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
  data: Array<{
    name: string;
    vendas: number;
  }>;
}

export const SalesChart = ({ data }: SalesChartProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Vendas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Distribuição do mês atual</p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 16%)" horizontal={true} vertical={false} />
            <XAxis 
              type="number" 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              stroke="hsl(215 20% 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222 47% 8%)',
                border: '1px solid hsl(222 47% 16%)',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
              }}
              labelStyle={{ color: 'hsl(210 40% 98%)' }}
              formatter={(value: number) => [`${value} unidades`, 'Vendas']}
            />
            <Bar 
              dataKey="vendas" 
              fill="hsl(199 89% 48%)" 
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
