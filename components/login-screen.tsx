"use client"

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
              <Label htmlFor="username">Usuario</Label>
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
            {demo && <div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Credenciais de teste:</p>
              <p className="mt-1">Operador: <span className="font-mono">operador / 1234</span></p>
              <p>Supervisor: <span className="font-mono">supervisor / adm123</span></p>
            </div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
