/*!
 * Adapted from Trigger.dev apps/webapp/app/components/code/CodeBlock.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local imports and a dependency-light modal copy button.
 */
import { ArrowsPointingOutIcon, ChevronRightIcon, CodeBracketIcon, QueueListIcon } from "@heroicons/react/20/solid";
import { Clipboard, ClipboardCheck } from "lucide-react";
import { Highlight, Prism, type Language, type PrismTheme } from "prism-react-renderer";
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { TextInlineIcon } from "./TextInlineIcon";
import { TextWrapIcon } from "./TextWrapIcon";
import { Paragraph } from "./components/primitives/Paragraph";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/primitives/Tooltip";
import { cn } from "./utils/cn";

async function setup() {
  (typeof global !== "undefined" ? global : window).Prism = Prism;
  // @ts-expect-error Prism language modules do not publish declarations.
  await import("prismjs/components/prism-json");
  // @ts-expect-error Prism language modules do not publish declarations.
  await import("prismjs/components/prism-typescript");
  // @ts-expect-error Prism language modules do not publish declarations.
  await import("prismjs/components/prism-sql.js");
  // @ts-expect-error Prism language modules do not publish declarations.
  await import("prismjs/components/prism-markup-templating");
  // @ts-expect-error Prism language modules do not publish declarations.
  await import("prismjs/components/prism-php");
}
setup();

type CodeBlockProps = {
  code: string;
  language?: Language;
  showCopyButton?: boolean;
  showTextWrapping?: boolean;
  showLineNumbers?: boolean;
  startingLine?: number;
  highlightedRanges?: [number, number][];
  className?: string;
  theme?: PrismTheme;
  maxLines?: number;
  showChrome?: boolean;
  fileName?: string;
  rowTitle?: ReactNode;
  showOpenInModal?: boolean;
  wrap?: boolean;
  label?: string;
  modalContent?: ReactNode;
  extensionId?: string;
  regionLabel?: string;
  preClassName?: string;
  isolateModalEscape?: boolean;
  jsonValue?: unknown;
};

const extraLinesWhenClipping = 0.35;

const defaultTheme: PrismTheme = {
  plain: {
    color: "var(--color-code-constant)",
    backgroundColor: "rgba(0, 0, 0, 0)",
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--color-code-muted)" } },
    { types: ["punctuation"], style: { color: "var(--color-code-foreground)" } },
    { types: ["property", "tag", "constant", "symbol", "deleted"], style: { color: "var(--color-code-language)" } },
    { types: ["boolean", "number"], style: { color: "var(--color-code-builtin)" } },
    { types: ["selector", "attr-name", "string", "char", "builtin", "inserted"], style: { color: "var(--color-code-string)" } },
    { types: ["operator", "entity", "url"], style: { color: "var(--color-code-plain)" } },
    { types: ["variable"], style: { color: "var(--color-code-variable)" } },
    { types: ["atrule", "attr-value", "keyword"], style: { color: "var(--color-code-keyword)" } },
    { types: ["function", "class-name"], style: { color: "var(--color-code-function)" } },
    { types: ["regex"], style: { color: "var(--color-code-regexp)" } },
    { types: ["important", "bold"], style: { fontWeight: "bold" } },
    { types: ["italic"], style: { fontStyle: "italic" } },
    { types: ["namespace"], style: { opacity: 0.7 } },
    { types: ["deleted"], style: { color: "var(--color-code-deleted)" } },
    { types: ["char"], style: { color: "var(--color-code-number)" } },
    { types: ["tag"], style: { color: "var(--color-code-escape)" } },
    { types: ["keyword.operator"], style: { color: "var(--color-code-storage)" } },
    { types: ["meta.template.expression"], style: { color: "var(--color-code-plain)" } },
  ],
};

export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock({
  showCopyButton = true,
  showTextWrapping = false,
  showLineNumbers = true,
  startingLine = 1,
  showOpenInModal = true,
  highlightedRanges,
  code: rawCode,
  className,
  language = "typescript",
  theme = defaultTheme,
  maxLines,
  showChrome = false,
  fileName,
  rowTitle,
  wrap = false,
  label,
  modalContent,
  extensionId,
  regionLabel,
  preClassName,
  isolateModalEscape = false,
  jsonValue,
}, ref) {
  const expandButton = useRef<HTMLButtonElement>(null);
  const [mouseOver, setMouseOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWrapped, setIsWrapped] = useState(wrap);
  const [jsonMode, setJsonMode] = useState<"code" | "tree">("code");
  const code = rawCode?.trim() ?? "";
  const canRenderTree = language === "json" && typeof jsonValue === "object" && jsonValue !== null;
  const hasInlineControls = canRenderTree || showTextWrapping || showCopyButton || showOpenInModal;

  const copy = useCallback((modal: boolean) => {
    void navigator.clipboard.writeText(code);
    modal ? setModalCopied(true) : setCopied(true);
    window.setTimeout(() => modal ? setModalCopied(false) : setCopied(false), 1_500);
  }, [code]);

  const lineCount = code.split("\n").length;
  const maxLineWidth = (startingLine + lineCount - 1).toString().length;
  const maxHeight = maxLines && lineCount > maxLines
    ? `calc(${(maxLines + extraLinesWhenClipping) * 0.75 * 1.625}rem + 1.5rem)`
    : undefined;
  const highlightLines = highlightedRanges?.flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, index) => start + index));
  const shouldHighlight = lineCount <= 1_000;

  return (
    <>
      <div
        ref={ref}
        aria-label={regionLabel ?? label}
        data-skyline-extension={extensionId}
        role={extensionId ? "region" : undefined}
        className={cn("relative flex flex-col overflow-hidden rounded-md border border-grid-bright", className)}
        style={{ backgroundColor: theme.plain.backgroundColor }}
        translate="no"
      >
        {showChrome && <Chrome title={fileName} />}
        {rowTitle && <TitleRow title={rowTitle} hasControls={hasInlineControls} />}
        <div className={cn("absolute right-3 top-2.5 z-50 flex gap-3", showChrome ? "right-1.5 top-1.5" : "top-2.5")}>
          {canRenderTree && (
            <TooltipProvider>
              <Tooltip disableHoverableContent>
                <TooltipTrigger
                  aria-label={label ? (jsonMode === "tree" ? `Show ${label} code` : `Show ${label} tree`) : undefined}
                  aria-pressed={jsonMode === "tree"}
                  onClick={() => setJsonMode((current) => current === "code" ? "tree" : "code")}
                  className="transition-colors focus-custom hover:cursor-pointer hover:text-text-bright"
                >
                  {jsonMode === "tree" ? <CodeBracketIcon className="size-4" /> : <QueueListIcon className="size-4" />}
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">{jsonMode === "tree" ? "Code" : "Tree"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {showTextWrapping && jsonMode === "code" && (
            <TooltipProvider>
              <Tooltip disableHoverableContent>
                <TooltipTrigger
                  aria-label={label ? (isWrapped ? `Unwrap ${label}` : `Wrap ${label}`) : undefined}
                  onClick={() => setIsWrapped(!isWrapped)}
                  className="transition-colors focus-custom hover:cursor-pointer hover:text-text-bright"
                >
                  {isWrapped ? <TextInlineIcon className="size-4" /> : <TextWrapIcon className="size-4" />}
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">{isWrapped ? "Unwrap" : "Wrap"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {showCopyButton && (
            <TooltipProvider>
              <Tooltip open={copied || mouseOver} disableHoverableContent>
                <TooltipTrigger
                  aria-label={label ? `Copy ${label}` : undefined}
                  onClick={() => copy(false)}
                  onMouseEnter={() => setMouseOver(true)}
                  onMouseLeave={() => setMouseOver(false)}
                  className={`transition-colors duration-100 focus-custom hover:cursor-pointer ${copied ? "text-success" : "text-text-dimmed hover:text-text-bright"}`}
                >
                  {copied ? <ClipboardCheck className="size-4" /> : <Clipboard className="size-4" />}
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">{copied ? "Copied" : "Copy"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {showOpenInModal && (
            <TooltipProvider>
              <Tooltip disableHoverableContent>
                <TooltipTrigger ref={expandButton} aria-label={label ? `Expand ${label}` : undefined} onClick={() => setIsModalOpen(true)}>
                  <ArrowsPointingOutIcon className="size-4 transition-colors hover:text-text-bright" />
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">Expand</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {canRenderTree && jsonMode === "tree"
          ? <JsonTree value={jsonValue} label={label ?? "JSON"} />
          : shouldHighlight
          ? <HighlightCode
              theme={theme}
              code={code}
              language={language}
              showLineNumbers={showLineNumbers}
              startingLine={startingLine}
              highlightLines={highlightLines}
              maxLineWidth={maxLineWidth}
              className={cn("px-2 py-3", hasInlineControls && !showChrome && !rowTitle && "pt-10")}
              preClassName={preClassName ?? "text-xs"}
              isWrapped={isWrapped}
            />
          : <PlainCode code={code} maxHeight={maxHeight} isWrapped={isWrapped} />}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="flex flex-col gap-0 p-0 pt-[2.9rem] sm:h-[80vh] sm:max-h-[80vh] sm:!w-[80vw] sm:!max-w-[80vw]"
          onKeyDown={(event) => {
            if (!isolateModalEscape || event.key !== "Escape") return;
            event.stopPropagation();
            setIsModalOpen(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.setTimeout(() => expandButton.current?.focus(), 0);
          }}
        >
          <DialogHeader className="h-fit">
            <DialogTitle className="absolute left-3.5 top-2.5">
              {fileName && fileName}
              {rowTitle && rowTitle}
            </DialogTitle>
            <button
              type="button"
              onClick={() => copy(true)}
              className="absolute right-4 top-16 z-50 inline-flex h-7 items-center gap-1 rounded bg-background-raised px-2 text-xs text-text-bright transition-colors hover:bg-background-hover focus-custom"
            >
              {!modalCopied && <Clipboard className="size-3" />}
              {modalCopied ? "Copied" : "Copy"}
            </button>
          </DialogHeader>
          <div aria-label={label} className="min-h-0 flex-1 overflow-y-auto" role="region">
            {canRenderTree && jsonMode === "tree"
              ? <JsonTree value={jsonValue} label={label ?? "JSON"} expanded />
              : <HighlightCode
                  theme={theme}
                  code={code}
                  language={language}
                  showLineNumbers={showLineNumbers}
                  startingLine={startingLine}
                  highlightLines={highlightLines}
                  maxLineWidth={maxLineWidth}
                  className={modalContent ? "" : "min-h-full"}
                  preClassName="text-sm leading-relaxed"
                  isWrapped={isWrapped}
                />}
            {modalContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

function Chrome({ title }: { title?: string }) {
  return (
    <div className="grid h-7 grid-cols-[100px_auto_100px] border-b border-background-bright bg-background-deep">
      <div className="ml-2 flex items-center gap-2">
        <div className="size-3 rounded-full bg-background-raised" />
        <div className="size-3 rounded-full bg-background-raised" />
        <div className="size-3 rounded-full bg-background-raised" />
      </div>
      <div className="flex items-center justify-center"><div className="rounded-sm px-3 py-0.5 text-xs text-text-faint">{title}</div></div>
      <div />
    </div>
  );
}

function PlainCode({ code, maxHeight, isWrapped }: { code: string; maxHeight?: string; isWrapped: boolean }) {
  return (
    <div dir="ltr" className="min-h-0 flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control overflow-auto px-2 py-3" style={{ maxHeight }}>
      <pre className={`relative mr-2 p-2 font-mono text-xs leading-relaxed ${isWrapped ? "whitespace-pre-wrap wrap-break-word" : ""}`} dir="ltr">{code}</pre>
    </div>
  );
}

function TitleRow({ title, hasControls }: { title: ReactNode; hasControls: boolean }) {
  return <div className="flex items-center justify-between px-3"><Paragraph variant="small/bright" className={cn("w-full border-b border-grid-dimmed py-2", hasControls && "pr-24")}>{title}</Paragraph></div>;
}

function HighlightCode({ theme, code, language, showLineNumbers, startingLine, highlightLines, maxLineWidth, className, preClassName, isWrapped, maxHeight }: {
  theme: PrismTheme;
  code: string;
  language: Language;
  showLineNumbers: boolean;
  startingLine: number;
  highlightLines?: number[];
  maxLineWidth: number;
  className?: string;
  preClassName?: string;
  isWrapped: boolean;
  maxHeight?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    void setup().then(() => setIsLoaded(true));
  }, []);

  const containerClasses = cn(
    "min-h-0 flex-1 px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control",
    "overflow-auto",
    className,
  );
  const preClasses = cn(
    "relative mr-2 font-mono leading-relaxed",
    preClassName,
    isWrapped && "[&_span]:whitespace-pre-wrap [&_span]:wrap-break-word",
  );

  if (!isLoaded) {
    return <div dir="ltr" className={containerClasses} style={{ maxHeight }}><pre className={preClasses}>{code}</pre></div>;
  }

  return (
    <Highlight theme={theme} code={code} language={language}>
      {({ className: inheritedClassName, style, tokens, getLineProps, getTokenProps }) => (
        <div dir="ltr" className={containerClasses} style={{ maxHeight }}>
          <pre className={cn(preClasses, inheritedClassName)} style={style} dir="ltr">
            {tokens.map((line, index) => {
              if (index === tokens.length - 1 && line.length === 1 && line[0].content === "\n") return null;
              const lineNumber = index + 1;
              const displayLineNumber = startingLine + index;
              const lineProps = getLineProps({ line });
              const highlighted = highlightLines?.includes(lineNumber);
              return (
                <div key={lineNumber} {...lineProps} className={cn("flex justify-start", lineProps.className, highlighted && "bg-rose-500/10 shadow-[inset_2px_0_0_var(--color-rose-500)]", isWrapped ? "w-full flex-wrap" : "w-max min-w-full")} style={lineProps.style}>
                  {showLineNumbers && <div className={cn("mr-2 flex-none select-none text-right text-text-faint", isWrapped && "sticky left-0")} style={{ width: `calc(8 * ${maxLineWidth / 16}rem)` }}>{displayLineNumber}</div>}
                  <div className="flex-1">{line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}</div>
                  <div className="w-4 flex-none" />
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </Highlight>
  );
}

function JsonTree({ value, label, expanded = false }: { value: unknown; label: string; expanded?: boolean }) {
  return (
    <div role="tree" aria-label={`${label} JSON tree`} tabIndex={0} className={`${expanded ? "h-full max-h-none" : "max-h-80"} overflow-auto py-2 font-mono text-xs`}>
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
  const container = typeof value === "object" && value !== null;
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
        <ChevronRightIcon className={`size-4 h-lh shrink-0 text-text-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
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
