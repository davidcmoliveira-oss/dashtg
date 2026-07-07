
## Objetivo

1. Zerar histórico e estado do CRM TG mantendo apenas clientes cujo pedido gatilho é ≥ **05/07/2026**.
2. Recalcular "clientes por fase" com o mesmo critério.
3. No Painel Inicial, mostrar cada funil em formato de lista simples (sem expandir), com contagem de clientes e, para cada cliente, toque atual / último enviado / próximo envio.

## 1. Limpeza de dados

Via ferramenta `insert` (data change):

- `DELETE FROM crmtg_history`
- `DELETE FROM crmtg_daily_queue`
- `DELETE FROM crmtg_customer_state WHERE ultimo_pedido_em IS NULL OR ultimo_pedido_em < '2026-07-05'`
- `DELETE FROM crmtg_daily_run_log`

Depois, invocar `crmtg-daily-build` manualmente para repopular estado e fila com base apenas em pedidos ≥ 05/07/2026 (cutoff já enforçado em `_shared/crmtg-cutoff.ts`).

## 2. Novo componente `CrmtgFunnelClients` no Painel Inicial

Alterar `useCrmtgDashboard` em `src/modules/crmtg/api/useCrmtg.ts` para também retornar, para cada funil ativo:

- `funnel_id`, `funnel_nome`, `funnel_categoria`, `total_clientes`
- Lista de clientes (paginada via `.range()`, sem limite 1000): `customer_id`, `customer_name`, `entrada_funnel_em`
- Toques do funil (`crmtg_funnel_touches`) ordenados por `dia_offset`
- Último toque enviado por cliente (query única em `crmtg_history` com `funnel_id IN (...)`, ordenada por `enviado_em DESC`, agrupada client-side pela chave `customer_id|funnel_id`)

### Cálculo por cliente

- `dia_atual = hoje - entrada_funnel_em` (dias).
- `toque_atual` = maior `dia_offset` ≤ `dia_atual` (ou "aguardando" se nenhum).
- `ultimo_enviado` = do `crmtg_history` (touch_ordem + data curta `dd/mm`).
- `proximo_envio` = menor `dia_offset` > `dia_atual` → data = `entrada_funnel_em + dia_offset dias`, formato `dd/mm` (ou "finalizado" se não houver).

### UI (em `CrmtgDashboard.tsx`)

Substituir o card atual "Fila por funil (hoje)" por um bloco "Clientes por funil":

- Uma seção por funil, sempre visível (sem accordion), com título + badge de contagem.
- Tabela compacta shadcn com colunas: **Cliente | Toque atual | Último enviado | Próximo envio**.
- Se >20 clientes, mostrar os 20 primeiros por `entrada_funnel_em` desc + linha "+N clientes".
- Estado vazio: "Nenhum cliente ativo neste funil."

Manter card "Clientes por fase" (refletirá dados pós-limpeza).

## 3. Validação

- `psql` conferindo `crmtg_history` vazio e `crmtg_customer_state.ultimo_pedido_em >= 2026-07-05` para todos.
- Invocar `crmtg-daily-build` e checar `crmtg_daily_run_log` (elegiveis, fila_criada).
- Playwright em `/` → menu CRM TG → Painel Inicial: screenshot mostrando a nova seção com colunas preenchidas.

## Detalhes técnicos

- Sem migrations de schema — apenas DELETEs.
- Nenhum edge function novo. Reaproveita `crmtg-daily-build`.
- Cutoff continua em `_shared/crmtg-cutoff.ts` (`2026-07-05`).
- Pagination via `.range()` em `crmtg_customer_state` e `crmtg_history` para evitar corte em 1000.
