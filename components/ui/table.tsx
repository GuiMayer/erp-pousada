'use client'

import * as React from 'react'

import { usePhoneLayout } from '@/hooks/use-phone-layout'
import { Button } from './button'
import { cn } from '@/lib/utils'

const MobileColumns = React.createContext<{ columns?: string[]; preview?: string[] }>({})

function Table({ className, mobileColumns, mobilePreview, ...props }: React.ComponentProps<'table'> & { mobileColumns?: string[]; mobilePreview?: string[] }) {
  return (
    <MobileColumns.Provider value={{ columns: mobileColumns, preview: mobilePreview }}>
    <div
      data-slot="table-container"
      className="relative min-w-0 w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        data-mobile-cards={mobileColumns ? '' : undefined}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
    </MobileColumns.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, children, ...props }: React.ComponentProps<'tbody'>) {
  const phone = usePhoneLayout()
  const { preview } = React.useContext(MobileColumns)
  const [page, setPage] = React.useState(0)
  const rows = React.Children.toArray(children)
  const signature = rows.map(child => React.isValidElement(child) ? child.key : '').join('|')
  React.useEffect(() => { setPage(0) }, [signature])
  const paginate = phone && !!preview && rows.length > 15
  const pages = Math.ceil(rows.length / 15)
  const current = Math.min(page, Math.max(0, pages - 1))
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props}>
    {paginate ? rows.slice(current * 15, (current + 1) * 15) : children}
    {paginate && <tr className="mobile-pagination"><td colSpan={100}><div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</Button>
      <span aria-live="polite" className="text-sm">{current + 1} de {pages}</span>
      <Button variant="outline" size="sm" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Próxima</Button>
    </div></td></tr>}
  </tbody>
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, children, ...props }: React.ComponentProps<'tr'>) {
  const { columns, preview } = React.useContext(MobileColumns)
  const [expanded, setExpanded] = React.useState(false)
  const cells = React.Children.toArray(children)
  const expandable = !!preview && !!columns?.some(label => !preview.includes(label) && !/^Aç[ãõ]o|^Ações$/.test(label))
  return (
    <tr
      data-slot="table-row"
      data-mobile-expanded={expanded ? "true" : "false"}
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    >
      {columns ? React.Children.toArray(children).map((child, index) => {
        if (!React.isValidElement<React.ComponentProps<'td'>>(child) || child.type !== TableCell || child.props.colSpan) return child
        const secondary = !!preview && !preview.includes(columns[index]) && !/^Aç[ãõ]o|^Ações$/.test(columns[index])
        const last = index === cells.length - 1
        return React.cloneElement(child, { 'data-label': columns[index], 'data-mobile-primary': columns[index] === preview?.[0] ? '' : undefined, 'data-mobile-secondary': secondary ? '' : undefined,
          children: <>{child.props.children}{last && expandable && <Button className="mobile-record-details sm:hidden" variant="ghost" size="sm" aria-expanded={expanded} onClick={event => { event.stopPropagation(); setExpanded(value => !value) }}>{expanded ? 'Menos detalhes' : 'Ver detalhes'}</Button>}</>,
        } as React.ComponentProps<'td'>)
      }) : children}
    </tr>
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
