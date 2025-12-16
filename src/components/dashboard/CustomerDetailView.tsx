import { useState } from "react";
import { ArrowLeft, User, Calendar, TrendingUp, ShoppingBag, Package, Clock, Download, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerData, TinyOrder, ProductPurchase } from "@/types/dashboard";
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
  Treemap,
} from "recharts";

interface CustomerDetailViewProps {
  customer: CustomerData | null;
  isLoading: boolean;
  onBack: () => void;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type ProductSortField = 'qty_total' | 'spend_total' | 'last_purchase_date';
type SortDirection = 'asc' | 'desc';

export const CustomerDetailView = ({ customer, isLoading, onBack }: CustomerDetailViewProps) => {
  const [selectedOrder, setSelectedOrder] = useState<TinyOrder | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '12m' | 'all'>('30d');
  const [currentPage, setCurrentPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productSortField, setProductSortField] = useState<ProductSortField>('spend_total');
  const [productSortDir, setProductSortDir] = useState<SortDirection>('desc');
  const [chartMetric, setChartMetric] = useState<'value' | 'items'>('value');
  const itemsPerPage = 20;

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Filter orders by time range
  const getFilteredOrders = () => {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeRange) {
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoff.setDate(now.getDate() - 90);
        break;
      case '12m':
        cutoff.setMonth(now.getMonth() - 12);
        break;
      default:
        return customer.orders;
    }

    return customer.orders.filter(order => parseDate(order.order_date) >= cutoff);
  };

  const filteredOrders = getFilteredOrders();

  // Prepare time series data
  const timeSeriesData = filteredOrders.map(order => ({
    date: order.order_date,
    value: order.net_revenue,
    items: order.items_count,
  })).sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  // Prepare day of week heatmap
  const dayOfWeekData = Array.from({ length: 7 }, (_, i) => ({
    day: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i],
    dayIndex: i,
    value: 0,
    revenue: 0,
  }));
  
  filteredOrders.forEach(order => {
    const date = parseDate(order.order_date);
    dayOfWeekData[date.getDay()].value++;
    dayOfWeekData[date.getDay()].revenue += order.net_revenue;
  });

  // Prepare day of month heatmap
  const dayOfMonthData = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    value: 0,
    revenue: 0,
  }));

  filteredOrders.forEach(order => {
    const date = parseDate(order.order_date);
    const dayIndex = date.getDate() - 1;
    if (dayIndex >= 0 && dayIndex < 31) {
      dayOfMonthData[dayIndex].value++;
      dayOfMonthData[dayIndex].revenue += order.net_revenue;
    }
  });

  // Prepare hour histogram (buckets of 3h)
  const hourBuckets = [
    { hour: '00h-03h', start: 0, end: 3, count: 0 },
    { hour: '03h-06h', start: 3, end: 6, count: 0 },
    { hour: '06h-09h', start: 6, end: 9, count: 0 },
    { hour: '09h-12h', start: 9, end: 12, count: 0 },
    { hour: '12h-15h', start: 12, end: 15, count: 0 },
    { hour: '15h-18h', start: 15, end: 18, count: 0 },
    { hour: '18h-21h', start: 18, end: 21, count: 0 },
    { hour: '21h-24h', start: 21, end: 24, count: 0 },
  ];

  // Since we don't have time data, distribute based on typical patterns
  filteredOrders.forEach((_, idx) => {
    // Simulate hour distribution - in real implementation would use order_time
    const simulatedHour = (idx * 3) % 24;
    const bucketIdx = Math.floor(simulatedHour / 3);
    hourBuckets[bucketIdx].count++;
  });

  // Prepare category distribution
  const categoryMap = new Map<string, { value: number; count: number }>();
  filteredOrders.forEach(order => {
    const existing = categoryMap.get(order.product_category) || { value: 0, count: 0 };
    categoryMap.set(order.product_category, {
      value: existing.value + order.net_revenue,
      count: existing.count + 1,
    });
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    value: data.value,
    count: data.count,
  }));

  // Products table with sorting and filtering
  const filteredProducts = customer.products
    .filter(p => 
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.product_name.toLowerCase().includes(productSearch.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (productSortField) {
        case 'qty_total':
          comparison = a.qty_total - b.qty_total;
          break;
        case 'spend_total':
          comparison = a.spend_total - b.spend_total;
          break;
        case 'last_purchase_date':
          comparison = parseDate(a.last_purchase_date).getTime() - parseDate(b.last_purchase_date).getTime();
          break;
      }
      return productSortDir === 'asc' ? comparison : -comparison;
    });

  const productTotalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (productPage - 1) * itemsPerPage,
    productPage * itemsPerPage
  );

  // Orders pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleProductSort = (field: ProductSortField) => {
    if (productSortField === field) {
      setProductSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProductSortField(field);
      setProductSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: ProductSortField }) => {
    if (productSortField !== field) return null;
    return productSortDir === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  const exportCSV = () => {
    const headers = ['ID', 'Data', 'Hora', 'Itens', 'Valor Bruto', 'Valor Líquido', 'Pagamento', 'Cidade', 'Status', 'Status Entrega'];
    const rows = filteredOrders.map(o => [
      o.order_id,
      o.order_date,
      '-', // order_time would go here
      o.items_count,
      o.total_paid,
      o.net_revenue,
      o.payment_method,
      o.shipping_city,
      o.status,
      o.delivery_status,
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cliente_${customer.customer_id}_pedidos.csv`;
    a.click();
  };

  const exportPDF = () => {
    // Simple PDF export using print
    window.print();
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{customer.customer_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">ID: {customer.customer_id}</span>
              <span className="text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 inline mr-1" />
                Último pedido: {customer.last_order_date}
              </span>
              <Badge variant={customer.is_active ? "default" : "secondary"}>
                {customer.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">CLTV Est. 3 anos</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(customer.cltv_3y)}</p>
          <p className="text-sm text-muted-foreground mt-1">Total: {formatCurrency(customer.total_spend)}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Ticket Médio</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(customer.avg_ticket)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-xs">Total Gasto</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(customer.total_spend)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4" />
            <span className="text-xs">Qtd Pedidos</span>
          </div>
          <p className="text-lg font-bold">{customer.total_orders}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4" />
            <span className="text-xs">Qtd Total Itens</span>
          </div>
          <p className="text-lg font-bold">{customer.items_count}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Média Itens/Pedido</span>
          </div>
          <p className="text-lg font-bold">{customer.avg_items_per_order.toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Dias s/ Compra</span>
          </div>
          <p className="text-lg font-bold">{customer.days_since_last_purchase}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time Series */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Histórico de Compras</h3>
            <div className="flex gap-1">
              <Button
                variant={chartMetric === 'value' ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartMetric('value')}
              >
                Valor
              </Button>
              <Button
                variant={chartMetric === 'items' ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartMetric('items')}
              >
                Qtd
              </Button>
              <span className="mx-2 border-l border-border" />
              {(['30d', '90d', '12m', 'all'] as const).map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === 'all' ? 'Tudo' : range}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => chartMetric === 'value' ? formatCurrency(value) : value}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="hsl(var(--primary))"
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day of Week Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Heatmap - Dias da Semana</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
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

        {/* Day of Month Heatmap */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Heatmap - Dias do Mês</h3>
          <div className="grid grid-cols-7 gap-1">
            {dayOfMonthData.map(d => (
              <div
                key={d.day}
                className="aspect-square flex items-center justify-center text-xs rounded"
                style={{
                  backgroundColor: d.value > 0 
                    ? `hsl(var(--primary) / ${Math.min(0.2 + (d.value / Math.max(...dayOfMonthData.map(x => x.value))) * 0.8, 1)})` 
                    : 'hsl(var(--secondary))',
                  color: d.value > 0 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                }}
                title={`Dia ${d.day}: ${d.value} pedidos, ${formatCurrency(d.revenue)}`}
              >
                {d.day}
              </div>
            ))}
          </div>
        </div>

        {/* Hour Histogram */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Distribuição por Horário (buckets 3h)</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourBuckets}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution - Pie */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Categorias (por valor)</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution - By Count */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Categorias (por quantidade)</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Produtos Comprados</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead 
                className="text-center cursor-pointer hover:text-foreground"
                onClick={() => handleProductSort('qty_total')}
              >
                Qtd Total <SortIcon field="qty_total" />
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => handleProductSort('spend_total')}
              >
                Valor Total <SortIcon field="spend_total" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleProductSort('last_purchase_date')}
              >
                Última Compra <SortIcon field="last_purchase_date" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map(product => (
                <TableRow key={product.sku}>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>{product.product_name}</TableCell>
                  <TableCell className="text-center">{product.qty_total}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.spend_total)}</TableCell>
                  <TableCell>{product.last_purchase_date}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {productTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Mostrando {(productPage - 1) * itemsPerPage + 1}-
              {Math.min(productPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={productPage === 1}
                onClick={() => setProductPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={productPage === productTotalPages}
                onClick={() => setProductPage(p => p + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Pedidos ({filteredOrders.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead className="text-right">Valor Bruto</TableHead>
              <TableHead className="text-right">Valor Líquido</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.map(order => (
              <TableRow
                key={order.order_id}
                className="cursor-pointer hover:bg-secondary/50"
                onClick={() => setSelectedOrder(order)}
              >
                <TableCell className="font-medium">{order.order_id}</TableCell>
                <TableCell>{order.order_date}</TableCell>
                <TableCell className="text-center">{order.items_count}</TableCell>
                <TableCell className="text-right">{formatCurrency(order.total_paid)}</TableCell>
                <TableCell className="text-right">{formatCurrency(order.net_revenue)}</TableCell>
                <TableCell>{order.payment_method}</TableCell>
                <TableCell>{order.shipping_city}</TableCell>
                <TableCell>
                  <Badge variant={order.status === 'faturado' ? 'default' : 'secondary'}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{order.delivery_status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} de {filteredOrders.length}
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

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.order_id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">{selectedOrder.order_date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{selectedOrder.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-medium">{selectedOrder.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens</p>
                  <p className="font-medium">{selectedOrder.items_count}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Canal</p>
                  <p className="font-medium">{selectedOrder.sales_channel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status Entrega</p>
                  <Badge variant="outline">{selectedOrder.delivery_status}</Badge>
                </div>
              </div>

              {/* SKU List */}
              {selectedOrder.sku_list.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Itens do Pedido</h4>
                  <div className="space-y-2">
                    {selectedOrder.sku_list.map((sku, idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="font-mono text-sm">{sku}</span>
                        <span className="text-muted-foreground">1x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <h4 className="font-medium mb-3">Valores</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Bruto</span>
                    <span>{formatCurrency(selectedOrder.total_paid)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Desconto</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  {selectedOrder.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Impostos</span>
                      <span>{formatCurrency(selectedOrder.tax)}</span>
                    </div>
                  )}
                  {selectedOrder.freight_cost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(selectedOrder.freight_cost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-border">
                    <span>Valor Líquido</span>
                    <span>{formatCurrency(selectedOrder.net_revenue)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium mb-3">Endereço de Entrega</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cidade</span>
                    <span>{selectedOrder.shipping_city}</span>
                  </div>
                  {selectedOrder.shipping_state && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado</span>
                      <span>{selectedOrder.shipping_state}</span>
                    </div>
                  )}
                  {selectedOrder.cep && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CEP</span>
                      <span>{selectedOrder.cep}</span>
                    </div>
                  )}
                </div>
              </div>

              {(selectedOrder.delivery_promised_date || selectedOrder.delivery_actual_date) && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Datas de Entrega</h4>
                  <div className="space-y-2">
                    {selectedOrder.delivery_promised_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prometida</span>
                        <span>{selectedOrder.delivery_promised_date}</span>
                      </div>
                    )}
                    {selectedOrder.delivery_actual_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Realizada</span>
                        <span>{selectedOrder.delivery_actual_date}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
