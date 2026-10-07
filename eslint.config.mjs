import next from "eslint-config-next/core-web-vitals"
import { defineConfig, globalIgnores } from "eslint/config"
export default defineConfig([...next, { rules: { "react-hooks/exhaustive-deps": "warn", "react-hooks/set-state-in-effect": "off", "react-hooks/immutability": "warn", "react-hooks/refs": "warn", "react-hooks/purity": "warn", "react-hooks/preserve-manual-memoization": "off", "react/no-unescaped-entities": "warn", "@next/next/no-img-element": "warn" } }, globalIgnores([".next/**", "node_modules/**", "coverage/**", "public/**"])])
