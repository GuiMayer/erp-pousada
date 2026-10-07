import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { validateSupervisorPasswordAsync } from "@/lib/utils/validators"

type SupervisorApprovalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: () => void
  title: string
  description: string
}

/**
 * Reusable supervisor approval dialog
 */
export function SupervisorApprovalDialog({
  open,
  onOpenChange,
  onApprove,
  title,
  description,
}: SupervisorApprovalDialogProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleApprove = async () => {
    if (await validateSupervisorPasswordAsync(password)) {
      setError("")
      setPassword("")
      onApprove()
      onOpenChange(false)
    } else {
      setError("Senha incorreta")
    }
  }

  const handleClose = () => {
    setPassword("")
    setError("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supervisor-password">Senha do Supervisor</Label>
            <Input
              id="supervisor-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApprove()}
              placeholder="Digite a senha"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleApprove}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
