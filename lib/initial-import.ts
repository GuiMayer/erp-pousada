export const importKinds = ["people", "products", "opening"] as const;
export type ImportKind = (typeof importKinds)[number];
export const importColumns: Record<ImportKind, string[]> = {
  people: ["nome", "documento", "papeis", "telefone", "email", "empresa"],
  products: [
    "nome",
    "categoria",
    "unidade",
    "preco",
    "codigo_barras",
    "controla_estoque",
    "exige_validade",
  ],
  opening: [
    "produto",
    "codigo_barras",
    "quantidade",
    "lote",
    "validade",
    "custo_total",
    "custo_estimado",
    "motivo",
  ],
};
export function parseImportCSV(
  text: string,
  kind: ImportKind,
): Record<string, string>[] {
  if (new TextEncoder().encode(text).length > 131072)
    throw Error("Arquivo excede 128 KB");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  const push = () => {
      row.push(field.trim());
      field = "";
      closed = false;
    },
    finish = () => {
      push();
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (rows.length > 101) throw Error("Use até 100 linhas por importação");
    };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw Error("Aspas inválidas no CSV");
      quoted = true;
    } else if (c === ";") push();
    else if (c === "\n") {
      finish();
    } else if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      finish();
    } else {
      if (closed && !/\s/.test(c)) throw Error("Texto após aspas no CSV");
      field += c;
    }
  }
  if (quoted) throw Error("Aspas não fechadas no CSV");
  finish();
  const header = rows.shift(),
    columns = importColumns[kind];
  if (
    !header ||
    header.length !== columns.length ||
    new Set(header).size !== header.length ||
    columns.some((c) => !header.includes(c))
  )
    throw Error(`Cabeçalho esperado: ${columns.join(";")}`);
  if (!rows.length) throw Error("Arquivo sem registros");
  return rows.map((values, i) => {
    if (values.length !== header.length)
      throw Error(`Linha ${i + 2}: quantidade de colunas inválida`);
    return Object.fromEntries(header.map((h, j) => [h, values[j]]));
  });
}
export function importTemplate(kind: ImportKind) {
  return "\uFEFF" + importColumns[kind].join(";") + "\r\n";
}
export const csvCell = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^([\s]*[=+@-])/u, "'$1")
    .replace(/"/g, '""') +
  '"';
export type ImportLine = {
  line: number;
  label: string;
  state: "new" | "same" | "invalid";
  error?: string;
  payload?: Record<string, unknown>;
  basis?: Record<string, unknown>;
};
export type ImportPreview = {
  id: string;
  kind: ImportKind;
  expiresAt: string;
  state: string;
  rows: ImportLine[];
};
