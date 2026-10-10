import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { CompanyAffiliationField, CompanyMembers } from "@/components/company-affiliation"
import CustomersManagement from "@/components/customers-management"
import { CustomerCombobox } from "@/components/customer-combobox"
import type { Customer } from "@/lib/store"

const updateCustomer = vi.fn()
const addCustomer = vi.fn()
const people: Customer[] = [
  { id: "company", name: "Empresa A", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true, createdAt: "", updatedAt: "" },
  { id: "employee", name: "Pessoa A", cpfCnpj: "52998224725", roles: ["guest", "payer"], companyId: "company", recordVersion: 2, active: true, createdAt: "", updatedAt: "" },
  { id: "unrelated", name: "Pessoa B", cpfCnpj: "11144477735", roles: ["guest"], active: true, createdAt: "", updatedAt: "" },
]
vi.mock("@/lib/app-context", () => ({ useApp: () => ({ customers: people, accountsReceivable: [], updateCustomer, addCustomer, addAuditEntry: vi.fn() }) }))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ can: () => true, username: "Teste" }) }))
describe("Ficha de empresa e vínculo cadastral", () => {
  it("mostra somente empresas elegíveis e permite remover o vínculo", () => {
    const onChange = vi.fn()
    render(<CompanyAffiliationField people={people} document="52998224725" value="company" onChange={onChange} />)
    const field = screen.getByLabelText("Empresa vinculada (opcional)")
    expect(within(field).getAllByRole("option")).toHaveLength(2)
    fireEvent.change(field, { target: { value: "" } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
  it("lista apenas as pessoas vinculadas na ficha da empresa", () => {
    render(<CompanyMembers companyId="company" people={people} />)
    expect(screen.getByText("Funcionários vinculados (1)")).toBeInTheDocument()
    expect(screen.getByText("Pessoa A")).toBeInTheDocument()
    expect(screen.queryByText("Pessoa B")).not.toBeInTheDocument()
  })
  it("edição da pessoa envia remoção explícita e conserva a versão do cadastro", async () => {
    updateCustomer.mockReset()
    render(<CustomersManagement />)
    fireEvent.click(screen.getByRole("button", { name: "Editar Pessoa A" }))
    fireEvent.change(screen.getByLabelText("Empresa vinculada (opcional)"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith("employee", expect.objectContaining({ companyId: null, recordVersion: 2 })))
  })
  it("abre a ficha da empresa com seus funcionários pela lista de cadastros", () => {
    render(<CustomersManagement />)
    fireEvent.click(screen.getByRole("button", { name: "Ver ficha de Empresa A" }))
    expect(screen.getByRole("region", { name: "Funcionários vinculados" })).toHaveTextContent("Pessoa A")
  })
  it("cadastro rápido devolve a pessoa criada com a empresa sem esperar atualização da lista", async () => {
    const person = { ...people[1], id: "new-person", cpfCnpj: "39053344705", name: "Pessoa nova" }
    addCustomer.mockResolvedValueOnce(person)
    const onChange = vi.fn()
    render(<CustomerCombobox purpose="guest" onChange={onChange} />)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("Criar novo cliente"))
    fireEvent.change(screen.getByLabelText(/Nome \/ Razão Social/), { target: { value: person.name } })
    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), { target: { value: person.cpfCnpj } })
    fireEvent.change(screen.getByLabelText("Empresa vinculada (opcional)"), { target: { value: "company" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar Cliente" }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(person.id, person.name, person))
    expect(addCustomer).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company", roles: ["guest", "payer"] }))
  })
})
