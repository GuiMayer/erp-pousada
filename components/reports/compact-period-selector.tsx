"use client"

import { DateField } from "@/components/ui/date-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "lucide-react"

interface CompactPeriodSelectorProps {
  selectedPeriod: 'today' | 'week' | 'month' | 'custom'
  startDate: string
  endDate: string
  onPeriodChange: (period: 'today' | 'week' | 'month' | 'custom') => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export function CompactPeriodSelector({
  selectedPeriod,
  startDate,
  endDate,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
}: CompactPeriodSelectorProps) {
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today':
        return 'Hoje'
      case 'week':
        return 'Esta Semana'
      case 'month':
        return 'Este Mês'
      case 'custom':
        return 'Personalizado'
      default:
        return 'Selecione'
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium whitespace-nowrap">Período:</Label>
        <Select value={selectedPeriod} onValueChange={(value) => onPeriodChange(value as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue>{getPeriodLabel()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="custom">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Personalizado
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedPeriod === 'custom' && (
        <div className="flex items-center gap-2">
          <DateField
            
            value={startDate}
            onValueChange={value => onStartDateChange(value)}
            className="w-[140px]"
            aria-label="Data inicial"
          />
          <span className="text-sm text-muted-foreground">até</span>
          <DateField
            
            value={endDate}
            onValueChange={value => onEndDateChange(value)}
            className="w-[140px]"
            aria-label="Data final"
          />
        </div>
      )}
    </div>
  )
}
