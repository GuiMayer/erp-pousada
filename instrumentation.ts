export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDataConfig } = await import("./lib/data/config")
    if (getDataConfig().adapter === "demo-localStorage") {
      const { demoStartedAt } = await import("./lib/server/demo-session")
      demoStartedAt()
    }
  }
}
