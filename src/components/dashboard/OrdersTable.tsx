import { useState } from "react";
import { Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { TinyOrder } from "@/types/dashboard";

interface OrdersTableProps {
  orders: TinyOrder[];
  isLoading: boolean;
  onCustomerClick?: (customerId: string) => void;
}

type SortField = 'order_date' | 'total_paid' | 'net_revenue' | 'items_count' | 'customer_name';
type SortDirection = 'asc' | 'desc';

export const OrdersTable = ({ orders, isLoading, onCustomerClick }: OrdersTableProps) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedOrder, setSelectedOrder] = useState<TinyOrder | null>(null);
  const itemsPerPage = 20;

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  // Filter and sort orders
  const filteredOrders = orders
    .filter(order =>
      order.order_id.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      order.shipping_city.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'order_date':
          const parseDate = (d: string) => {
            const parts = d.split('/');
            if (parts.length === 3) {
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
            }
            return 0;
          };
          comparison = parseDate(a.order_date) - parseDate(b.order_date);
          break;
        case 'total_paid':
          comparison = a.total_paid - b.total_paid;
          break;
        case 'net_revenue':
          comparison = a.net_revenue - b.net_revenue;
          break;
        case 'items_count':
          comparison = a.items_count - b.items_count;
          break;
        case 'customer_name':
          comparison = a.customer_name.localeCompare(b.customer_name);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportCSV = () => {
    const headers = ['ID', 'Data', 'Cliente', 'Itens', 'Valor Bruto', 'Valor Líquido', 'Status', 'Cidade', 'Pagamento'];
    const rows = filteredOrders.map(o => [
      o.order_id,
      o.order_date,
      o.customer_name,
      o.items_count,
      o.total_paid,
      o.net_revenue,
      o.status,
      o.shipping_city,
      o.payment_method,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      faturado: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex justify-between mb-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, cliente..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('order_date')}
              >
                Data <SortIcon field="order_date" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('customer_name')}
              >
                Cliente <SortIcon field="customer_name" />
              </TableHead>
              <TableHead 
                className="text-center cursor-pointer hover:text-foreground"
                onClick={() => handleSort('items_count')}
              >
                Itens <SortIcon field="items_count" />
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('total_paid')}
              >
                Valor Bruto <SortIcon field="total_paid" />
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('net_revenue')}
              >
                Valor Líquido <SortIcon field="net_revenue" />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map(order => (
                <TableRow
                  key={order.order_id}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => setSelectedOrder(order)}
                >
                  <TableCell className="font-medium">{order.order_id}</TableCell>
                  <TableCell>{order.order_date}</TableCell>
                  <TableCell>
                    <button
                      className="text-primary hover:underline text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCustomerClick?.(order.customer_id);
                      }}
                    >
                      {order.customer_name}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">{order.items_count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.total_paid)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.net_revenue)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{order.shipping_city}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.order_id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">{selectedOrder.order_date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens</p>
                  <p className="font-medium">{selectedOrder.items_count}</p>
                </div>
              </div>

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
                <h4 className="font-medium mb-3">Entrega</h4>
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
                  {selectedOrder.delivery_status && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline">{selectedOrder.delivery_status}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma de Pagamento</span>
                  <span>{selectedOrder.payment_method}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
