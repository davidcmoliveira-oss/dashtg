import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Package, User, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ReportHeader } from "./shared/ReportInfo";
import { CHART_COLORS, CHART_DEFAULTS, fmtBRL } from "@/lib/chartColors";
import { CustomerData } from "@/types/dashboard";
import {
  CrossSellRelated,
  CustomerRecommendation,
  ProductIndexEntry,
} from "@/hooks/useReportsAnalytics";

interface Props {
  productList: ProductIndexEntry[];
  customers: CustomerData[];
  getRelatedBySku: (sku: string, n?: number) => CrossSellRelated[];
  getRecommendationsForCustomer: (customerId: string, n?: number) => CustomerRecommendation[];
}

const ComboBox = <T extends { id: string; label: string; sub?: string }>({
  items,
  value,
  onChange,
  placeholder,
  emptyText,
}: {
  items: T[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder: string;
  emptyText: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.slice(0, 200).map((it) => (
                <CommandItem
                  key={it.id}
                  value={`${it.label} ${it.sub || ""}`}
                  onSelect={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === it.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm">{it.label}</span>
                    {it.sub && <span className="truncate text-xs text-muted-foreground">{it.sub}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const CrossSellReport = ({
  productList,
  customers,
  getRelatedBySku,
  getRecommendationsForCustomer,
}: Props) => {
  const [productSku, setProductSku] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const productItems = useMemo(
    () =>
      productList.map((p) => ({
        id: p.sku,
        label: p.name,
        sub: `SKU: ${p.sku}${p.category ? ` • ${p.category}` : ""}`,
      })),
    [productList],
  );

  const customerItems = useMemo(
    () =>
      [...customers]
        .sort((a, b) => b.total_spend - a.total_spend)
        .map((c) => ({
          id: c.customer_id,
          label: c.customer_name,
          sub: `${c.total_orders} pedidos • ${fmtBRL(c.total_spend)}`,
        })),
    [customers],
  );

  const related = productSku ? getRelatedBySku(productSku, 5) : [];
  const recs = customerId ? getRecommendationsForCustomer(customerId, 5) : [];
  const customer = customers.find((c) => c.customer_id === customerId);

  const copyList = (rows: Array<{ product_name: string; sku: string }>) => {
    const text = rows.map((r) => `${r.product_name} (${r.sku})`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Lista copiada");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <ReportHeader
        title="Cross-sell e recomendações"
        subtitle="Descubra o que vende junto e o que indicar para cada cliente"
        info={
          <>
            <p>
              <strong>Por produto:</strong> conta quantas vezes cada SKU apareceu no mesmo pedido faturado que o produto selecionado, em todo o histórico.
            </p>
            <p>
              <strong>Por cliente:</strong> usa os SKUs já comprados pelo cliente e soma a frequência de coocorrência global de cada produto candidato, excluindo o que ele já leva.
            </p>
            <p>Apenas pedidos com status <em>faturado</em> são considerados.</p>
          </>
        }
      />

      <Tabs defaultValue="product">
        <TabsList>
          <TabsTrigger value="product" className="gap-2">
            <Package className="h-4 w-4" /> Por produto
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-2">
            <User className="h-4 w-4" /> Por cliente
          </TabsTrigger>
        </TabsList>

        {/* MODO PRODUTO */}
        <TabsContent value="product" className="space-y-4 mt-4">
          <div className="max-w-xl">
            <label className="text-xs text-muted-foreground mb-1 block">Selecione um produto âncora</label>
            <ComboBox
              items={productItems}
              value={productSku}
              onChange={setProductSku}
              placeholder="Escolha um produto..."
              emptyText="Nenhum produto encontrado"
            />
          </div>

          {!productSku && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Escolha um produto para ver as 5 melhores opções de cross-sell.
            </div>
          )}

          {productSku && related.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Esse produto não tem co-ocorrências suficientes no histórico.
            </div>
          )}

          {productSku && related.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Top 5 comprados em conjunto</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={related} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid {...CHART_DEFAULTS.grid} />
                    <XAxis type="number" tick={CHART_DEFAULTS.axisTick} />
                    <YAxis
                      type="category"
                      dataKey="product_name"
                      tick={{ ...CHART_DEFAULTS.axisTick, fontSize: 10 }}
                      width={140}
                    />
                    <Tooltip contentStyle={CHART_DEFAULTS.tooltipContentStyle} />
                    <Bar dataKey="count" name="Pedidos juntos" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Detalhes</h3>
                  <Button size="sm" variant="ghost" className="gap-1 h-7" onClick={() => copyList(related)}>
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Produto</th>
                        <th className="text-right p-2">Pedidos</th>
                        <th className="text-right p-2">% âncora</th>
                        <th className="text-right p-2">Preço méd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {related.map((r) => (
                        <tr key={r.sku} className="border-t border-border">
                          <td className="p-2">
                            <div className="font-medium">{r.product_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.sku}{r.category ? ` • ${r.category}` : ""}
                            </div>
                          </td>
                          <td className="p-2 text-right tabular-nums font-semibold">{r.count}</td>
                          <td className="p-2 text-right tabular-nums">{r.pct_of_anchor.toFixed(1)}%</td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(r.avg_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* MODO CLIENTE */}
        <TabsContent value="customer" className="space-y-4 mt-4">
          <div className="max-w-xl">
            <label className="text-xs text-muted-foreground mb-1 block">Selecione um cliente</label>
            <ComboBox
              items={customerItems}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Escolha um cliente..."
              emptyText="Nenhum cliente encontrado"
            />
          </div>

          {!customerId && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Escolha um cliente para gerar 5 recomendações personalizadas.
            </div>
          )}

          {customerId && customer && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-xl font-bold tabular-nums">{customer.total_orders}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Total gasto</p>
                <p className="text-xl font-bold tabular-nums">{fmtBRL(customer.total_spend)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Última compra</p>
                <p className="text-xl font-bold tabular-nums">{customer.last_order_date}</p>
              </div>
            </div>
          )}

          {customerId && recs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Histórico desse cliente não tem dados suficientes para recomendações.
            </div>
          )}

          {customerId && recs.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-sm">Top 5 produtos para indicar</h3>
                <Button size="sm" variant="ghost" className="gap-1 h-7" onClick={() => copyList(recs)}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Produto</th>
                      <th className="text-left p-2">Por que indicar</th>
                      <th className="text-right p-2">Score</th>
                      <th className="text-right p-2">Preço méd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((r) => (
                      <tr key={r.sku} className="border-t border-border">
                        <td className="p-2">
                          <div className="font-medium">{r.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.sku}
                            {r.category && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">{r.category}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{r.reason}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{r.count}</td>
                        <td className="p-2 text-right tabular-nums">{fmtBRL(r.avg_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};
