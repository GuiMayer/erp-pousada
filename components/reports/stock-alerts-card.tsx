"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StockAlertsCardProps {
  data: Array<{
    productId: string
    productName: string
    currentStock: number
    minimumStock: number
    unit: string
    status: 'critical' | 'low'
  }>
}

export function StockAlertsCard({ data }: StockAlertsCardProps) {
  const criticalItems = data.filter(item => item.status === 'critical')
  const lowItems = data.filter(item => item.status === 'low')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Alertas de Estoque
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum alerta de estoque
          </p>
        ) : (
          <div className="space-y-4">
            {criticalItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Crítico ({criticalItems.length})
                </h4>
                <div className="space-y-2">
                  {criticalItems.map(item => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {item.currentStock} {item.unit} (mínimo: {item.minimumStock})
                        </p>
                      </div>
                      <Badge variant="destructive">Crítico</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lowItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-warning mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Baixo ({lowItems.length})
                </h4>
                <div className="space-y-2">
                  {lowItems.map(item => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {item.currentStock} {item.unit} (mínimo: {item.minimumStock})
                        </p>
                      </div>
                      <Badge variant="outline" className="border-warning text-warning">
                        Baixo
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
