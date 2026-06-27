import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { headers, status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const contexto: string = body.contexto || "Mensagem de relacionamento via WhatsApp";
    const categoria: string = body.categoria || "generico";
    const dia: number = body.dia_offset ?? 0;
    const produto: string = body.produto || "";

    const prompt = `Você é a Ju da Tangerina Empório. Gere EXATAMENTE 3 versões diferentes de mensagem WhatsApp para um cliente.
Categoria do funil: ${categoria}. Dia do toque: D+${dia}. Produto/contexto: ${produto || contexto}.

Regras:
- Português do Brasil, tom informal, próximo, acolhedor, pessoal.
- Use emojis com moderação (2-3 por mensagem).
- Sempre assine como "Ju da Tangerina 🍊".
- Cada versão deve ser nitidamente diferente das outras (variação de abertura, tom e CTA).
- Curta (até 4 linhas).

Retorne APENAS um JSON válido no formato:
{"v1":"...","v2":"...","v3":"..."}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `gateway ${r.status}: ${t}` }), { headers, status: r.status });
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { v1: content, v2: "", v3: "" }; }
    return new Response(JSON.stringify({ v1: parsed.v1 || "", v2: parsed.v2 || "", v3: parsed.v3 || "" }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { headers, status: 500 });
  }
});
