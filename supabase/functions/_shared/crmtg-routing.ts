// Shared routing logic for CRM TG
// Decides which funnel a customer enters based on last purchase and triggers.

export type FunnelCategoria = "reativacao" | "suplementacao" | "granel" | "generico";

export interface Funnel {
  id: string;
  nome: string;
  categoria: FunnelCategoria;
  prioridade: number;
  ativo: boolean;
  produtos_gatilho: string[];
  touches: Touch[];
}
export interface Touch {
  id: string;
  ordem: number;
  dia_offset: number;
  botconversa_flow_id: string | null;
  flow_id_v1: string | null;
  flow_id_v2: string | null;
  flow_id_v3: string | null;
  mensagem_v1: string;
  mensagem_v2: string;
  mensagem_v3: string;
}

export interface CustomerSnapshot {
  customer_id: string;          // nome (chave usada no app)
  customer_name: string;
  telefone_normalizado: string | null;
  last_order_date: string;      // YYYY-MM-DD
  last_order_skus: string[];
  days_since_last: number;
}

export interface RouteResult {
  funnel: Funnel | null;
  motivo: string;
  entrada_em: string; // YYYY-MM-DD
}

const CONSUMIDOR_FINAL_REGEX = /consumidor\s*final/i;

export function routeCustomer(c: CustomerSnapshot, funnels: Funnel[]): RouteResult {
  if (!c.customer_id || CONSUMIDOR_FINAL_REGEX.test(c.customer_id)) {
    return { funnel: null, motivo: "consumidor final ignorado", entrada_em: c.last_order_date };
  }
  // Sem telefone não bloqueia roteamento — o sender filtra antes do disparo.
  // Isso garante que a fila/painel mostre todos os elegíveis enquanto o
  // enriquecimento de telefones roda em paralelo.

  const ativos = funnels.filter(f => f.ativo).sort((a,b) => a.prioridade - b.prioridade);

  // 1) Reativação (45+ dias)
  if (c.days_since_last >= 45) {
    const reat = ativos.find(f => f.categoria === "reativacao");
    if (reat) return { funnel: reat, motivo: `inativo há ${c.days_since_last} dias`, entrada_em: c.last_order_date };
  }

  // 2) Suplementação por SKU gatilho
  const sup = ativos.find(f => f.categoria === "suplementacao" && f.produtos_gatilho.some(sku => c.last_order_skus.includes(sku)));
  if (sup) return { funnel: sup, motivo: `último pedido contém SKU gatilho`, entrada_em: c.last_order_date };

  // 3) Granel
  const gran = ativos.find(f => f.categoria === "granel" && f.produtos_gatilho.some(sku => c.last_order_skus.includes(sku)));
  if (gran) return { funnel: gran, motivo: `último pedido contém produto granel`, entrada_em: c.last_order_date };

  // 4) Genérico
  const gen = ativos.find(f => f.categoria === "generico");
  if (gen) return { funnel: gen, motivo: "fallback genérico", entrada_em: c.last_order_date };

  return { funnel: null, motivo: "nenhum funil ativo aplicável", entrada_em: c.last_order_date };
}

export function pickMessageVersion(seed: number, v1: string, v2: string, v3: string): { versao: number; texto: string } {
  const opts = [v1, v2, v3].map((t, i) => ({ versao: i + 1, texto: (t || "").trim() })).filter(o => o.texto.length > 0);
  if (opts.length === 0) return { versao: 1, texto: "" };
  return opts[seed % opts.length];
}
