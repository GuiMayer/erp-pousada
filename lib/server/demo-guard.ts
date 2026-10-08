// Explicitly closed target: demo scripts must never use the operational server.
export function assertDemoTarget(url: string | undefined, enabled: string | undefined) {
  if (enabled !== "true" || !url) throw new Error("A demonstração exige DEMO_MODE=true e seu banco isolado")
  const target = new URL(url)
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.hostname !== "postgres-demo" || target.pathname !== "/pousada_demo" || target.port && target.port !== "5432") throw new Error("Banco recusado: use exclusivamente postgres-demo/pousada_demo")
}
