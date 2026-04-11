import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AiInsightsPanelProps {
  defaultPrompt: string;
  contextData: Record<string, any>;
}

export const AiInsightsPanel = ({ defaultPrompt, contextData }: AiInsightsPanelProps) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { prompt: prompt.trim(), context: contextData },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Limite de requisições atingido. Tente novamente em alguns segundos.");
        } else if (data.error.includes("Payment")) {
          toast.error("Créditos insuficientes. Adicione créditos nas configurações.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setAnalysis(data?.analysis || "Nenhuma análise retornada.");
    } catch (err: any) {
      console.error("AI insights error:", err);
      toast.error("Erro ao gerar insights. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Insights com IA</h3>
      </div>

      <div className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escreva sua solicitação de análise..."
          className="min-h-[80px] text-sm"
        />
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isLoading ? "Analisando..." : "Gerar Insights"}
        </Button>
      </div>

      {isLoading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {analysis && !isLoading && (
        <div className="mt-4 rounded-lg bg-secondary/50 p-4 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{analysis}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};
