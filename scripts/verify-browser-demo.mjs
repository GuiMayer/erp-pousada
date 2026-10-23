import { access, readFile, readdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.local/browser-demo-site")
const base = process.env.NEXT_PUBLIC_BASE_PATH || "/erp-pousada"
const html = await readFile(join(root, "index.html"), "utf8")
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"))
let assets = 0
for (const ref of refs) {
  if (/^(https?:|data:|#)/.test(ref)) continue
  if (!ref.startsWith(`${base}/`)) throw Error(`Recurso fora do caminho público: ${ref}`)
  const path = ref.slice(base.length + 1).split(/[?#]/)[0]
  await access(join(root, path)); assets++
}
if (!assets) throw Error("Demonstração sem recursos estáticos")
if ((await readdir(root)).includes("api")) throw Error("APIs não podem ser publicadas no Pages")
const css = await readdir(join(root, "_next/static/css"))
const styles = (await Promise.all(css.map(name => readFile(join(root, "_next/static/css", name), "utf8")))).join("")
if (!styles.includes(".flex{") || !styles.includes(".rounded-lg")) throw Error("Classes da interface não foram compiladas")
console.log(`Exportação válida: ${assets} recursos no caminho ${base}, CSS compilado e nenhuma API.`)
