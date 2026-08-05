/*!
 * Skyline capture-specific viewers at Trigger.dev commit
 * ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Trigger's one-to-one CodeBlock lives in ./CodeBlock.tsx; these modes only serve
 * Skyline-specific SQL, HTML, and tree data in the Detail tab.
 */
import { IconArrowsMaximize, IconCheck, IconChevronRight, IconCopy, IconTextWrap, IconTextWrapDisabled, IconX } from "@tabler/icons-react";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { interpolateSql, type SqlBinding } from "./capture-formatting";

type JsonMode = "tree" | "text";
type SqlMode = "parameterized" | "bindings";
type HtmlMode = "render" | "source";

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
      textWrapping
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
      {({ wrap, expanded }) => <HighlightedCode code={code} language="sql" wrap={wrap} expanded={expanded} />}
    </CapturePanel>
  );
}

export function JsonCapturePreview({ label, value, summary, truncated = false }: { label: string; value: unknown; summary?: string; truncated?: boolean }) {
  const json = useMemo(() => stringifyJson(value), [value]);
  const canRenderTree = json !== null && typeof value === "object" && value !== null;
  const [mode, setMode] = useState<JsonMode>("text");
  const resolvedMode = canRenderTree ? mode : "text";
  const copyValue = json ?? String(value);

  return (
    <CapturePanel
      label={label}
      summary={summary}
      truncated={truncated}
      copyValue={copyValue}
      textWrapping={resolvedMode === "text"}
      actions={canRenderTree && (
        <ModeSwitch
          label={`${label} display`}
          value={resolvedMode}
          options={[
            { value: "text", label: "Text" },
            { value: "tree", label: "Tree" },
          ]}
          onChange={setMode}
        />
      )}
    >
      {({ wrap, expanded }) => resolvedMode === "tree"
        ? <JsonTree value={value} label={label} expanded={expanded} />
        : <HighlightedCode code={copyValue} language="json" wrap={wrap} expanded={expanded} />}
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
    <CapturePanel label={label} summary={summary} truncated={truncated} copyValue={value} textWrapping>
      {({ wrap, expanded }) => <HighlightedCode code={value} language={language} wrap={wrap} expanded={expanded} />}
    </CapturePanel>
  );
}

export function HtmlCapturePreview({ label, value, summary, truncated = false }: {
  label: string;
  value: string;
  summary?: string;
  truncated?: boolean;
}) {
  const [mode, setMode] = useState<HtmlMode>("render");

  return (
    <CapturePanel
      label={label}
      summary={summary}
      truncated={truncated}
      copyValue={value}
      textWrapping={mode === "source"}
      actions={(
        <ModeSwitch
          label={`${label} display`}
          value={mode}
          options={[
            { value: "render", label: "Render" },
            { value: "source", label: "Source" },
          ]}
          onChange={setMode}
        />
      )}
    >
      {({ wrap, expanded }) => mode === "render"
        ? <iframe title={`${label} rendered preview`} sandbox="" referrerPolicy="no-referrer" srcDoc={renderableHtml(value)} className={expanded ? "h-full w-full bg-white" : "h-128 w-full bg-white"} />
        : <HighlightedCode code={value} language="markup" wrap={wrap} expanded={expanded} />}
    </CapturePanel>
  );
}

function CapturePanel({ label, summary, truncated, copyValue, actions, textWrapping = true, children }: {
  label: string;
  summary?: string;
  truncated: boolean;
  copyValue: string;
  actions?: ReactNode;
  textWrapping?: boolean;
  children: (options: { wrap: boolean; expanded: boolean }) => ReactNode;
}) {
  const [wrapped, setWrapped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const closeExpanded = () => {
    setExpanded(false);
    expandButton.current?.focus();
  };

  useEffect(() => {
    if (!expanded) return;
    dialog.current?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeExpanded();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [expanded]);

  const frame = (fullscreen: boolean) => (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-md border border-grid-bright bg-background-deep ${fullscreen ? "h-full" : ""}`}>
      <div className="flex min-h-10 min-w-0 shrink-0 items-center gap-3 border-b border-grid-dimmed px-3">
        <div className="flex min-w-0 items-center gap-2 text-base text-text-bright @sm:text-sm">
          <div className="truncate font-medium">{label}</div>
          {summary && <div className="shrink-0 text-text-faint">· {summary}</div>}
          {truncated && <div className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 text-amber-300">Truncated</div>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 text-text-dimmed">
          {actions}
          {textWrapping && (
            <ControlButton label={wrapped ? `Unwrap ${label}` : `Wrap ${label}`} onClick={() => setWrapped((value) => !value)}>
              {wrapped ? <IconTextWrapDisabled className="size-4 shrink-0" /> : <IconTextWrap className="size-4 shrink-0" />}
            </ControlButton>
          )}
          <CopyButton value={copyValue} label={label} />
          {fullscreen ? (
            <ControlButton label={`Close expanded ${label}`} onClick={closeExpanded}><IconX className="size-4 shrink-0" /></ControlButton>
          ) : (
            <ControlButton buttonRef={expandButton} label={`Expand ${label}`} onClick={() => setExpanded(true)}><IconArrowsMaximize className="size-4 shrink-0" /></ControlButton>
          )}
        </div>
      </div>
      <div className={fullscreen ? "min-h-0 flex-1" : "min-w-0"}>{children({ wrap: wrapped, expanded: fullscreen })}</div>
    </div>
  );

  return (
    <section aria-label={`${label} preview`} className="@container min-w-0">
      {frame(false)}
      {expanded && createPortal(
        <div ref={dialog} role="dialog" aria-modal="true" aria-label={`Expanded ${label}`} onKeyDown={trapFocus} className="fixed inset-0 z-999 bg-background-deep/90 p-3 backdrop-blur-sm sm:p-8">
          {frame(true)}
        </div>,
        document.body,
      )}
    </section>
  );

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])]
      .filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function ModeSwitch<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex h-10 items-end gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative h-8 border-b-2 px-0.5 ${value === option.value ? "border-indigo-500 text-text-bright" : "border-transparent text-text-faint hover:text-text-bright"}`}
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
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeout = useRef<number>();

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setStatus("idle"), 1_500);
    } catch {
      setStatus("failed");
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setStatus("idle"), 1_500);
    }
  };

  const presentation = {
    idle: { title: "Copy", feedback: idleText, color: "text-text-dimmed hover:text-text-bright", Icon: IconCopy },
    copied: { title: "Copied", feedback: copiedText, color: "text-success", Icon: IconCheck },
    failed: { title: "Copy failed", feedback: "Copy failed", color: "text-error", Icon: IconCopy },
  }[status];
  const StatusIcon = presentation.Icon;

  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={presentation.title}
      onClick={() => void copy()}
      className={`relative grid size-8 place-items-center rounded-sm hover:bg-background-hover focus-visible:outline-2 focus-visible:outline-indigo-500 ${presentation.color}`}
    >
      <StatusIcon className="size-4 shrink-0" />
      <span className="sr-only" aria-live="polite">{presentation.feedback}</span>
      <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
    </button>
  );
}

function ControlButton({ label, onClick, children, buttonRef }: { label: string; onClick: () => void; children: ReactNode; buttonRef?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={buttonRef} type="button" aria-label={label} title={label} onClick={onClick} className="relative grid size-8 place-items-center rounded-sm hover:bg-background-hover hover:text-text-bright focus-visible:outline-2 focus-visible:outline-indigo-500">
      {children}
      <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
    </button>
  );
}

export function HighlightedCode({ code, language, startingLine, highlightedLine, wrap = false, expanded = false }: {
  code: string;
  language: Language;
  startingLine?: number;
  highlightedLine?: number;
  wrap?: boolean;
  expanded?: boolean;
}) {
  return (
    <Highlight theme={codeTheme} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          dir="ltr"
          translate="no"
          className={`${expanded ? "h-full max-h-none" : "max-h-80"} overflow-auto p-3 font-mono text-base @sm:text-xs ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"} ${className}`}
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

function JsonTree({ value, label, expanded = false }: { value: unknown; label: string; expanded?: boolean }) {
  return (
    <div role="tree" aria-label={`${label} JSON tree`} className={`${expanded ? "h-full max-h-none" : "max-h-80"} overflow-auto py-2 font-mono text-base @sm:text-xs`}>
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

function renderableHtml(value: string): string {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob: cid:; style-src \'unsafe-inline\'; font-src data:">';

  if (/<head(?:\s[^>]*)?>/i.test(value)) {
    return value.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${policy}`);
  }

  return `<!doctype html><html><head>${policy}</head><body>${value}</body></html>`;
}
