import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  snapshot: Record<string, any>;
  defaultPrompt?: string;
}

type Level = "geral" | "clientes" | "produtos" | "pedidos" | "mix" | "tendencia";
type Comparison = "period_prev" | "yoy" | "custom";

const levels: Array<{ value: Level; label: string }> = [
  { value: "geral", label: "Geral" },
  { value: "clientes", label: "Clientes" },
  { value: "produtos", label: "Produtos" },
  { value: "pedidos", label: "Pedidos" },
  { value: "mix", label: "Mix" },
  { value: "tendencia", label: "Tendência" },
];

const comparisons: Array<{ value: Comparison; label: string }> = [
  { value: "period_prev", label: "Período anterior" },
  { value: "yoy", label: "Ano anterior" },
  { value: "custom", label: "Custom" },
];

export const AiCustomReport = ({ snapshot, defaultPrompt }: Props) => {
  const [prompt, setPrompt] = useState(defaultPrompt || "Analise os principais movimentos do período: o que cresceu, o que caiu, anomalias e oportunidades práticas.");
  const [level, setLevel] = useState<Level>("geral");
  const [comparison, setComparison] = useState<Comparison>("period_prev");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("reports-ai", {
        body: { prompt: prompt.trim(), level, comparison, snapshot },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate")) toast.error("Limite de requisições. Tente novamente em alguns segundos.");
        else if (data.error.includes("Payment")) toast.error("Créditos insuficientes. Adicione créditos.");
        else toast.error(data.error);
        return;
      }
      setAnalysis(data?.analysis || "Sem resposta.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar relatório.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Relatório personalizado por IA</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Pergunte qualquer coisa sobre o negócio. A IA usa um snapshot dos seus dados para responder com resumo executivo, variações, anomalias, oportunidades, riscos e recomendações.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Nível de análise</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {levels.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`px-2 py-1 text-xs rounded-full border ${level === l.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Comparação</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {comparisons.map((c) => (
              <button
                key={c.value}
                onClick={() => setComparison(c.value)}
                className={`px-2 py-1 text-xs rounded-full border ${comparison === c.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ex: Quais clientes reduziram frequência neste período e quais produtos foram mais afetados?"
      />

      <Button onClick={run} disabled={loading} className="gap-2">
        <Send className="h-4 w-4" />
        {loading ? "Gerando..." : "Gerar relatório"}
      </Button>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {analysis && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 prose prose-sm max-w-none">
          <ReactMarkdown>{analysis}</ReactMarkdown>
        </div>
      )}
    </section>
  );
};
