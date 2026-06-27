# Plano — Módulo CRM TG (CRM de Recompra)

Módulo 100% isolado. Nenhuma tela existente é alterada — apenas adição de um item recolhível no Sidebar e ampliação não-destrutiva da lista de Clientes (colunas/filtros opcionais).

Único segredo solicitado no início: `BOTCONVERSA_API_KEY`.

---

## 1. Banco de dados (novas tabelas, prefixo `crmtg_`)

Reaproveita `tiny_orders_cache`, `tiny_order_details_cache`, `tiny_customers_cache`, `tiny_products_cache` como fonte de verdade. Nada é duplicado.

- `crmtg_settings` (singleton) — sistema_pausado, horário_inicio (default 09:00), horário_fim (20:00), tz fixo America/Sao_Paulo, lote_tamanho, intervalo_min_msg, intervalo_max_msg, intervalo_min_lote, intervalo_max_lote, última_execução_diária.
- `crmtg_funnels` — id, nome, categoria (`reativacao|suplementacao|granel|generico`), prioridade (int), ativo, produtos_gatilho (text[] de SKUs), observacoes.
- `crmtg_funnel_touches` — funnel_id, ordem, dia_offset (int), botconversa_flow_id, mensagem_v1, mensagem_v2, mensagem_v3.
- `crmtg_customer_state` — customer_id PK, fase, funnel_atual_id, entrada_funnel_em (date), ultimo_pedido_em, ultima_avaliacao_em.
- `crmtg_daily_queue` — id, run_date, customer_id, telefone_normalizado, funnel_id, touch_id, horario_previsto, flow_id, mensagem_escolhida (1/2/3), texto_render, status (`pending|sent|cancelled|failed`), motivo_cancelamento, enviado_em, botconversa_response.
- `crmtg_history` — espelho imutável dos disparos (mesmos campos + categoria/funil/toque snapshot).
- `crmtg_daily_run_log` — run_date PK, iniciado_em, finalizado_em, elegiveis, fila_criada, alertas jsonb.

Todas com GRANT padrão (authenticated + service_role; sem anon) + RLS habilitado com policy permissiva para `authenticated` (segue padrão do projeto).

---

## 2. Edge Functions (novas, prefixo `crmtg-`)

- `crmtg-daily-build` — roda **1x/dia** via pg_cron (08:30 BRT). Valida frescor do Tiny (último pedido < 24h olhando `tiny_orders_cache.fetched_at`); se falhar, marca alerta e NÃO monta fila. Caso ok: itera clientes ativos com telefone, aplica roteamento (Reativação → Suplementação → Granel → Genérico, para no primeiro match), calcula quais toques caem em `today` baseado em `entrada_funnel_em + dia_offset`, grava `crmtg_daily_queue` com horários distribuídos entre 09:00–20:00, escolhe aleatoriamente v1/v2/v3 por linha.
- `crmtg-sender` — roda a cada 5 min via pg_cron dentro da janela. Lê próximos itens `pending` cujo `horario_previsto <= now()`, processa em lotes pequenos (default 5), com sleep aleatório entre mensagens (default 8–25s) e entre lotes (60–180s). Chama BotConversa API (`/subscribers` + trigger flow) usando `BOTCONVERSA_API_KEY`. Respeita `sistema_pausado`. Aplica limite 1 msg/cliente/dia. Grava histórico.
- `crmtg-router` — função compartilhada (helpers em `_shared/crmtg-routing.ts`) usada por `daily-build` e pelo simulador.
- `crmtg-simulate` — executa router em dry-run e devolve lista de clientes + motivo, sem gravar.
- `crmtg-reset-on-purchase` — trigger SQL em `tiny_orders_cache` AFTER INSERT/UPDATE: zera `crmtg_customer_state` do cliente e cancela linhas `pending` da fila do dia (motivo: "nova compra").
- `crmtg-ai-messages` — gera 3 versões via Lovable AI Gateway (`google/gemini-3-flash-preview`) com prompt fixo (tom Ju da Tangerina, pt-BR, emojis).

Cron jobs (pg_cron + pg_net):
- `crmtg-daily-build` 08:30 BRT (11:30 UTC).
- `crmtg-sender` */5 min entre 12:00–23:00 UTC (≈09–20 BRT).

---

## 3. Frontend — submenu recolhível em `Sidebar.tsx`

Adicionar 1 item raiz **CRM TG** (ícone `MessageCircle`) que expande:
- Painel Inicial
- Fila do Dia
- Funis
- Histórico
- Configurações

Roteamento via `activeItem` em `pages/Index.tsx` (mesmo padrão atual, sem react-router novo). Todas as telas ficam em `src/modules/crmtg/ui/`:

- `CrmtgDashboard.tsx` — cards (clientes por fase, por funil, entradas hoje, inelegíveis, programadas, enviadas, canceladas, status sender + ETA), alertas (pausa, Tiny desatualizado, falhas BotConversa, sem telefone), 3 gráficos (recharts já no projeto).
- `CrmtgQueue.tsx` — tabela paginada da fila do dia + filtros (data/funil/status/cliente).
- `CrmtgFunnels.tsx` — lista de funis + editor (drawer/dialog shadcn) com toques editáveis (adicionar/excluir/reordenar via dnd simples), botão "Gerar Mensagens IA" por toque, botão **Simular**.
- `CrmtgHistory.tsx` — tabela paginada com todos os filtros do brief.
- `CrmtgSettings.tsx` — toggle pausar/reativar, inputs horário início/fim, parâmetros de ritmo, status API BotConversa (ping).

Hooks em `src/modules/crmtg/api/` (padrão de `modules/automations`): `useCrmtgFunnels`, `useCrmtgQueue`, `useCrmtgHistory`, `useCrmtgSettings`, `useCrmtgDashboard`, `useCrmtgSimulate`, `useGenerateAiMessages`.

Reutilização explícita:
- `BotConversaExportDialog` / `buildBotConversaXlsx` — padrão de normalização de telefone via `tiny_customers_cache`.
- `AiInsightsPanel` / `ai-insights` edge function — base para o gerador IA.
- Componentes shadcn já instalados (Dialog, Tabs, Table, Switch, Select, Card).
- Padrão visual: cor primária já é #F26522, fundo branco; fonte Poppins será adicionada em `index.html` + `tailwind.config.ts` (já há Inter — só adiciona família, não remove).

---

## 4. Ampliação da tela de Clientes (não-destrutiva)

Em `CustomersListView.tsx`: adicionar colunas opcionais (telefone, fase, funil atual) e filtros (funil, fase, recebeu mensagem em período) **somente quando o módulo CRM TG está habilitado** — toggle no `crmtg_settings`. Sem mexer em colunas/filtros existentes. Drawer de detalhe do cliente ganha aba "CRM TG" com histórico de funis e mensagens enviadas (consulta `crmtg_history`).

---

## 5. Roteamento (ordem obrigatória)

1. `days_since_last_purchase >= 45` → Reativação (toques 0,3,7,10,14).
2. Último pedido contém SKU em `produtos_gatilho` de algum funil **Suplementação** ativo → entra nesse funil (0 = data do pedido; toques 20,25,28,30).
3. Idem para **Granel** (toques 7,10,13).
4. Caso contrário → **Genérico** (toques 1,3,7,10,14,17,21,25,28).

Para por categoria com maior prioridade configurada. Cliente sem telefone normalizado ou "Consumidor Final" → ignorado silenciosamente.

---

## 6. Anti-bloqueio & ritmo humanizado

- 3 versões obrigatórias por toque (validação no editor).
- `daily-build` sorteia versão por linha (distribuição balanceada via módulo do índice).
- `sender` processa em lotes de N (config), sleep aleatório entre msgs e entre lotes; nunca passa do horário fim. Mensagens não enviadas até o fim do dia são marcadas `cancelled` com motivo "fora da janela" e ignoradas (não acumulam).

---

## 7. Segredo

No início da implementação, após aprovação do plano: solicitar `BOTCONVERSA_API_KEY` via `add_secret`. Nenhum outro segredo necessário (Tiny e Lovable AI já estão configurados).

---

## 8. Fora de escopo

- Não altera nenhuma tela/edge function existente (exceto adição de itens no Sidebar e colunas/filtros opcionais em CustomersListView).
- Não duplica cache do Tiny.
- Não cria sistema independente de webhooks — usa BotConversa apenas como disparador.
- Não toca em `automation-engine` (sistema atual de automações genéricas permanece intacto).
