"use client"
import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"

export function SectionTabs({ label, value, onValueChange, sections, children }: {
  label: string; value?: string; onValueChange: (value: string) => void;
  sections: readonly { key: string; label: string }[]; children: ReactNode;
}) {
  return <Tabs value={value} onValueChange={onValueChange} className="gap-4">
    <TabsList aria-label={label} className="section-tabs">{sections.map(section => <TabsTrigger key={section.key} value={section.key}>{section.label}</TabsTrigger>)}</TabsList>
    {sections.map(section => <TabsContent key={section.key} value={section.key}>{value === section.key ? children : null}</TabsContent>)}
  </Tabs>
}
