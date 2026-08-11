/*!
 * Adapted from Trigger.dev apps/webapp/app/components/code/CodeBlock.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local imports and a dependency-light modal copy button.
 */
import { ArrowsPointingOutIcon, CodeBracketIcon, QueueListIcon } from "@heroicons/react/20/solid";
import { Clipboard, ClipboardCheck } from "lucide-react";
import { Highlight, Prism, type Language, type PrismTheme } from "prism-react-renderer";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { JsonTree } from "./CapturePreview";
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
}
setup();

type CodeBlockProps = {
  code: string;
  language?: Language;
  showCopyButton?: boolean;
  showTextWrapping?: boolean;
  showLineNumbers?: boolean;
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

const dimAmount = 0.5;
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

  const copy = useCallback((modal: boolean) => {
    void navigator.clipboard.writeText(code);
    modal ? setModalCopied(true) : setCopied(true);
    window.setTimeout(() => modal ? setModalCopied(false) : setCopied(false), 1_500);
  }, [code]);

  const lineCount = code.split("\n").length;
  const maxLineWidth = lineCount.toString().length;
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
        {rowTitle && <TitleRow title={rowTitle} />}
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
              highlightLines={highlightLines}
              maxLineWidth={maxLineWidth}
              className="px-2 py-3"
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

function TitleRow({ title }: { title: ReactNode }) {
  return <div className="flex items-center justify-between px-3"><Paragraph variant="small/bright" className="w-full border-b border-grid-dimmed py-2">{title}</Paragraph></div>;
}

function HighlightCode({ theme, code, language, showLineNumbers, highlightLines, maxLineWidth, className, preClassName, isWrapped, maxHeight }: {
  theme: PrismTheme;
  code: string;
  language: Language;
  showLineNumbers: boolean;
  highlightLines?: number[];
  maxLineWidth: number;
  className?: string;
  preClassName?: string;
  isWrapped: boolean;
  maxHeight?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      // @ts-expect-error Prism language modules do not publish declarations.
      import("prismjs/components/prism-json"),
      // @ts-expect-error Prism language modules do not publish declarations.
      import("prismjs/components/prism-typescript"),
      // @ts-expect-error Prism language modules do not publish declarations.
      import("prismjs/components/prism-sql.js"),
    ]).then(() => setIsLoaded(true));
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
              const lineProps = getLineProps({ line });
              const shouldDim = Boolean(highlightLines?.length) && !highlightLines?.includes(lineNumber);
              return (
                <div key={lineNumber} {...lineProps} className={cn("flex w-full justify-start transition-opacity duration-500", lineProps.className, isWrapped && "flex-wrap")} style={{ opacity: shouldDim ? dimAmount : undefined, ...lineProps.style }}>
                  {showLineNumbers && <div className={cn("mr-2 flex-none select-none text-right text-text-faint transition-opacity duration-500", isWrapped && "sticky left-0")} style={{ width: `calc(8 * ${maxLineWidth / 16}rem)` }}>{lineNumber}</div>}
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
