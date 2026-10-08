const units: Record<string, { family: string; size: number }> = {
  kg: { family: "mass", size: 1000 }, g: { family: "mass", size: 1 },
  l: { family: "volume", size: 1000 }, lt: { family: "volume", size: 1000 }, litro: { family: "volume", size: 1000 }, ml: { family: "volume", size: 1 },
  un: { family: "count", size: 1 }, unidade: { family: "count", size: 1 }, unidades: { family: "count", size: 1 },
}
export function unitFactor(from: string, to: string): number {
  const source = units[from.trim().toLowerCase()], target = units[to.trim().toLowerCase()]
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return 1
  if (!source || !target || source.family !== target.family) throw new Error(`Unidades incompatíveis: ${from} e ${to}`)
  return source.size / target.size
}
