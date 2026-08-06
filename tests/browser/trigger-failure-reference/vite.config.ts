import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import { pinnedStateInspector } from "./pinnedStateInspectorPlugin";

const directory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(directory, "../../../../trigger.dev");
const appRoot = resolve(sourceRoot, "apps/webapp/app");

export default defineConfig({
  plugins: [pinnedRunError(), pinnedStateInspector(), react(), tailwindcss()],
  resolve: {
    alias: { "~": appRoot },
    dedupe: ["react", "react-dom"],
  },
});

function pinnedRunError(): Plugin {
  const publicId = "virtual:pinned-trigger-run-error";
  const resolvedId = `\0${publicId}.tsx`;

  return {
    name: "pinned-trigger-run-error",
    resolveId(id) {
      return id === publicId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const route = readFileSync(resolve(appRoot, "routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx"), "utf8");
      const runError = route.slice(route.indexOf("function RunError"), route.indexOf("function SpanEntity"));
      const branchStart = runError.indexOf("      const name =");
      const branchEnd = runError.indexOf("\n    }\n  }\n}", branchStart);
      if (branchStart < 0 || branchEnd < 0) throw new Error("Pinned Trigger RunError branch could not be extracted.");
      const branch = runError.slice(branchStart, branchEnd);
      const imports = {
        errors: resolve(sourceRoot, "packages/core/src/v3/errors.ts"),
        common: resolve(sourceRoot, "packages/core/src/v3/schemas/common.ts"),
        codeBlock: resolve(appRoot, "components/code/CodeBlock.tsx"),
        callout: resolve(appRoot, "components/primitives/Callout.tsx"),
        headers: resolve(appRoot, "components/primitives/Headers.tsx"),
      };

      const module = `
import type { ReactNode } from "react";
import { taskRunErrorEnhancer } from ${JSON.stringify(imports.errors)};
import type { TaskRunError } from ${JSON.stringify(imports.common)};
import { CodeBlock } from ${JSON.stringify(imports.codeBlock)};
import { Callout } from ${JSON.stringify(imports.callout)};
import { Header3 } from ${JSON.stringify(imports.headers)};
const EnvelopeIcon = () => null;
const Button = ({ children }: { children: ReactNode; [key: string]: unknown }) => <button>{children}</button>;
const Feedback = ({ button }: { button: ReactNode }) => <>{button}</>;
export function PinnedTriggerRunError({ error }: { error: TaskRunError }) {
  const enhancedError = taskRunErrorEnhancer(error);
  if (enhancedError.type !== "BUILT_IN_ERROR" && enhancedError.type !== "INTERNAL_ERROR") throw new Error("Expected built-in Trigger error fixture.");
${branch}
}
`;
      return (await transformWithEsbuild(module, "PinnedTriggerRunError.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}
