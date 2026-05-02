import { Package, Users, TrendingUp, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TinyOrder, CustomerData, ProductData } from "@/types/dashboard";

interface TopItemsCardsProps {
  orders: TinyOrder[];
  customers: CustomerData[];
  products: ProductData[];
  isLoading: boolean;
  onCustomerClick?: (customerId: string) => void;
}

export const TopItemsCards = ({ orders, customers, products, isLoading, onCustomerClick }: TopItemsCardsProps) => {
  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Top 5 products (dados reais)
  const topProducts = products.slice(0, 5);

  // Top 5 customers
  const topCustomers = customers.slice(0, 5);

  // Top categories
  const categoryMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach(order => {
    const items = ((order as any)._items || []) as Array<{ categoria?: string; total?: number }>;
    if (items.length > 0) {
      items.forEach(item => {
        const category = item.categoria || order.product_category;
        const existing = categoryMap.get(category) || { count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += Number(item.total) || 0;
        categoryMap.set(category, existing);
      });
      return;
    }
    const existing = categoryMap.get(order.product_category) || { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += order.total_paid;
    categoryMap.set(order.product_category, existing);
  });
  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }));

  // Top channels
  const channelMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach(order => {
    const existing = channelMap.get(order.sales_channel) || { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += order.total_paid;
    channelMap.set(order.sales_channel, existing);
  });
  const topChannels = Array.from(channelMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }));

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-6">
      {/* Top Products */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top 5 Produtos</h3>
        </div>
        <div className="space-y-3">
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum produto encontrado
            </p>
          ) : (
            topProducts.map((product, index) => (
              <div
                key={product.sku}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary w-5">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {product.product_name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(product.total_revenue)}</p>
                  <p className="text-xs text-muted-foreground">{product.total_qty} un</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Customers */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top 5 Clientes</h3>
        </div>
        <div className="space-y-3">
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum cliente encontrado
            </p>
          ) : (
            topCustomers.map((customer, index) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors"
                onClick={() => onCustomerClick?.(customer.customer_id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary w-5">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {customer.customer_name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(customer.total_spend)}</p>
                  <p className="text-xs text-muted-foreground">{customer.total_orders} pedidos</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Categories */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top Categorias</h3>
        </div>
        <div className="space-y-3">
          {topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma categoria encontrada
            </p>
          ) : (
            topCategories.map((category, index) => (
              <div
                key={category.name}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary w-5">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {category.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(category.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{category.count} pedidos</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Channels */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top Canais</h3>
        </div>
        <div className="space-y-3">
          {topChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum canal encontrado
            </p>
          ) : (
            topChannels.map((channel, index) => (
              <div
                key={channel.name}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary w-5">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {channel.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(channel.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{channel.count} pedidos</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
