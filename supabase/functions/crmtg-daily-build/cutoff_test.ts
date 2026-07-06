import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CUTOFF_DATE,
  isOrderEligible,
  lastOrderByCustomerAfterCutoff,
  parseBRDate,
} from "../_shared/crmtg-cutoff.ts";
import { routeCustomer, type Funnel, type CustomerSnapshot } from "../_shared/crmtg-routing.ts";

Deno.test("CUTOFF_DATE está fixado em 2026-07-05", () => {
  assertEquals(CUTOFF_DATE, "2026-07-05");
});

Deno.test("parseBRDate converte dd/mm/yyyy em ISO", () => {
  assertEquals(parseBRDate("04/07/2026"), "2026-07-04");
  assertEquals(parseBRDate("05/07/2026"), "2026-07-05");
  assertEquals(parseBRDate("06/07/2026 10:30:00"), "2026-07-06");
  assertEquals(parseBRDate(null), null);
  assertEquals(parseBRDate("lixo"), null);
});

Deno.test("isOrderEligible bloqueia pedidos anteriores ao cutoff e libera 05/07 em diante", () => {
  assertEquals(isOrderEligible("04/07/2026"), false);
  assertEquals(isOrderEligible("01/01/2026"), false);
  assertEquals(isOrderEligible("31/12/2025"), false);
  assertEquals(isOrderEligible("05/07/2026"), true);
  assertEquals(isOrderEligible("06/07/2026"), true);
  assertEquals(isOrderEligible("15/08/2026"), true);
});

Deno.test("lastOrderByCustomerAfterCutoff (geração da fila) ignora pedidos anteriores ao cutoff", () => {
  const orders = [
    { nome: "Cliente A", data_pedido: "04/07/2026", tiny_order_id: 1 }, // antes → ignorar
    { nome: "Cliente A", data_pedido: "05/07/2026", tiny_order_id: 2 }, // válido
    { nome: "Cliente B", data_pedido: "01/06/2026", tiny_order_id: 3 }, // antes → ignorar
    { nome: "Cliente B", data_pedido: "02/06/2026", tiny_order_id: 4 }, // antes → ignorar
    { nome: "Cliente C", data_pedido: "10/07/2026", tiny_order_id: 5 }, // válido
    { nome: "Consumidor Final", data_pedido: "10/07/2026", tiny_order_id: 6 }, // ignorar por regra
  ];

  const last = lastOrderByCustomerAfterCutoff(orders);

  // Cliente A: só o pedido válido entra
  assertEquals(last.get("Cliente A")?.tiny_order_id, 2);
  assertEquals(last.get("Cliente A")?.date, "2026-07-05");

  // Cliente B: todos anteriores → nem aparece na fila
  assertEquals(last.has("Cliente B"), false);

  // Cliente C: entra normalmente
  assertEquals(last.get("Cliente C")?.tiny_order_id, 5);

  // Consumidor final nunca entra
  assertEquals(last.has("Consumidor Final"), false);

  assertEquals(last.size, 2);
});

Deno.test("lastOrderByCustomerAfterCutoff mantém o pedido MAIS RECENTE quando há vários pós-cutoff", () => {
  const orders = [
    { nome: "Cliente X", data_pedido: "05/07/2026", tiny_order_id: 10 },
    { nome: "Cliente X", data_pedido: "20/07/2026", tiny_order_id: 11 },
    { nome: "Cliente X", data_pedido: "08/07/2026", tiny_order_id: 12 },
  ];
  const last = lastOrderByCustomerAfterCutoff(orders);
  assertEquals(last.get("Cliente X")?.tiny_order_id, 11);
  assertEquals(last.get("Cliente X")?.date, "2026-07-20");
});

// ------------- Roteamento -------------

const funilGranelSKU = "SKU-GRANEL-1";

const funnels: Funnel[] = [
  {
    id: "f-granel",
    nome: "Granel Creatina",
    categoria: "granel",
    prioridade: 30,
    ativo: true,
    produtos_gatilho: [funilGranelSKU],
    touches: [],
  },
  {
    id: "f-generico",
    nome: "Genérico",
    categoria: "generico",
    prioridade: 90,
    ativo: true,
    produtos_gatilho: [],
    touches: [],
  },
];

function snapshot(overrides: Partial<CustomerSnapshot>): CustomerSnapshot {
  return {
    customer_id: "Cliente Teste",
    customer_name: "Cliente Teste",
    telefone_normalizado: "5511999999999",
    last_order_date: "2026-07-05",
    last_order_skus: [],
    days_since_last: 0,
    ...overrides,
  };
}

Deno.test("Roteamento: pedido pré-cutoff nunca chega ao routeCustomer via pipeline (simulado)", () => {
  // Simula o pipeline: primeiro filtra pelo cutoff, só depois roteia.
  const orders = [
    { nome: "Antigo", data_pedido: "20/06/2026", tiny_order_id: 100 },
  ];
  const last = lastOrderByCustomerAfterCutoff(orders);
  assertEquals(last.size, 0, "cliente com pedido antigo NÃO deve chegar ao roteamento");
});

Deno.test("Roteamento: pedido pós-cutoff com SKU gatilho entra no funil de granel", () => {
  const orders = [
    { nome: "Novo", data_pedido: "06/07/2026", tiny_order_id: 200 },
  ];
  const last = lastOrderByCustomerAfterCutoff(orders);
  assert(last.has("Novo"));

  const snap = snapshot({
    customer_id: "Novo",
    customer_name: "Novo",
    last_order_date: last.get("Novo")!.date,
    last_order_skus: [funilGranelSKU],
    days_since_last: 0,
  });

  const r = routeCustomer(snap, funnels);
  assertEquals(r.funnel?.id, "f-granel");
});

Deno.test("Roteamento: mesmo com SKU gatilho, cliente pré-cutoff é descartado antes do roteamento", () => {
  const orders = [
    { nome: "Antigo Granel", data_pedido: "01/07/2026", tiny_order_id: 300 },
  ];
  const last = lastOrderByCustomerAfterCutoff(orders);
  assertEquals(last.size, 0);

  // Prova adicional: se por bug alguém pular o filtro e rotear direto,
  // o teste ainda demonstra que o pipeline correto NÃO entrega este cliente.
  const bypass = snapshot({
    customer_id: "Antigo Granel",
    last_order_date: "2026-07-01",
    last_order_skus: [funilGranelSKU],
    days_since_last: 4,
  });
  const routed = routeCustomer(bypass, funnels);
  // routeCustomer em si não conhece cutoff — a defesa está no filtro anterior.
  assertEquals(routed.funnel?.id, "f-granel");
  // Portanto o contrato garantido é: sem o filtro, o roteador rotearia; COM o filtro (last.size===0), ele nunca é chamado.
});
