## Diagnóstico

Os 16 clientes sem funil no painel são resíduos antigos em `crmtg_customer_state`:

- Todos têm `ultimo_pedido_em >= 05/07/2026`, então passaram pelo filtro da limpeza anterior.
- Nenhum comprou o produto do único funil ativo (Creatina, SKU `0000000010221`).
- O código atual do `crmtg-daily-build` (linha 135) só cria estado para quem casa com um funil, então esses rows vieram de execuções antigas — provavelmente de funis que foram desativados ou apagados depois.
- O rebuild manual pós-limpeza retornou `elegiveis:0` e não os removeu.

## Ação

**1. Remover órfãos existentes** (via data change):

```sql
DELETE FROM crmtg_customer_state WHERE funnel_atual_id IS NULL;
```

Resultado esperado: painel passa a mostrar apenas 1 cliente (david oliveira no funil Creatina) — refletindo a regra "só entra quem casa com gatilho ativo a partir de 05/07/2026".

**2. Prevenção automática** em `supabase/functions/crmtg-daily-build/index.ts`, ao final do run:

```ts
await supa.from("crmtg_customer_state")
  .delete()
  .or("funnel_atual_id.is.null,funnel_atual_id.not.in.(SELECT id FROM crmtg_funnels WHERE ativo)");
```

(implementado como duas chamadas separadas usando `in()` com IDs de funis ativos carregados no início do run, para respeitar PostgREST.)

Assim, sempre que um funil for desativado/apagado, seus clientes saem do painel automaticamente na próxima execução diária.

## Validação

- `SELECT COUNT(*) FROM crmtg_customer_state;` → deve retornar 1.
- Recarregar Painel Inicial: card "Clientes por funil" mostra Creatina = 1, sem linha "Sem funil atribuído".
