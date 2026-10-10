/** Purchase amounts are cents; base stock quantities have at most three decimal places. */
export type ReceiptLine = {productId:string;packaging:string;factor:number;acceptedPackages:number;refusedPackages:number;packagePrice:number;code:string;expiresAt?:string}
export function receiptTotals(items:ReceiptLine[],freight=0,discount=0) {
  const cents=(n:number)=>{if(!Number.isFinite(n)||n<0||n>999999999||Math.abs(n*100-Math.round(n*100))>.00001)throw new Error('Valores devem ter até duas casas decimais');return Math.round(n*100)}
  if(!items.length||items.length>100)throw new Error('Informe de 1 a 100 itens')
  const lines=items.map(i=>{
    if(!Number.isFinite(i.factor)||i.factor<=0||i.factor>999999||Math.abs(i.factor*1000-Math.round(i.factor*1000))>.00001||![i.acceptedPackages,i.refusedPackages].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000))throw new Error('Conversão ou quantidade de embalagens inválida')
    const quantity=Math.round(i.factor*1000)*i.acceptedPackages/1000,goods=cents(i.packagePrice)*i.acceptedPackages
    if(quantity>999999||goods>99999999900)throw new Error('Quantidade ou custo excede o limite')
    return {quantity,goods}
  })
  if(!lines.some(l=>l.quantity>0))throw new Error('Receba pelo menos uma unidade')
  const subtotal=lines.reduce((s,l)=>s+l.goods,0),total=subtotal+cents(freight)-cents(discount)
  if(total<0||total>99999999900)throw new Error('Desconto excede o valor da compra ou total inválido')
  const weights=lines.map(l=>subtotal?l.goods:Math.round(l.quantity*1000)),weight=weights.reduce((s,w)=>s+w,0)
  const shares=weights.map((w,index)=>{const p=BigInt(total)*BigInt(w),den=BigInt(weight);return {index,cents:Number(p/den),remainder:p%den}})
  let left=total-shares.reduce((s,p)=>s+p.cents,0)
  for(const p of [...shares].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){if(!left)break;p.cents++;left--}
  return {subtotal:subtotal/100,total:total/100,lines:lines.map((l,index)=>({quantity:l.quantity,goodsTotal:l.goods/100,totalCost:shares[index].cents/100}))}
}
export type LotView={id:string;recordVersion:number;productId:string;productName:string;unit:string;code:string;expiresAt:string|null;status:string;origin:string;quantity:number;remainingValue:number;receivedQuantity:number;unitCost:number;costEstimated:boolean;receivedAt:string;reason?:string|null;purchaseItemId?:string|null}
export type InventoryView={id:string;recordVersion:number;status:string;capturedAt:string;postedAt:string|null;reason:string;lines:{id:string;lotId:string;productName:string;expectedQuantity:number;unitCost:number;countedQuantity:number|null;delta:number|null}[]}
export type PurchaseView={id:string;supplierId:string;supplierName:string;reference:string|null;receivedAt:string;subtotal:number;freight:number;discount:number;total:number;registeredBy:string;notes:string|null;items:(ReceiptLine & {id:string;productName:string;unit:string;quantity:number;goodsTotal:number;totalCost:number})[];expense?:{id:string;value:number;paidValue:number;dueDate:string;installments:{id:string;value:number;paidValue:number;dueDate:string}[]}|null}
export type ReturnView={id:string;recordVersion:number;lotId:string;quantity:number;stockValue:number;reason:string;createdAt:string;status:string;resolution:string|null;agreedValue:number|null;settlementNote:string|null}
export type InventorySnapshot={lots:LotView[];purchases:PurchaseView[];inventories:InventoryView[];returns:ReturnView[]}
export function lotUsable(lot:Pick<LotView,'status'|'expiresAt'>,today:string,requiresExpiry=false) {return lot.status==='active'&&(!requiresExpiry||!!lot.expiresAt)&&(!lot.expiresAt||lot.expiresAt.slice(0,10)>=today)}
