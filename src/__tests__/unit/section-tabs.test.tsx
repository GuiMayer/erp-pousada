import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SectionTabs } from "@/components/section-tabs"

it("navega entre áreas com painéis identificados e não mantém conteúdo inativo na tela", () => {
  function Example() {
    const [value, change] = useState("people")
    return <SectionTabs label="Cadastros liberados" value={value} onValueChange={change} sections={[{key:"people",label:"Pessoas"},{key:"drinks",label:"Bebidas"}]}>{value === "people" ? "Cadastro de pessoas" : "Catálogo de bebidas"}</SectionTabs>
  }
  render(<Example />)
  expect(screen.getByRole("tablist", {name:"Cadastros liberados"})).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole("tab", {name:"Bebidas"}), {button:0,ctrlKey:false})
  expect(screen.getByRole("tab", {name:"Bebidas"})).toHaveAttribute("aria-selected","true")
  expect(screen.getByRole("tabpanel", {name:"Bebidas"})).toHaveTextContent("Catálogo de bebidas")
  expect(screen.queryByText("Cadastro de pessoas")).not.toBeInTheDocument()
})

it("reativa painéis retidos sem remontar os formulários nem perder rascunhos", () => {
  function Example() {
    const [value, change] = useState("people")
    return <Tabs value={value} onValueChange={change}>
      <TabsList aria-label="Áreas"><TabsTrigger value="people">Pessoas</TabsTrigger><TabsTrigger value="drinks">Bebidas</TabsTrigger></TabsList>
      <TabsContent value="people" forceMount className="data-[state=inactive]:hidden"><input aria-label="Nome em edição" defaultValue="" /></TabsContent>
      <TabsContent value="drinks">Catálogo</TabsContent>
    </Tabs>
  }
  render(<Example />)
  const field = screen.getByLabelText("Nome em edição")
  const panel = field.closest('[data-slot="tabs-content"]')
  fireEvent.change(field, { target: { value: "Rascunho da recepção" } })
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Bebidas" }), { button: 0, ctrlKey: false })
  expect(panel).toHaveAttribute("data-state", "inactive")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Pessoas" }), { button: 0, ctrlKey: false })
  expect(panel).toHaveAttribute("data-state", "active")
  expect(screen.getByLabelText("Nome em edição")).toBe(field)
  expect(field).toHaveValue("Rascunho da recepção")
})

it("trocar uma sub-aba não altera a seleção nem o formulário da aba principal", () => {
  function Example() {
    return <Tabs defaultValue="registration">
      <TabsList aria-label="Módulos"><TabsTrigger value="registration">Cadastros</TabsTrigger><TabsTrigger value="other">Outro módulo</TabsTrigger></TabsList>
      <TabsContent value="registration"><input aria-label="Busca preservada" defaultValue="Ana" /><Tabs defaultValue="people">
        <TabsList aria-label="Subseções"><TabsTrigger value="people">Pessoas</TabsTrigger><TabsTrigger value="suppliers">Fornecedores</TabsTrigger></TabsList>
        <TabsContent value="people">Lista de pessoas</TabsContent><TabsContent value="suppliers">Lista de fornecedores</TabsContent>
      </Tabs></TabsContent><TabsContent value="other">Outro conteúdo</TabsContent>
    </Tabs>
  }
  render(<Example />)
  const field = screen.getByLabelText("Busca preservada")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Fornecedores" }), { button: 0, ctrlKey: false })
  expect(screen.getByRole("tab", { name: "Cadastros" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel", { name: "Fornecedores" })).toHaveTextContent("Lista de fornecedores")
  expect(screen.getByLabelText("Busca preservada")).toBe(field)
  expect(field).toHaveValue("Ana")
})
