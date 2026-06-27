import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TZ = "America/Sao_Paulo";
function todayBRT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}
function nowBRTMinutes(): number {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = fmt.format(new Date()).split(":").map(Number);
  return h * 60 + m;
}
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sendBotConversa(apiKey: string, phone: string, flowId: string | null, texto: string) {
  // Cria/garante subscriber
  const subRes = await fetch("https://backend.botconversa.com.br/api/v1/webhook/subscriber/", {
    method: "POST",
    headers: { "API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, first_name: "Cliente", last_name: "TG" }),
  });
  const subData = await subRes.json().catch(() => ({}));
  const subscriberId = subData?.id || subData?.subscriber_id;

  if (subscriberId && flowId) {
    const flowRes = await fetch(`https://backend.botconversa.com.br/api/v1/webhook/subscriber/${subscriberId}/send_flow/`, {
      method: "POST",
      headers: { "API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ flow: flowId }),
    });
    const flowData = await flowRes.json().catch(() => ({}));
    return { ok: flowRes.ok, status: flowRes.status, subscriber: subData, flow: flowData };
  }
  return { ok: subRes.ok, status: subRes.status, subscriber: subData };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apiKey = Deno.env.get("BOTCONVERSA_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "BOTCONVERSA_API_KEY missing" }), { headers, status: 500 });

  try {
    const { data: settings } = await supa.from("crmtg_settings").select("*").eq("id", true).maybeSingle();
    if (!settings) throw new Error("settings ausente");
    if (settings.sistema_pausado) return new Response(JSON.stringify({ skipped: "paused" }), { headers });

    const [sH, sM] = (settings.horario_inicio as string).split(":").map(Number);
    const [eH, eM] = (settings.horario_fim as string).split(":").map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    const nowMin = nowBRTMinutes();
    if (nowMin < startMin || nowMin > endMin) return new Response(JSON.stringify({ skipped: "fora janela" }), { headers });

    const runDate = todayBRT();
    const { data: batch } = await supa.from("crmtg_daily_queue")
      .select("*").eq("run_date", runDate).eq("status", "pending")
      .lte("horario_previsto", new Date().toISOString())
      .order("horario_previsto", { ascending: true })
      .limit(settings.lote_tamanho || 5);

    if (!batch || batch.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers });

    let sent = 0, failed = 0;
    for (const item of batch) {
      try {
        if (!item.telefone_normalizado) {
          await supa.from("crmtg_daily_queue").update({ status: "cancelled", motivo_cancelamento: "sem telefone" }).eq("id", item.id);
          continue;
        }
        // Guard 1 msg/cliente/dia
        const { count } = await supa.from("crmtg_daily_queue").select("*", { count: "exact", head: true })
          .eq("run_date", runDate).eq("customer_id", item.customer_id).eq("status", "sent");
        if ((count || 0) >= 1) {
          await supa.from("crmtg_daily_queue").update({ status: "cancelled", motivo_cancelamento: "limite diário" }).eq("id", item.id);
          continue;
        }

        const resp = await sendBotConversa(apiKey, item.telefone_normalizado, item.flow_id, item.texto_render || "");
        const ok = resp.ok;
        await supa.from("crmtg_daily_queue").update({
          status: ok ? "sent" : "failed",
          enviado_em: new Date().toISOString(),
          botconversa_response: resp as any,
          motivo_cancelamento: ok ? null : `botconversa status ${resp.status}`,
        }).eq("id", item.id);

        await supa.from("crmtg_history").insert({
          queue_id: item.id, run_date: item.run_date, customer_id: item.customer_id, customer_name: item.customer_name,
          telefone_normalizado: item.telefone_normalizado, funnel_id: item.funnel_id, funnel_nome: item.funnel_nome,
          funnel_categoria: item.funnel_categoria, touch_ordem: item.touch_ordem, flow_id: item.flow_id,
          mensagem_versao: item.mensagem_versao, texto_enviado: item.texto_render,
          status: ok ? "sent" : "failed", motivo_cancelamento: ok ? null : `botconversa status ${resp.status}`,
          enviado_em: new Date().toISOString(),
        });
        ok ? sent++ : failed++;
        await sleep(rand(settings.intervalo_min_msg, settings.intervalo_max_msg) * 1000);
      } catch (err) {
        failed++;
        await supa.from("crmtg_daily_queue").update({ status: "failed", motivo_cancelamento: String((err as Error).message) }).eq("id", item.id);
      }
    }

    return new Response(JSON.stringify({ sent, failed, batch: batch.length }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { headers, status: 500 });
  }
});
