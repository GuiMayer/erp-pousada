"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "lucide-react"
import { getTodayISO } from "@/lib/utils/constants"

interface PeriodSelectorProps {
  selectedPeriod: 'today' | 'week' | 'month' | 'custom'
  startDate: string
  endDate: string
  onPeriodChange: (period: 'today' | 'week' | 'month' | 'custom') => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export function PeriodSelector({
  selectedPeriod,
  startDate,
  endDate,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant={selectedPeriod === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange('today')}
        >
          Hoje
        </Button>
        <Button
          variant={selectedPeriod === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange('week')}
        >
          Semana
        </Button>
        <Button
          variant={selectedPeriod === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange('month')}
        >
          Mês
        </Button>
        <Button
          variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPeriodChange('custom')}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Personalizado
        </Button>
      </div>

      {selectedPeriod === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="start-date" className="text-sm">De:</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="end-date" className="text-sm">Até:</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
