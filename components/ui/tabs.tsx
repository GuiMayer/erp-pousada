'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '@/lib/utils'

const MobileTabContext = React.createContext({ value: "", change: (_value: string) => {} })

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [localValue, setLocalValue] = React.useState(props.defaultValue ?? "")
  const change = (value: string) => { setLocalValue(value); props.onValueChange?.(value) }
  return (
    <MobileTabContext.Provider value={{ value: props.value ?? localValue, change }}><TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
      value={props.value ?? localValue}
      onValueChange={change}
    /></MobileTabContext.Provider>
  )
}

function TabsList({ className, children, mobilePriority, ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { mobilePriority?: string[] }) {
  const selection = React.useContext(MobileTabContext)
  const items = React.Children.toArray(children).filter((child): child is React.ReactElement<{ value: string; children: React.ReactNode }> => React.isValidElement(child) && child.type === TabsTrigger)
  const ordered = mobilePriority ? [...items].sort((a, b) => {
    const rank = (value: string) => { const index = mobilePriority.indexOf(value); return index < 0 ? 100 : index }
    return rank(a.props.value) - rank(b.props.value)
  }) : items
  const hasMenu = items.length > 3 && !className?.includes('bg-transparent') && !className?.includes('hidden')
  return <>
    <TabsPrimitive.List data-slot="tabs-list" className={cn('bg-muted text-muted-foreground inline-flex h-auto max-w-full w-fit flex-wrap items-center justify-start gap-1 rounded-lg p-[3px] sm:min-h-9', hasMenu && 'mobile-desktop-tabs', className)} {...props}>{children}</TabsPrimitive.List>
    {hasMenu && <div className="mobile-section-nav sm:hidden">
      <TabsPrimitive.List aria-label="Seções principais" className="grid grid-cols-3 gap-1">{ordered.slice(0, 3)}</TabsPrimitive.List>
      <Select value={ordered.slice(3).some(item => item.props.value === selection.value) ? selection.value : ''} onValueChange={selection.change}>
        <SelectTrigger aria-label="Outras opções desta área" className="w-full"><SelectValue placeholder="Outras opções" /></SelectTrigger>
        <SelectContent>{ordered.slice(3).map(item => <SelectItem key={item.props.value} value={item.props.value}>{item.props.children}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
  </>
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('min-w-0 flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
