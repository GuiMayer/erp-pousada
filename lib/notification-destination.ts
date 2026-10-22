export type StockDestination = {
  module: "estoque";
  section: "lots" | "movements";
  id: string;
};
export function notificationDestination(event: {
  module?: string | null;
  conditionKey?: string | null;
  reference?: string | null;
}): StockDestination | undefined {
  if (event.module !== "estoque" || !event.reference) return undefined;
  if (event.conditionKey?.startsWith("expiry:"))
    return { module: "estoque", section: "lots", id: event.reference };
  if (event.conditionKey?.startsWith("stock:"))
    return { module: "estoque", section: "movements", id: event.reference };
  return undefined;
}
