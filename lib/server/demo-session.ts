/** One anchor per Node server process, shared by all browser demo sessions. */
export function demoStartedAt() {
  return process.env.ERP_DEMO_STARTED_AT ??= new Date(Date.now() - process.uptime() * 1000).toISOString()
}
