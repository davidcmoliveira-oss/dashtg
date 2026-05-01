import { useState } from "react";
import { Package, TrendingUp, AlertTriangle, Users, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ProductData, TinyOrder } from "@/types/dashboard";
import {
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

interface ProductsViewProps {
  products: ProductData[];
  orders: TinyOrder[];
  isLoading: boolean;
  onCustomerClick?: (customerId: string) => void;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const ProductsView = ({ products, orders, isLoading, onCustomerClick }: ProductsViewProps) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [noSaleFilter, setNoSaleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<'revenue' | 'qty' | 'orders'>('revenue');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Curva ABC data
  const abcData = [
    { name: 'Classe A', value: products.filter(p => p.abc_class === 'A').length, color: CHART_COLORS[0] },
    { name: 'Classe B', value: products.filter(p => p.abc_class === 'B').length, color: CHART_COLORS[1] },
    { name: 'Classe C', value: products.filter(p => p.abc_class === 'C').length, color: CHART_COLORS[2] },
  ];

  const abcRevenueData = [
    { name: 'Classe A', value: products.filter(p => p.abc_class === 'A').reduce((sum, p) => sum + p.total_revenue, 0) },
    { name: 'Classe B', value: products.filter(p => p.abc_class === 'B').reduce((sum, p) => sum + p.total_revenue, 0) },
    { name: 'Classe C', value: products.filter(p => p.abc_class === 'C').reduce((sum, p) => sum + p.total_revenue, 0) },
  ];

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (noSaleFilter) {
      case '7':
        return product.days_without_sale >= 7;
      case '15':
        return product.days_without_sale >= 15;
      case '30':
        return product.days_without_sale >= 30;
      case '60':
        return product.days_without_sale >= 60;
      default:
        return true;
    }
  }).sort((a, b) => {
    if (sortBy === 'qty') return b.total_qty - a.total_qty;
    if (sortBy === 'orders') return b.total_orders - a.total_orders;
    return b.total_revenue - a.total_revenue;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get product orders for detail view
  const getProductOrders = (productName: string) => {
    return orders.filter(o => 
      o.product_name === productName || 
      o.product_name?.includes(productName.split(' ')[1] || '')
    ).slice(0, 20);
  };

  // Weekday labels
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Análise de produtos e Curva ABC</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">

      {/* ABC Curve Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ABC by Quantity */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Curva ABC - Quantidade de Produtos
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={abcData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {abcData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ABC by Revenue */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Curva ABC - Valor Vendido
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abcRevenueData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {abcRevenueData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Lista de Produtos ({filteredProducts.length})
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Input
              placeholder="Buscar produto..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64"
            />
            <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Ordenar por valor</SelectItem>
                <SelectItem value="qty">Ordenar por quantidade</SelectItem>
                <SelectItem value="orders">Ordenar por pedidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={noSaleFilter} onValueChange={(v) => { setNoSaleFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sem venda há..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                <SelectItem value="7">Sem venda há 7+ dias</SelectItem>
                <SelectItem value="15">Sem venda há 15+ dias</SelectItem>
                <SelectItem value="30">Sem venda há 30+ dias</SelectItem>
                <SelectItem value="60">Sem venda há 60+ dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-center">Classe</TableHead>
              <TableHead className="text-center">Qtd Vendida</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead>Última Venda</TableHead>
              <TableHead className="text-center">Dias s/ Venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map(product => (
                <TableRow
                  key={product.sku}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => setSelectedProduct(product)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={product.abc_class === 'A' ? 'default' : product.abc_class === 'B' ? 'secondary' : 'outline'}
                      className={product.abc_class === 'A' ? 'bg-primary' : ''}
                    >
                      {product.abc_class}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{product.total_qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.total_revenue)}</TableCell>
                  <TableCell className="text-center">{product.total_orders}</TableCell>
                  <TableCell>{product.last_sale_date}</TableCell>
                  <TableCell className="text-center">
                    <span className={product.days_without_sale > 30 ? 'text-destructive font-medium' : ''}>
                      {product.days_without_sale}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}
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

      {/* Products without sale alert */}
      {products.filter(p => p.days_without_sale >= 30).length > 0 && (
        <div className="rounded-xl border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-warning mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h4 className="font-semibold">Atenção: Produtos sem venda há mais de 30 dias</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            {products.filter(p => p.days_without_sale >= 30).length} produtos não foram vendidos nos últimos 30 dias.
            Use o filtro acima para visualizar.
          </p>
        </div>
      )}

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedProduct?.product_name}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              {/* Product Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedProduct.total_revenue)}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Qtd Vendida</p>
                  <p className="text-lg font-bold">{selectedProduct.total_qty}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Maior Intervalo</p>
                  <p className="text-lg font-bold">{selectedProduct.max_gap_without_sale} dias</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Classe ABC</p>
                  <Badge className={selectedProduct.abc_class === 'A' ? 'bg-primary' : ''}>
                    {selectedProduct.abc_class}
                  </Badge>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Sales by Weekday */}
                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Vendas por Dia da Semana
                  </h4>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdays.map((day, i) => ({ day, value: selectedProduct.sales_by_weekday[i] }))}>
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sales by Day of Month */}
                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Vendas por Dia do Mês
                  </h4>
                  <div className="grid grid-cols-7 gap-1">
                    {selectedProduct.sales_by_monthday.map((value, i) => (
                      <div
                        key={i}
                        className="aspect-square flex items-center justify-center text-xs rounded"
                        style={{
                          backgroundColor: value > 0 
                            ? `hsl(var(--primary) / ${Math.min(0.2 + (value / Math.max(...selectedProduct.sales_by_monthday)) * 0.8, 1)})` 
                            : 'hsl(var(--secondary))',
                        }}
                        title={`Dia ${i + 1}: ${value} vendas`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customers who bought */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Clientes que compraram ({selectedProduct.customers.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.customers.slice(0, 10).map(customer => (
                    <Badge
                      key={customer}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => {
                        setSelectedProduct(null);
                        onCustomerClick?.(customer);
                      }}
                    >
                      {customer}
                    </Badge>
                  ))}
                  {selectedProduct.customers.length > 10 && (
                    <Badge variant="outline">+{selectedProduct.customers.length - 10} mais</Badge>
                  )}
                </div>
              </div>

              {/* Recent Sales */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-medium mb-3">Últimas Vendas</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getProductOrders(selectedProduct.product_name).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      getProductOrders(selectedProduct.product_name).map(order => (
                        <TableRow key={order.order_id}>
                          <TableCell>{order.order_date}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell className="text-center">{order.items_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(order.total_paid)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
