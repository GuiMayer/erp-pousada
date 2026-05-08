"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/price-calculations"

interface TopProductsTableProps {
  data: Array<{
    productId: string
    productName: string
    category: string
    quantity: number
    revenue: number
    averagePrice: number
  }>
  limit?: number
}

export function TopProductsTable({ data, limit = 10 }: TopProductsTableProps) {
  const displayData = data.slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top {limit} Produtos Mais Vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Preço Médio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum produto vendido no período
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((product, index) => (
                <TableRow key={product.productId}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="font-medium">{product.productName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{product.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(product.averagePrice)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
