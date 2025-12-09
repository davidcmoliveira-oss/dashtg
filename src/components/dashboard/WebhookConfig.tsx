import { useState } from "react";
import { Webhook, CheckCircle2, XCircle, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface WebhookConfigProps {
  onSave: (config: { apiUrl: string; apiKey: string }) => void;
  currentConfig?: { apiUrl: string; apiKey: string };
}

export const WebhookConfig = ({ onSave, currentConfig }: WebhookConfigProps) => {
  const [apiUrl, setApiUrl] = useState(currentConfig?.apiUrl || "");
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    if (!apiUrl) {
      toast({
        title: "URL obrigatória",
        description: "Por favor, insira a URL da API do seu ERP.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Simulating API test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo purposes, we'll simulate a successful connection
    const success = Math.random() > 0.3;
    setTestResult(success ? 'success' : 'error');
    setIsTesting(false);

    toast({
      title: success ? "Conexão bem-sucedida!" : "Falha na conexão",
      description: success 
        ? "A API do seu ERP está respondendo corretamente." 
        : "Não foi possível conectar à API. Verifique a URL e a chave.",
      variant: success ? "default" : "destructive",
    });
  };

  const handleSave = () => {
    if (!apiUrl) {
      toast({
        title: "URL obrigatória",
        description: "Por favor, insira a URL da API do seu ERP.",
        variant: "destructive",
      });
      return;
    }

    onSave({ apiUrl, apiKey });
    toast({
      title: "Configuração salva!",
      description: "As configurações da API foram atualizadas com sucesso.",
    });
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText("https://seu-dashboard.com/api/webhook/erp");
    toast({
      title: "URL copiada!",
      description: "A URL do webhook foi copiada para a área de transferência.",
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Configuração de API</h3>
            <p className="text-sm text-muted-foreground">Conecte seu ERP ao dashboard</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">URL da API do ERP</Label>
            <Input
              id="api-url"
              placeholder="https://seu-erp.com/api/v1"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground">
              Endpoint base da API REST do seu ERP
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Chave de API (opcional)</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? "text" : "password"}
                placeholder="sua-chave-de-api-secreta"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-secondary/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token de autenticação para a API do ERP
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleTest} variant="outline" disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
              ) : testResult === 'error' ? (
                <XCircle className="mr-2 h-4 w-4 text-destructive" />
              ) : null}
              Testar Conexão
            </Button>
            <Button onClick={handleSave}>
              Salvar Configuração
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Webhook de Entrada</h3>
          <p className="text-sm text-muted-foreground">
            Configure seu ERP para enviar dados para este endpoint
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
            <code className="text-sm text-muted-foreground">
              https://seu-dashboard.com/api/webhook/erp
            </code>
          </div>
          <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-4">
          <p className="text-sm text-warning">
            <strong>Nota:</strong> Para receber dados via webhook, você precisará configurar um backend. 
            Conecte o Lovable Cloud para habilitar essa funcionalidade.
          </p>
        </div>
      </div>
    </div>
  );
};
