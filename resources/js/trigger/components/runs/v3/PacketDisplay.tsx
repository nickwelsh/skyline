/*!
 * Adapted from Trigger.dev apps/webapp/app/components/runs/v3/PacketDisplay.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Object-storage packets are outside Skyline's read-only captured-data contract.
 */
import { CodeBlock } from "~/CodeBlock";

export function PacketDisplay({ data, dataType, title, wrap }: { data: string; dataType: string; title: string; searchTerm?: string; wrap?: boolean }) {
  return (
    <CodeBlock
      language={dataType === "text/plain" ? "markdown" : "json"}
      rowTitle={title}
      code={data}
      maxLines={20}
      showLineNumbers={false}
      showTextWrapping
      wrap={wrap}
    />
  );
}
