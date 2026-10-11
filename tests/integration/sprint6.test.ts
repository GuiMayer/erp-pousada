import { beforeAll,beforeEach,afterAll,describe,it,expect } from "vitest"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import type { Actor } from "@/lib/server/auth"
import { personDossier } from "@/lib/server/person-dossier"
import { financialForecast } from "@/lib/server/financial-forecast"
import { previewInitialImport,confirmInitialImport } from "@/lib/server/initial-import"
import { importTemplate } from "@/lib/initial-import"
import { executeOperation } from "@/lib/server/operations"
import { businessDay } from "@/lib/utils/business-values"
import { evaluateTimed } from "@/lib/server/notifications/rules"
import { listInbox } from "@/lib/server/notifications/inbox"
if(new URL(process.env.DATABASE_URL||"postgresql://localhost/invalid").pathname!=="/erp_test")throw Error("S6 exige erp_test isolado")
const prefix="s6-"+randomUUID(),today=businessDay(),day=(n:number)=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10)
let actor:Actor
beforeAll(async()=>{const user=await prisma.user.create({data:{id:prefix,username:prefix,password:"test-only",fullName:"S6",role:"supervisor",accessProfile:"administrador",createdBy:"test"}}),session=await prisma.authSession.create({data:{userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000)}});actor={id:user.id,username:user.username,role:"supervisor",sessionId:session.id,permissions:ALL_PERMISSIONS,approvedUntil:null}})
beforeEach(async()=>{
 await prisma.$executeRawUnsafe("TRUNCATE customers, rooms, product_categories, transactions, stock_inventories, notification_events, initial_import_batches CASCADE")
 await prisma.user.update({where:{id:actor.id},data:{permissionOverrides:{}}})
 await prisma.authSession.upsert({where:{id:actor.sessionId},create:{id:actor.sessionId,userId:actor.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000)},update:{expiresAt:new Date(Date.now()+3600000)}})
 await prisma.customer.create({data:{id:"s6-person",name:"Ana",cpfCnpj:"52998224725",roles:["payer","guest"]}})
 await prisma.guestProfile.create({data:{customerId:"s6-person",cpf:"52998224725",name:"Ana",creditValue:25}})
 await prisma.productCategory.create({data:{id:"s6-category",name:"Bebidas",color:"#000000",icon:"cup",isRestaurant:false}})
 await prisma.pOSProduct.create({data:{id:"s6-water",name:"Água",barcode:"S6-WATER",categoryId:"s6-category",unit:"un",price:20,trackStock:true,requiresExpiry:true}})
 await prisma.bankAccount.create({data:{id:"s6-bank",name:"Conta",type:"corrente",initialBalance:1000,currentBalance:1000}})
})
afterAll(async()=>{await prisma.authSession.deleteMany({where:{userId:prefix}});await prisma.user.delete({where:{id:prefix}})})
const operate=(kind:string,payload:unknown,requestId=randomUUID())=>executeOperation(actor,requestId,kind,payload)
const opening=(code:string,quantity:number,totalCost:number,days:number)=>operate("stock-opening",{productId:"s6-water",quantity,totalCost,code,expiresAt:day(days),reason:"Abertura para testes S6"})
describe("S6: fechamento dos requisitos",()=>{
 it("ficha totaliza saldo parcial e não oferece financeiro ao cadastral",async()=>{
  await prisma.accountReceivable.create({data:{id:"s6-title",customerId:"s6-person",customerName:"Ana",description:"Título",value:600,paidValue:250,status:"pendente",issueDate:new Date(today),dueDate:new Date(day(1))}})
  const data=await personDossier(actor,{id:"s6-person",section:"titles"});expect(data.summary).toEqual({titles:1,pending:350,settled:250});expect(data.credit).toBe(25)
  const restricted=await personDossier({...actor,permissions:["customers.read"]},{id:"s6-person",section:"titles"});expect(restricted.summary).toBeNull();expect(restricted.credit).toBeNull();expect(restricted.rows).toEqual([])
  await expect(personDossier({...actor,permissions:[]},{id:"s6-person"})).rejects.toMatchObject({status:403})
 })
 it("recebimentos da parcela e estorno mantêm origem consultável",async()=>{
  await prisma.accountReceivable.create({data:{id:"s6-title",customerId:"s6-person",customerName:"Ana",description:"Parcelado",value:600,paidValue:0,status:"pendente",issueDate:new Date(today),dueDate:new Date(day(1)),installments:{create:{id:"s6-part",installmentNumber:1,value:600,paidValue:0,dueDate:new Date(day(1)),status:"pendente"}}}})
  await operate("receive-batch",{targets:[{accountReceivableId:"s6-title",installmentId:"s6-part",value:250,recordVersion:0}],paymentMethod:"pix",accountId:"s6-bank"})
  const data=await personDossier(actor,{id:"s6-person",section:"receipts"});expect(data.summary?.pending).toBe(350);expect(data.rows).toHaveLength(1)
 })
 it("projeção acumula saldo e separa vencidos, sem somar parcelas ao título",async()=>{
  await prisma.accountReceivable.create({data:{id:"s6-title",customerId:"s6-person",customerName:"Ana",description:"Receber",value:200,status:"pendente",issueDate:new Date(today),dueDate:new Date(today)}})
  await prisma.expense.create({data:{id:"s6-expense",description:"Pagar",category:"Serviço",value:400,dueDate:new Date(today),installments:{create:[{id:"s6-p1",installmentNumber:1,value:300,dueDate:new Date(today)},{id:"s6-p2",installmentNumber:2,value:100,dueDate:new Date(day(1))}]}}})
  await prisma.accountReceivable.create({data:{id:"s6-old",customerId:"s6-person",customerName:"Ana",description:"Vencido",value:50,status:"vencido",issueDate:new Date(day(-2)),dueDate:new Date(day(-1))}})
  const result=await financialForecast(actor,{days:2,accounts:"s6-bank"});expect(result.rows.filter(r=>r.kind==="saldo-projetado").map(r=>r.value)).toEqual([900,800]);expect(result.metrics.find(m=>m.key==="priorIn")?.value).toBe(50);expect(Number((await prisma.bankAccount.findUniqueOrThrow({where:{id:"s6-bank"}})).currentBalance)).toBe(1000)
  await expect(financialForecast({...actor,permissions:["reports.read"]},{days:2})).rejects.toMatchObject({status:403})
 })
 it("custo por lote mantém histórico e média do saldo, sem alterar preço",async()=>{
  await opening("A",10,50,3);await opening("B",10,100,4)
  await operate("sale",{sale:{id:randomUUID(),items:[{id:randomUUID(),product:{id:"s6-water"},quantity:10,discount:0}],total:200,amountPaid:200,paymentMethod:"pix",accountId:"s6-bank"},globalDiscount:0})
  expect(Number((await prisma.stockItem.findUniqueOrThrow({where:{productId:"s6-water"}})).averageCost)).toBe(10)
  expect(Number((await prisma.stockLot.findFirstOrThrow({where:{code:"A"}})).remainingValue)).toBe(0)
  expect(Number((await prisma.pOSProduct.findUniqueOrThrow({where:{id:"s6-water"}})).price)).toBe(20)
 })
 it("alerta identifica o lote para navegação sem baixa ou resolução implícita",async()=>{
  const result=await opening("VENCE",10,50,1) as {id:string};await prisma.$transaction(tx=>evaluateTimed(tx))
  const inbox=await listInbox(actor),alert=inbox.notifications.find(n=>n.reference===result.id);expect(alert?.destination).toEqual({module:"estoque",section:"lots",id:result.id});expect(Number((await prisma.stockLot.findUniqueOrThrow({where:{id:result.id}})).quantity)).toBe(10)
 })
 it("importa empresa antes da pessoa mesmo fora de ordem e não duplica",async()=>{
  const csv=importTemplate("people")+"José;11144477735;hospede;;;11222333000181\nEmpresa;11222333000181;pagador|fornecedor;;;\n"
  const preview=await previewInitialImport(actor,{kind:"people",csv});expect(preview.rows.every(r=>r.state==="new")).toBe(true);expect(await prisma.customer.count()).toBe(1)
  const result=await confirmInitialImport(actor,{id:preview.id,confirmed:true});expect(result).toMatchObject({created:2})
  const person=await prisma.customer.findFirstOrThrow({where:{cpfCnpj:"11144477735"}}),company=await prisma.customer.findFirstOrThrow({where:{cpfCnpj:"11222333000181"}});expect(person.companyId).toBe(company.id)
  expect(await confirmInitialImport(actor,{id:preview.id,confirmed:true})).toEqual(result);expect((await previewInitialImport(actor,{kind:"people",csv})).state).toBe("confirmed");expect(await prisma.customer.count()).toBe(3)
 })
 it("rejeita duplicados/invalidade na prévia e não confirma conjunto incompleto",async()=>{
  const preview=await previewInitialImport(actor,{kind:"people",csv:importTemplate("people")+"José;11144477735;hospede;;;\nJosé;11144477735;hospede;;;\n"});expect(preview.rows.every(r=>r.state==="invalid")).toBe(true)
  await expect(confirmInitialImport(actor,{id:preview.id,confirmed:true})).rejects.toMatchObject({status:409});expect(await prisma.customer.count()).toBe(1)
 })
 it("abertura importada fica rastreada/estimada e repetição não soma saldo",async()=>{
  const csv=importTemplate("opening")+`Água;S6-WATER;10;IMPORT;${day(10)};50;sim;Contagem de implantação\n`,preview=await previewInitialImport(actor,{kind:"opening",csv})
  expect(preview.rows[0].state).toBe("new");await confirmInitialImport(actor,{id:preview.id,confirmed:true});await confirmInitialImport(actor,{id:preview.id,confirmed:true})
  const lot=await prisma.stockLot.findFirstOrThrow({where:{code:"IMPORT"}});expect(Number(lot.quantity)).toBe(10);expect(lot.costEstimated).toBe(true);expect(lot.reason).toContain(preview.id)
  const changed=await previewInitialImport(actor,{kind:"opening",csv:csv.replace("Contagem de implantação","Outra contagem de implantação")});expect(changed.rows[0].state).toBe("invalid")
 })
 it("importa produto sem estoque e não concede restauração/usuários",async()=>{
  const preview=await previewInitialImport(actor,{kind:"products",csv:importTemplate("products")+"Serviço;Bebidas;un;10;;nao;nao\n"});await confirmInitialImport(actor,{id:preview.id,confirmed:true});expect((await prisma.pOSProduct.findFirstOrThrow({where:{name:"Serviço"}})).trackStock).toBe(false)
  await expect(previewInitialImport({...actor,permissions:["customers.create","customers.read"]},{kind:"people",csv:importTemplate("people")+"José;11144477735;hospede;;;\n"})).rejects.toMatchObject({status:403})
 })
 it("prévia expirada ou permissão revogada impede confirmação",async()=>{
  const preview=await previewInitialImport(actor,{kind:"people",csv:importTemplate("people")+"José;11144477735;hospede;;;\n"})
  await prisma.initialImportBatch.update({where:{id:preview.id},data:{expiresAt:new Date(0)}});await expect(confirmInitialImport(actor,{id:preview.id,confirmed:true})).rejects.toMatchObject({status:409})
  await prisma.user.update({where:{id:actor.id},data:{permissionOverrides:{"data.import":"deny"}}});await expect(confirmInitialImport(actor,{id:preview.id,confirmed:true})).rejects.toMatchObject({status:403})
 })
})
