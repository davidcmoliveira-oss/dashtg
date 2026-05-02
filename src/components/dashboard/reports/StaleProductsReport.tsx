import { useState, useMemo } from "react";
import { StaleProduct } from "@/hooks/useReportsAnalytics";
import { Input } from "@/components/ui/input";

interface Props {
  products: StaleProduct[];
}

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const levelLabel: Record<StaleProduct["level"], { text: string; color: string }> = {
  ok: { text: "OK", color: "bg-emerald-100 text-emerald-700" },
  warn: { text: "Atenção", color: "bg-yellow-100 text-yellow-700" },
  alert: { text: "Risco", color: "bg-orange-100 text-orange-700" },
  critical: { text: "Crítico", color: "bg-red-100 text-red-700" },
};

export const StaleProductsReport = ({ products }: Props) => {
  const [filter, setFilter] = useState<"all" | "7" | "15" | "30" | "60" | "90">("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const min = filter === "all" ? 0 : Number(filter);
    return products.filter((p) => {
      if (p.days_without_sale < min) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (q && !`${p.product_name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, filter, cat, q]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Produtos sem vendas</h2>
        <p className="text-sm text-muted-foreground">Identifique giro fraco, sazonalidade ou estoque parado</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "7", "15", "30", "60", "90"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {f === "all" ? "Todos" : `≥${f} dias`}
          </button>
        ))}
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="ml-auto px-2 py-1 rounded-md border border-border bg-background text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "Todas categorias" : c}
            </option>
          ))}
        </select>
        <Input
          placeholder="Buscar SKU ou nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Produto</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Categoria</th>
              <th className="text-right p-2">Última venda</th>
              <th className="text-right p-2">Dias parado</th>
              <th className="text-right p-2">Vend. período anterior</th>
              <th className="text-right p-2">Receita histórica</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((p) => {
              const l = levelLabel[p.level];
              return (
                <tr key={p.sku} className="border-t border-border">
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.color}`}>{l.text}</span>
                  </td>
                  <td className="p-2 font-medium">{p.product_name}</td>
                  <td className="p-2 text-xs text-muted-foreground">{p.sku}</td>
                  <td className="p-2 text-xs">{p.category}</td>
                  <td className="p-2 text-right text-xs">{p.last_sale_date || "-"}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{p.days_without_sale}</td>
                  <td className="p-2 text-right tabular-nums">{p.qty_prev_period.toFixed(0)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBRL(p.revenue_total)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                  Nenhum produto encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
