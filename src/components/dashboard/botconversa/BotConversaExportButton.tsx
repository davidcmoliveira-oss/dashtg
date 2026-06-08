import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BotConversaExportDialog, BotConversaCustomer } from "./BotConversaExportDialog";

interface Props {
  customers: BotConversaCustomer[];
  reportSlug: string;
  size?: "sm" | "default";
}

export const BotConversaExportButton = ({ customers, reportSlug, size = "sm" }: Props) => {
  const [open, setOpen] = useState(false);
  const disabled = customers.length === 0;

  const btn = (
    <Button
      size={size}
      variant="outline"
      className="gap-1.5"
      disabled={disabled}
      onClick={() => setOpen(true)}
    >
      <FileSpreadsheet className="h-4 w-4" />
      Exportar para BotConversa
    </Button>
  );

  return (
    <>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{btn}</span>
            </TooltipTrigger>
            <TooltipContent>Nenhum cliente disponível para exportar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        btn
      )}
      <BotConversaExportDialog
        open={open}
        onOpenChange={setOpen}
        customers={customers}
        reportSlug={reportSlug}
      />
    </>
  );
};
