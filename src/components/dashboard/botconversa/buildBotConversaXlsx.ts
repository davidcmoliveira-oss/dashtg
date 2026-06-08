import * as XLSX from "xlsx";

export interface BotConversaContact {
  customer_id: string;
  customer_name: string;
  phone: string | null;
}

const splitName = (full: string): [string, string] => {
  const tokens = (full || "").trim().split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) return ["", ""];
  const [first, ...rest] = tokens;
  return [first, rest.join(" ")];
};

const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;

export function buildBotConversaXlsx(
  contacts: BotConversaContact[],
  etiqueta: string,
  reportSlug: string,
): { exported: number; ignored: number } {
  const valid = contacts.filter((c) => c.phone && c.phone.length >= 12);
  const ignored = contacts.length - valid.length;

  const rows: (string | number)[][] = [
    ["Primeiro nome", "Sobrenome", "Telefone", "Etiquetas"],
  ];
  valid.forEach((c) => {
    const [first, last] = splitName(c.customer_name);
    rows.push([first, last, c.phone as string, etiqueta || ""]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  XLSX.writeFile(wb, `botconversa_${reportSlug}_${ddmmyyyy(new Date())}.xlsx`);

  return { exported: valid.length, ignored };
}
