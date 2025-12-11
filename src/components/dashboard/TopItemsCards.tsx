import { Package, Users, TrendingUp, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TinyOrder, CustomerData } from "@/types/dashboard";

interface TopItemsCardsProps {
  orders: TinyOrder[];
  customers: CustomerData[];
  isLoading: boolean;
  onCustomerClick?: (customerId: string) => void;
}

export const TopItemsCards = ({ orders, customers, isLoading, onCustomerClick }: TopItemsCardsProps) => {
  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Top 5 products (mock - real data would come from order items)
  const topProducts = [
    { name: "Produto A", qty: 45, revenue: 4500 },
    { name: "Produto B", qty: 38, revenue: 3800 },
    { name: "Produto C", qty: 32, revenue: 3200 },
    { name: "Produto D", qty: 28, revenue: 2800 },
    { name: "Produto E", qty: 25, revenue: 2500 },
  ];

  // Top 5 customers
  const topCustomers = customers.slice(0, 5);

  // Top categories
  const categoryMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach(order => {
    const existing = categoryMap.get(order.product_category) || { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += order.net_revenue;
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
    existing.revenue += order.net_revenue;
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
          <div key={i} className="rounded-xl border border-border bg-card p-6">
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
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Top 5 Produtos</h3>
        </div>
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div
              key={product.name}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-5">
                  {index + 1}
                </span>
                <span className="text-sm font-medium truncate max-w-[100px]">
                  {product.name}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrency(product.revenue)}</p>
                <p className="text-xs text-muted-foreground">{product.qty} un</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Customers */}
      <div className="rounded-xl border border-border bg-card p-6">
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
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => onCustomerClick?.(customer.customer_id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-5">
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
      <div className="rounded-xl border border-border bg-card p-6">
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
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-5">
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
      <div className="rounded-xl border border-border bg-card p-6">
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
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-5">
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
