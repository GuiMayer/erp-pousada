import type { ReactNode } from "react"

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className={`${!description && !actions ? "hidden sm:flex" : "flex"} min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
    <div className={!description ? "hidden min-w-0 sm:block" : "min-w-0"}><h2 className="hidden text-xl font-semibold tracking-tight sm:block">{title}</h2>{description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}</div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
}
