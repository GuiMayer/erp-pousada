"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { demoAccounts } from "@/lib/demo-accounts"
import { initializeBrowserDemo } from "@/lib/demo-data"
import { createDataStore } from "@/lib/data/repositories"
import { getDataConfig } from "@/lib/data/config"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useApp } from "@/lib/app-context"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { BedDouble, LogIn } from "lucide-react"

export function LoginScreen() {
  const { login } = useAuth()
  const { systemSettings } = useApp()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const [demoOpen, setDemoOpen] = useState(getDataConfig().adapter === "demo-localStorage")
  const [demoMessage, setDemoMessage] = useState("")
  const [resetting, setResetting] = useState(false)
  const [pending, setPending] = useState(false)
  const demo = getDataConfig().adapter === "demo-localStorage"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setPending(true)
    try {
      const success = await login(username, password)
      if (!success) setError("Credenciais inválidas. Tente novamente.")
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível entrar") }
    finally { setPending(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 pb-2 pt-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary">
            <BedDouble className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{demo ? systemSettings.pousadaName : "ERP Pousada"}</h1>
          <p className="text-sm text-muted-foreground">Acesse o painel de gerenciamento</p>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                placeholder="Seu usuário"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button disabled={pending} type="submit" className="mt-1 gap-2">
              <LogIn className="size-4" />
              Entrar
            </Button>
            {demo && <Button type="button" variant="outline" onClick={() => setDemoOpen(true)}>Acessos da demonstração</Button>}

          </form>
        </CardContent>
      </Card>
      {demo && <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent mobileTask>
          <DialogHeader><DialogTitle>Explore a demonstração</DialogTitle><DialogDescription>Dados fictícios, exclusivos deste navegador. Use um dos acessos abaixo; nenhuma conta precisa ser criada.</DialogDescription></DialogHeader>
          <div className="min-w-0 space-y-3 break-words">
            {[{ username: "supervisor", password: "adm123", label: "Supervisor · acesso completo" }, { username: "operador", password: "1234", label: "Operador · atendimento" }].map(account => <div key={account.username} className="rounded-lg border p-3 space-y-2">
              <p className="font-medium">{account.label}</p><p className="text-sm">Usuário: <code>{account.username}</code> · Senha: <code>{account.password}</code></p>
              <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => { setUsername(account.username); setPassword(account.password); setDemoOpen(false) }}>Preencher acesso de {account.username}</Button>
            </div>)}
            <p className="text-sm text-muted-foreground">As alterações ficam neste navegador. Ao acessar em outro dia, os exemplos são renovados. Para recomeçar agora, restaure os exemplos.</p>
            <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal" disabled={resetting} onClick={async () => {
              setResetting(true); setDemoMessage("")
              try { await initializeBrowserDemo(createDataStore({ prefix: "erp-pousada-demo", enableSync: false }), true); setDemoMessage("Exemplos restaurados. Você já pode entrar.") }
              catch { setDemoMessage("Não foi possível restaurar. Verifique se o navegador permite armazenamento local.") }
              finally { setResetting(false) }
            }}>{resetting ? "Restaurando…" : "Restaurar exemplos e descartar alterações"}</Button>
            {demoMessage && <p role="status" className="text-sm">{demoMessage}</p>}
          </div>
        </DialogContent>
      </Dialog>}

    </div>
  )
}
