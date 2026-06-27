
-- Tornar políticas dos CRM TG públicas (alinhado ao restante do dashboard sem auth)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crmtg_settings','crmtg_funnels','crmtg_funnel_touches',
    'crmtg_customer_state','crmtg_daily_queue','crmtg_daily_run_log','crmtg_history'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'public_all_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', 'public_all_' || t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Seed funil de Reativação se não houver nenhum funil
INSERT INTO public.crmtg_funnels (nome, categoria, prioridade, ativo, produtos_gatilho, observacoes)
SELECT 'Reativação 45+ dias', 'reativacao', 10, true, ARRAY[]::text[],
       'Disparado para clientes sem comprar há 45+ dias. Dia 0 = hoje na primeira execução.'
WHERE NOT EXISTS (SELECT 1 FROM public.crmtg_funnels WHERE categoria = 'reativacao');

-- Toques padrão do funil de reativação (dia 0, 3, 7, 14)
WITH f AS (SELECT id FROM public.crmtg_funnels WHERE categoria='reativacao' ORDER BY prioridade LIMIT 1)
INSERT INTO public.crmtg_funnel_touches (funnel_id, ordem, dia_offset, mensagem_v1, mensagem_v2, mensagem_v3)
SELECT f.id, v.ordem, v.dia_offset, v.m1, v.m2, v.m3
FROM f, (VALUES
  (1, 0, 'Oi {{nome}}! Notamos que faz um tempo desde sua última compra. Posso te ajudar com algo?',
         'Olá {{nome}}, sentimos sua falta por aqui! Que tal repor seus produtos favoritos?',
         '{{nome}}, separei algumas novidades pra você. Quer dar uma olhada?'),
  (2, 3, '{{nome}}, ainda dá tempo de reabastecer com condições especiais essa semana.',
         'Oi {{nome}}! Preparei uma seleção pensando no seu perfil. Posso enviar?',
         '{{nome}}, posso te mostrar o que está saindo bastante por aqui?'),
  (3, 7, '{{nome}}, faz uma semana que conversamos. Posso ajudar com seu pedido?',
         'Oi {{nome}}, conseguimos garantir frete reduzido nessa semana. Topa?',
         '{{nome}}, separei algumas opções rápidas pra repor seu estoque.'),
  (4, 14, '{{nome}}, última chance dessa semana com nossas condições. Vamos fechar?',
         'Oi {{nome}}, posso reservar seus produtos favoritos pra hoje?',
         '{{nome}}, fechamos pedido hoje? Tenho um combo bom pra te enviar.')
) v(ordem, dia_offset, m1, m2, m3)
WHERE NOT EXISTS (SELECT 1 FROM public.crmtg_funnel_touches WHERE funnel_id = f.id);
