import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills de terceros instaladas en el proyecto: su código no es nuestro y
    // sus 94 avisos tapaban los propios. Si un aviso de acá no se puede
    // arreglar, deja de servir como aviso.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;
