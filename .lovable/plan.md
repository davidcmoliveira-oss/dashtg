# Automação de Funis — Integração BotConversa

Novo módulo desacoplado para regras de automação que disparam webhooks (BotConversa ou outros) com base em produtos/categorias comprados, com logs, deduplicação, retry e teste manual.

## Arquitetura (mini motor de event-rules)

```text
Pedido (Tiny cache) ──▶ automation-engine (edge fn)
                          │
                          ├─ carrega regras ATIVAS
                          ├─ para cada item do pedido:
                          │     match(produto) OU match(categoria)
                          │     aplica regra ANY/ALL + prioridade
                          ├─ valida elegibilidade do cliente
                          ├─ checa dedup (automation_dispatches)
                          ├─ monta payload JSON padrão
                          ├─ POST webhook (timeout + retry expo.)
                          └─ grava log (sucesso/falha)
```

Camadas (todas em `src/modules/automations/`):
- `engine/` — matcher de regras, builder de payload, dispatcher HTTP (puro, testável, sem acoplamento ao BotConversa)
- `adapters/botconversa.ts` — mapeia payload genérico → formato BotConversa
- `ui/` — telas/componentes
- `api/` — hooks (TanStack Query) que falam com Supabase

A edge function `automation-engine` é genérica: recebe `{ orderId }` e roda o pipeline. Adapters extras (Manychat, Make, etc.) ficam triviais de adicionar.

## Schema do banco (migration)

- `automation_rules`
  - `id uuid pk`, `name text`, `description text`, `is_active bool default true`
  - `priority int default 0` (ordenação)
  - `webhook_url text`, `http_method text default 'POST'`, `headers jsonb default '{}'`
  - `flow_id text` (BotConversa, opcional)
  - `match_mode text check in ('any','all') default 'any'`
  - `product_priority bool default false` (produto > categoria)
  - `product_skus text[] default '{}'`, `categories text[] default '{}'`
  - `exclude_consumidor_final bool default true`
  - `require_phone bool default true`
  - `require_full_customer bool default false`
  - `allow_resend_after_days int` (null = nunca reenviar)
  - `created_at`, `updated_at`
- `automation_dispatches` (log + dedup)
  - `id uuid pk`, `rule_id uuid fk`, `tiny_order_id bigint`
  - `customer_name text`, `customer_phone text`
  - `matched_product text`, `matched_category text`
  - `payload jsonb`, `response_status int`, `response_body text`
  - `success bool`, `error_message text`, `attempts int default 1`
  - `dispatched_at timestamptz default now()`
  - índice único parcial: `(rule_id, tiny_order_id)` quando `success=true` (base para dedup, com regra de janela aplicada via lógica)
- RLS: leitura/escrita pública (mesmo padrão das tabelas existentes), edge function usa service role.

## Edge functions

1. `automation-engine` (`verify_jwt = false`)
   - Input: `{ orderId?: number, ruleId?: string, dryRun?: bool, testPayload?: object }`
   - Modos: processar pedido real, testar regra com payload mockado, ou processar lote (`{ since }`)
   - Retry: 3 tentativas com backoff (1s, 4s, 10s); timeout 10s por request
   - Grava sempre em `automation_dispatches`
2. Hook no fim de `tiny-sync` para chamar `automation-engine` em background (fire-and-forget) para cada pedido novo importado.

## Frontend — nova entrada na sidebar

Item "Automações" (ícone `Zap`) em `src/components/layout/Sidebar.tsx` (menu principal). Em `Index.tsx`, novo case `automations` renderiza `AutomationsView`.

### Telas

- **`AutomationsView`** (resumo + lista)
  - Cards de resumo: regras ativas, disparos hoje, taxa sucesso 7d, último disparo
  - Tabela de regras com: nome, status (switch), filtros resumidos, prioridade, ações (editar, duplicar, testar, excluir)
  - Busca por nome, filtro por status
  - Botão "Nova automação"
- **`AutomationFormDialog`** (criar/editar)
  - Abas: **Geral** (nome, descrição, status, prioridade) · **Webhook** (URL, método, headers KV editor, flow_id) · **Filtros** (multi-select de produtos do `tiny_products_cache` e categorias, modo ANY/ALL, switch produto-prioritário) · **Elegibilidade** (switches: excluir Consumidor Final, exigir telefone, exigir cadastro completo, janela de reenvio em dias) · **Teste** (botão "Testar Webhook" com payload mockado editável e resposta exibida)
- **`AutomationLogsView`** (aba dentro da tela)
  - Tabela paginada de `automation_dispatches` com filtros por regra, status, data
  - Drawer mostra payload JSON, resposta, headers
  - Botão "Reenviar" → chama `automation-engine` com `{ ruleId, orderId }` ignorando dedup

### Componentes novos
- `src/modules/automations/ui/AutomationsView.tsx`
- `src/modules/automations/ui/AutomationFormDialog.tsx`
- `src/modules/automations/ui/AutomationLogsView.tsx`
- `src/modules/automations/ui/AutomationSummaryCards.tsx`
- `src/modules/automations/api/useAutomations.ts` (CRUD + invoke testWebhook)
- `src/modules/automations/api/useDispatches.ts`
- `src/modules/automations/engine/types.ts` (Rule, Dispatch, Payload)

## Payload padrão enviado

```json
{
  "cliente_nome": "...",
  "cliente_telefone": "...",
  "produto_comprado": "...",
  "categoria_produto": "...",
  "data_compra": "YYYY-MM-DD HH:mm:ss",
  "pedido_id": "...",
  "valor_total": 0,
  "quantidade": 1,
  "regra_disparada": "..."
}
```

Adapter BotConversa pode adicionar `subscriber.phone` e `flow` se `flow_id` estiver setado, mantendo a base intacta.

## Lógica de matching

1. Normaliza SKUs/categorias (trim, lower).
2. Para cada item do pedido, marca `matchProduct` / `matchCategory`.
3. Se `product_priority=true` e houve match de produto → ignora categorias.
4. `match_mode = any` → basta 1 item bater. `all` → todos os SKUs/categorias da regra precisam estar no pedido.
5. Elegibilidade do cliente bloqueia execução (mas log é gravado com `success=false, error_message='ineligible'` apenas em modo manual, em modo automático apenas pula).
6. Dedup: consulta `automation_dispatches` por `(rule_id, tiny_order_id, success=true)`; se existe e `allow_resend_after_days` é null OU `now() - dispatched_at < interval`, pula.

## Arquivos a criar/editar

**Criar**
- `supabase/functions/automation-engine/index.ts`
- `src/modules/automations/engine/{matcher,payload,dispatcher,types}.ts`
- `src/modules/automations/adapters/botconversa.ts`
- `src/modules/automations/api/{useAutomations,useDispatches}.ts`
- `src/modules/automations/ui/{AutomationsView,AutomationFormDialog,AutomationLogsView,AutomationSummaryCards}.tsx`
- Migration SQL com as duas tabelas + RLS + índices

**Editar**
- `src/components/layout/Sidebar.tsx` — adicionar item "Automações"
- `src/pages/Index.tsx` — novo case `automations`
- `supabase/functions/tiny-sync/index.ts` — invoke fire-and-forget do engine para cada pedido novo
- `supabase/config.toml` — registrar `[functions.automation-engine] verify_jwt = false`

## Notas técnicas

- Disparos sempre assíncronos (chamados via `supabase.functions.invoke` sem await no client).
- Headers customizados aplicados antes do `Content-Type: application/json` padrão.
- Timeouts via `AbortController`. Erros de rede contam tentativa e fazem retry.
- Logs persistidos sempre, mesmo em falha total.
- Estrutura `src/modules/automations/` deixa o módulo pronto para extração futura (lib/pacote).
