import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(directory, "../../../../trigger.dev/apps/webapp/app");

export function pinnedStateInspector(): Plugin {
  const publicId = "virtual:pinned-trigger-state-inspector";
  const resolvedId = `\0${publicId}.tsx`;

  return {
    name: "pinned-trigger-state-inspector",
    resolveId(id) {
      return id === publicId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const codeBlock = resolve(appRoot, "components/code/CodeBlock.tsx");
      const headers = resolve(appRoot, "components/primitives/Headers.tsx");
      const property = resolve(appRoot, "components/primitives/PropertyTable.tsx");
      const module = `
import { CodeBlock } from ${JSON.stringify(codeBlock)};
import { Header3 } from ${JSON.stringify(headers)};
import * as Property from ${JSON.stringify(property)};

const timing = [["Started", "Aug 5, 2026, 8:00:00 AM"], ["Finished", "Aug 5, 2026, 8:00:00 AM"], ["Duration", "125 ms"]] as const;
const fixtures = {
  "sql-captured": { title: "SQL query", properties: [["Connection", "testing"], ["Outcome", "completed"]], capture: { label: "Parameterized SQL", value: "select * from invoices where customer_id = ?", language: "sql" } },
  "transaction-committed": { title: "Database transaction", properties: [["Connection", "testing"], ["Driver", "sqlite"], ["Depth", "2"], ["Outcome", "committed"]], capture: null },
  "cache-long": { title: "Cache operation", properties: [["Operation", "PUT"], ["Store", "redis"], ["Key", "customer:42"], ["Outcome", "stored"]], capture: { label: "Value", value: JSON.stringify({ value: "long-value-".repeat(80) }, null, 2), language: "json" } },
  "redis-truncated": { title: "Redis command", properties: [["Command", "MSET"], ["Connection", "default"], ["Outcome", "completed"]], capture: { label: "Arguments", value: JSON.stringify(["redis-key-".repeat(40), "redis-value-".repeat(40)], null, 2), language: "json" } },
} as const;

export function PinnedTriggerStateInspector({ scenario }: { scenario: keyof typeof fixtures }) {
  const fixture = fixtures[scenario];
  return <section aria-label={fixture.title + " detail"} className="flex min-w-0 flex-col gap-4">
    <Header3>{fixture.title}</Header3>
    <Property.Table>{timing.map(([label, value]) => <Item key={label} label={label} value={value} />)}</Property.Table>
    <Property.Table>{fixture.properties.map(([label, value]) => <Item key={label} label={label} value={value} />)}</Property.Table>
    {fixture.capture ? <CodeBlock rowTitle={fixture.capture.label} code={fixture.capture.value} language={fixture.capture.language} maxLines={12} showLineNumbers={false} showCopyButton showTextWrapping showOpenInModal /> : null}
  </section>;
}
function Item({ label, value }: { label: string; value: string }) {
  return <Property.Item><Property.Label>{label}</Property.Label><Property.Value>{value}</Property.Value></Property.Item>;
}
`;

      return (await transformWithEsbuild(module, "PinnedTriggerStateInspector.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}
