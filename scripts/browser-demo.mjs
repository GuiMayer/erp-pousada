import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const command = process.argv[2]
if (!["dev", "build"].includes(command)) throw Error("Use dev ou build")
const env = { ...process.env, NEXT_PUBLIC_DATA_ADAPTER: "demo-localStorage", NEXT_PUBLIC_DEMO_MODE: "true" }
const run = (cwd, args, environment) => new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), ...args], { cwd, env: environment, stdio: "inherit" })
  child.on("error", reject)
  child.on("exit", code => code === 0 ? resolveRun() : reject(Error(`Next encerrou com código ${code}`)))
})
if (command === "dev") {
  await run(root, ["dev", "--hostname", "127.0.0.1", "--port", "3002", ...process.argv.slice(3)], { ...env, ERP_STATIC_DEMO: "false", NEXT_PUBLIC_BASE_PATH: "" })
} else {
  // Next export always writes intermediate files in .next. Build a temporary
  // snapshot of the SAME sources so a running development server is untouched.
  // No .env, database, backup or local configuration file is copied.
  const staging = await mkdtemp(join(tmpdir(), "erp-browser-demo-"))
  const destination = join(root, ".local", "browser-demo-site")
  try {
    for (const folder of ["app", "components", "contexts", "hooks", "lib", "modules", "styles", "public"]) {
      await cp(join(root, folder), join(staging, folder), { recursive: true })
    }
    for (const file of ["package.json", "next.config.mjs", "postcss.config.mjs"]) await cp(join(root, file), join(staging, file))
    const tsconfig = JSON.parse(await readFile(join(root, "tsconfig.json"), "utf8"))
    tsconfig.include = ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
    await import("node:fs/promises").then(fs => fs.writeFile(join(staging, "tsconfig.json"), JSON.stringify(tsconfig)))
    await symlink(join(root, "node_modules"), join(staging, "node_modules"), "junction")
    await run(staging, ["build", "--webpack"], { ...env, ERP_STATIC_DEMO: "true", ERP_BUILD_DIR: ".next", NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/erp-pousada" })
    // Only replace this fixed, verified generated directory inside the repo.
    if (dirname(destination) !== join(root, ".local")) throw Error("Destino de publicação inválido")
    await mkdir(dirname(destination), { recursive: true })
    await rm(destination, { recursive: true, force: true })
    await cp(join(staging, "out"), destination, { recursive: true })
    const manifest = JSON.parse(await readFile(join(staging, ".next/server/app-paths-manifest.json"), "utf8"))
    if (Object.keys(manifest).some(path => path.includes("/api/"))) throw Error("Uma API foi incluída na demonstração estática")
    console.log(`Demonstração gerada em ${destination}; nenhuma API incluída.`)
  } finally {
    if (dirname(staging) !== tmpdir() || !staging.includes("erp-browser-demo-")) throw Error("Diretório temporário inválido")
    // Remove the junction first; never recursively traverse node_modules.
    await rm(join(staging, "node_modules"), { force: true, recursive: true })
    await rm(staging, { recursive: true, force: true })
  }
}
