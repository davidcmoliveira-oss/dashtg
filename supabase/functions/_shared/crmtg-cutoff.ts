// Cutoff compartilhado: apenas pedidos com data_pedido >= CUTOFF_DATE
// são elegíveis para geração de fila e roteamento de funis.
export const CUTOFF_DATE = "2026-07-05";

export function parseBRDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isOrderEligible(dataPedidoBR: string | null | undefined, cutoff: string = CUTOFF_DATE): boolean {
  const iso = parseBRDate(dataPedidoBR);
  if (!iso) return false;
  return iso >= cutoff;
}

/** Retorna o último pedido por cliente considerando apenas pedidos >= cutoff. */
export function lastOrderByCustomerAfterCutoff<T extends { nome: string | null; data_pedido: string | null; tiny_order_id: number }>(
  orders: T[],
  cutoff: string = CUTOFF_DATE,
): Map<string, { date: string; tiny_order_id: number }> {
  const last = new Map<string, { date: string; tiny_order_id: number }>();
  for (const o of orders) {
    if (!o.nome || /consumidor\s*final/i.test(o.nome)) continue;
    const d = parseBRDate(o.data_pedido);
    if (!d) continue;
    if (d < cutoff) continue;
    const cur = last.get(o.nome);
    if (!cur || d > cur.date) last.set(o.nome, { date: d, tiny_order_id: o.tiny_order_id });
  }
  return last;
}
