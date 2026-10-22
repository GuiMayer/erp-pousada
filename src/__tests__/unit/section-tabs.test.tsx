import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
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
