import { IconCheck, IconChevronRight, IconCopy } from "@tabler/icons-react";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SqlBinding } from "../skyline/dto";
import { interpolateSql } from "./capture-formatting";

type JsonMode = "tree" | "text";
type SqlMode = "parameterized" | "bindings";

const codeTheme: PrismTheme = {
  plain: {
    color: "var(--color-code-plain)",
    backgroundColor: "transparent",
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--color-code-comment)" } },
    { types: ["punctuation"], style: { color: "var(--color-code-foreground)" } },
    { types: ["property", "tag", "constant", "symbol", "deleted"], style: { color: "var(--color-code-language)" } },
    { types: ["boolean", "number"], style: { color: "var(--color-code-number)" } },
    { types: ["selector", "attr-name", "string", "char", "builtin", "inserted"], style: { color: "var(--color-code-string)" } },
    { types: ["operator", "entity", "url"], style: { color: "var(--color-code-plain)" } },
    { types: ["variable"], style: { color: "var(--color-code-variable)" } },
    { types: ["atrule", "attr-value", "keyword"], style: { color: "var(--color-code-keyword)" } },
    { types: ["function", "class-name"], style: { color: "var(--color-code-function)" } },
    { types: ["regex"], style: { color: "var(--color-code-regexp)" } },
  ],
};

export function SqlCapturePreview({ sql, bindings, sqlTruncated = false, bindingsTruncated = false }: {
  sql: string;
  bindings?: SqlBinding[];
  sqlTruncated?: boolean;
  bindingsTruncated?: boolean;
}) {
  const [mode, setMode] = useState<SqlMode>("parameterized");
  const canInterpolate = bindings !== undefined && bindings.length > 0;
  const code = mode === "bindings" && canInterpolate ? interpolateSql(sql, bindings) : sql;

  return (
    <CapturePanel
      label={mode === "bindings" ? "SQL with bindings" : "Parameterized SQL"}
      copyValue={code}
      truncated={sqlTruncated || (mode === "bindings" && bindingsTruncated)}
      actions={canInterpolate && (
        <ModeSwitch
          label="SQL display"
          value={mode}
          options={[
            { value: "parameterized", label: "Parameterized" },
            { value: "bindings", label: "With bindings", title: "Display preview; quoting may differ from the database driver." },
          ]}
          onChange={setMode}
        />
      )}
    >
      <HighlightedCode code={code} language="sql" />
    </CapturePanel>
  );
}

export function JsonCapturePreview({ label, value, summary, truncated = false }: { label: string; value: unknown; summary?: string; truncated?: boolean }) {
  const json = useMemo(() => stringifyJson(value), [value]);
  const canRenderTree = json !== null && typeof value === "object" && value !== null;
  const [mode, setMode] = useState<JsonMode>(canRenderTree ? "tree" : "text");
  const resolvedMode = canRenderTree ? mode : "text";
  const copyValue = json ?? String(value);

  return (
    <CapturePanel
      label={label}
      summary={summary}
      truncated={truncated}
      copyValue={copyValue}
      actions={canRenderTree && (
        <ModeSwitch
          label={`${label} display`}
          value={resolvedMode}
          options={[
            { value: "tree", label: "Tree" },
            { value: "text", label: "Text" },
          ]}
          onChange={setMode}
        />
      )}
    >
      {resolvedMode === "tree" ? <JsonTree value={value} label={label} /> : <HighlightedCode code={copyValue} language="json" />}
    </CapturePanel>
  );
}

export function TextCapturePreview({ label, value, summary, truncated = false, language = "markup" }: {
  label: string;
  value: string;
  summary?: string;
  truncated?: boolean;
  language?: Language;
}) {
  return (
    <CapturePanel label={label} summary={summary} truncated={truncated} copyValue={value}>
      <HighlightedCode code={value} language={language} />
    </CapturePanel>
  );
}

function CapturePanel({ label, summary, truncated, copyValue, actions, children }: {
  label: string;
  summary?: string;
  truncated: boolean;
  copyValue: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={`${label} preview`} className="@container flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-base text-text-faint @sm:text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate">{label}</div>
          {summary && <div className="shrink-0">· {summary}</div>}
          {truncated && <div className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 text-amber-300">Truncated</div>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
          <CopyButton value={copyValue} label={label} />
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded border border-grid-bright bg-background-deep">
        {children}
      </div>
    </section>
  );
}

function ModeSwitch<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded border border-grid-bright bg-background-bright">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative h-9 border-l border-grid-bright px-2 first:border-l-0 @sm:h-7 ${value === option.value ? "bg-background-raised text-text-bright" : "text-text-faint hover:bg-background-hover hover:text-text-bright"}`}
        >
          {option.label}
          <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ value, label, idleText = "Copy", copiedText = "Copied" }: {
  value: string;
  label: string;
  idleText?: string;
  copiedText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<number>();

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : "Copy"}
      onClick={() => void copy()}
      className={`relative flex h-9 items-center gap-1 rounded border border-grid-bright bg-background-bright py-1 pr-2 pl-1.5 hover:bg-background-hover @sm:h-7 ${copied ? "text-success" : "text-text-faint hover:text-text-bright"}`}
    >
      {copied ? <IconCheck className="size-5 shrink-0 @sm:size-4" /> : <IconCopy className="size-5 shrink-0 @sm:size-4" />}
      <span>{copied ? copiedText : idleText}</span>
      <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
    </button>
  );
}

export function HighlightedCode({ code, language, startingLine, highlightedLine, wrap = true }: {
  code: string;
  language: Language;
  startingLine?: number;
  highlightedLine?: number;
  wrap?: boolean;
}) {
  return (
    <Highlight theme={codeTheme} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          dir="ltr"
          translate="no"
          className={`max-h-80 overflow-auto p-3 font-mono text-base @sm:text-xs ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"} ${className}`}
          style={{ ...style, backgroundColor: "transparent" }}
        >
          {tokens.map((line, lineIndex) => {
            const lineProps = getLineProps({ line });
            return (
              <div key={lineIndex} {...lineProps} className={`flex min-w-0 ${startingLine !== undefined && startingLine + lineIndex === highlightedLine ? "bg-error/10" : ""} ${lineProps.className ?? ""}`}>
                {startingLine !== undefined && <div aria-hidden="true" className="w-8 shrink-0 pr-3 text-right tabular-nums text-text-faint">{startingLine + lineIndex}</div>}
                <div className="min-w-0 flex-1">{line.map((token, tokenIndex) => <span key={tokenIndex} {...getTokenProps({ token })} />)}</div>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}

function JsonTree({ value, label }: { value: unknown; label: string }) {
  return (
    <div role="tree" aria-label={`${label} JSON tree`} className="max-h-80 overflow-auto py-2 font-mono text-base @sm:text-xs">
      <JsonTreeNode value={value} depth={0} siblingCount={1} path="$" />
    </div>
  );
}

function JsonTreeNode({ value, depth, siblingCount, path, name, isArrayItem = false, trailingComma = false }: {
  value: unknown;
  depth: number;
  siblingCount: number;
  path: string;
  name?: string;
  isArrayItem?: boolean;
  trailingComma?: boolean;
}) {
  const container = isJsonContainer(value);
  const [expanded, setExpanded] = useState(depth === 0 || (depth === 1 && siblingCount <= 5));
  const rowStyle = { "--json-depth": depth } as CSSProperties;

  if (!container) {
    return (
      <div role="treeitem" aria-label={path} className="flex min-w-max items-baseline py-0.5 pr-3 [padding-left:calc(var(--json-depth)*1rem+0.5rem)]" style={rowStyle}>
        <span className="w-4 shrink-0" aria-hidden="true" />
        {name !== undefined && <JsonKey name={name} isArrayItem={isArrayItem} />}
        <JsonPrimitive value={value} />
        {trailingComma && <span className="text-code-foreground">,</span>}
      </div>
    );
  }

  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  const open = Array.isArray(value) ? "[" : "{";
  const close = Array.isArray(value) ? "]" : "}";
  const summary = `${entries.length.toLocaleString()} ${Array.isArray(value) ? (entries.length === 1 ? "item" : "items") : (entries.length === 1 ? "key" : "keys")}`;

  return (
    <div role="treeitem" aria-expanded={expanded} aria-label={path}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex min-w-full items-baseline py-0.5 pr-3 text-left hover:bg-background-hover [padding-left:calc(var(--json-depth)*1rem+0.5rem)]"
        style={rowStyle}
      >
        <IconChevronRight className={`size-4 h-lh shrink-0 stroke-text-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
        {name !== undefined && <JsonKey name={name} isArrayItem={isArrayItem} />}
        <span className="text-code-foreground">{open}</span>
        <span className="pl-1 text-code-muted">{summary}</span>
        {!expanded && <span className="pl-1 text-code-foreground">…{close}{trailingComma ? "," : ""}</span>}
      </button>
      {expanded && (
        <div role="group">
          {entries.map(([entryName, item], index) => (
            <JsonTreeNode
              key={`${path}.${entryName}`}
              value={item}
              depth={depth + 1}
              siblingCount={entries.length}
              path={Array.isArray(value) ? `${path}[${entryName}]` : `${path}.${entryName}`}
              name={entryName}
              isArrayItem={Array.isArray(value)}
              trailingComma={index < entries.length - 1}
            />
          ))}
          <div className="min-w-max py-0.5 pr-3 text-code-foreground [padding-left:calc(var(--json-depth)*1rem+1.5rem)]" style={rowStyle}>
            {close}{trailingComma ? "," : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function JsonKey({ name, isArrayItem }: { name: string; isArrayItem: boolean }) {
  return (
    <>
      <span className={isArrayItem ? "text-code-number" : "text-code-object-key"}>{isArrayItem ? name : JSON.stringify(name)}</span>
      <span className="pr-1 text-code-foreground">: </span>
    </>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-code-keyword">null</span>;
  if (typeof value === "string") return <span className="text-code-string">{JSON.stringify(value)}</span>;
  if (typeof value === "number") return <span className="text-code-number">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-code-keyword">{String(value)}</span>;
  return <span className="text-code-muted">{String(value)}</span>;
}

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function stringifyJson(value: unknown): string | null {
  try {
    return JSON.stringify(value, null, 2) ?? null;
  } catch {
    return null;
  }
}
