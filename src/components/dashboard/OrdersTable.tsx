import { useState } from "react";
import { Search, Download, ChevronDown, ChevronUp, FileText } from "lucide-react";
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

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  };

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
      order.payment_method.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'order_date':
          comparison = parseDate(a.order_date).getTime() - parseDate(b.order_date).getTime();
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
    const headers = ['ID', 'Data', 'Cliente', 'Itens', 'Valor Bruto', 'Valor Líquido', 'Desconto', 'Impostos', 'Frete', 'Status', 'Pagamento', 'Canal', 'Status Entrega'];
    const rows = filteredOrders.map(o => [
      o.order_id,
      o.order_date,
      o.customer_name,
      o.items_count,
      o.total_paid,
      o.net_revenue,
      o.discount,
      o.tax,
      o.freight_cost,
      o.status,
      o.payment_method,
      o.sales_channel,
      o.delivery_status,
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportPDF = () => {
    window.print();
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
    <div className="rounded-xl border border-border bg-card p-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, cliente, pagamento..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
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
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                  <TableCell>{order.payment_method}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{order.delivery_status}</Badge>
                  </TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {selectedOrder?.order_id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const items = (((selectedOrder as any)._items || []) as Array<{ sku: string; product_name: string; qty: number; total: number; unit_price: number }>);
            const realItemsCount = items.length > 0 ? items.length : selectedOrder.items_count;
            const totalUnits = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
            return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  <p className="text-sm text-muted-foreground">Itens (produtos)</p>
                  <p className="font-medium">{realItemsCount}{totalUnits > 0 ? ` • ${totalUnits.toLocaleString('pt-BR')} un` : ''}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Canal</p>
                  <p className="font-medium">{selectedOrder.sales_channel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-medium">{selectedOrder.payment_method}</p>
                </div>
              </div>

              {/* Itens do Pedido */}
              {items.length > 0 ? (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Itens do Pedido ({items.length})</h4>
                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{it.product_name || it.sku || 'Produto sem nome'}</p>
                          {it.sku && (
                            <p className="text-xs text-muted-foreground font-mono">SKU: {it.sku}</p>
                          )}
                        </div>
                        <div className="text-right text-sm whitespace-nowrap">
                          <p>{Number(it.qty).toLocaleString('pt-BR')}× {formatCurrency(it.unit_price)}</p>
                          <p className="text-muted-foreground">{formatCurrency(it.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedOrder.sku_list.length > 0 ? (
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Itens do Pedido</h4>
                  <p className="text-sm text-muted-foreground mb-2">Detalhes em sincronização. Sincronize novamente para carregar nomes dos produtos.</p>
                  <div className="space-y-2">
                    {selectedOrder.sku_list.map((sku, idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="font-mono text-sm">{sku}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">Detalhes do pedido ainda não sincronizados. Clique em "Sincronizar agora" para buscar.</p>
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
                  {selectedOrder.delivery_promised_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Prometida</span>
                      <span>{selectedOrder.delivery_promised_date}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_actual_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Realizada</span>
                      <span>{selectedOrder.delivery_actual_date}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.returned_flag && (
                <div className="border-t border-border pt-4">
                  <Badge variant="destructive">Pedido Devolvido</Badge>
                </div>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
