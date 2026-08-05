/*!
 * Adapted from Trigger.dev apps/webapp/app/components/code/CodeBlock.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local imports and a dependency-light modal copy button.
 */
import { ArrowsPointingOutIcon } from "@heroicons/react/20/solid";
import { Clipboard, ClipboardCheck } from "lucide-react";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";
import { forwardRef, useCallback, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { TextInlineIcon } from "./TextInlineIcon";
import { TextWrapIcon } from "./TextWrapIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/primitives/Tooltip";

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
  label = "Code",
}, ref) {
  const [mouseOver, setMouseOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWrapped, setIsWrapped] = useState(wrap);
  const expandButton = useRef<HTMLButtonElement>(null);
  const code = rawCode?.trim() ?? "";

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

  return (
    <>
      <div
        ref={ref}
        aria-label={label}
        className={`relative flex flex-col overflow-hidden rounded-md border border-grid-bright ${className ?? ""}`}
        style={{ backgroundColor: theme.plain.backgroundColor }}
        translate="no"
      >
        {showChrome && <Chrome title={fileName} />}
        {rowTitle && <TitleRow title={rowTitle} />}
        <div className={`absolute z-50 flex gap-3 ${showChrome ? "right-1.5 top-1.5" : "right-3 top-2.5"}`}>
          {showTextWrapping && (
            <TooltipProvider>
              <Tooltip disableHoverableContent>
                <TooltipTrigger
                  aria-label={isWrapped ? `Unwrap ${label}` : `Wrap ${label}`}
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
                  aria-label={`Copy ${label}`}
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
                <TooltipTrigger ref={expandButton} aria-label={`Expand ${label}`} onClick={() => setIsModalOpen(true)}>
                  <ArrowsPointingOutIcon className="size-4 transition-colors hover:text-text-bright" />
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">Expand</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <HighlightCode
          theme={theme}
          code={code}
          language={language}
          showLineNumbers={showLineNumbers}
          highlightLines={highlightLines}
          maxLineWidth={maxLineWidth}
          maxHeight={maxHeight}
          className="px-2 py-3"
          preClassName="text-xs"
          isWrapped={isWrapped}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="flex flex-col gap-0 p-0 pt-[2.9rem] sm:h-[80vh] sm:max-h-[80vh] sm:!w-[80vw] sm:!max-w-[80vw]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandButton.current?.focus();
          }}
        >
          <DialogHeader className="h-fit">
            <DialogTitle className={fileName || rowTitle ? "absolute left-3.5 top-2.5" : "sr-only"}>
              {fileName ?? rowTitle ?? label}
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
          <HighlightCode
            theme={theme}
            code={code}
            language={language}
            showLineNumbers={showLineNumbers}
            highlightLines={highlightLines}
            maxLineWidth={maxLineWidth}
            className="min-h-full"
            preClassName="text-sm"
            isWrapped={isWrapped}
          />
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

function TitleRow({ title }: { title: ReactNode }) {
  return <div className="flex items-center justify-between px-3"><div className="w-full border-b border-grid-dimmed py-2 text-sm text-text-bright">{title}</div></div>;
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
  return (
    <Highlight theme={theme} code={code} language={language}>
      {({ className: inheritedClassName, style, tokens, getLineProps, getTokenProps }) => (
        <div dir="ltr" className={`min-h-0 flex-1 overflow-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control ${className ?? ""}`} style={{ maxHeight }}>
          <pre className={`relative mr-2 font-mono leading-relaxed ${preClassName ?? ""} ${isWrapped ? "[&_span]:whitespace-pre-wrap [&_span]:wrap-break-word" : ""} ${inheritedClassName}`} style={style} dir="ltr">
            {tokens.map((line, index) => {
              if (index === tokens.length - 1 && line.length === 1 && line[0].content === "\n") return null;
              const lineNumber = index + 1;
              const lineProps = getLineProps({ line });
              const shouldDim = Boolean(highlightLines?.length) && !highlightLines?.includes(lineNumber);
              return (
                <div key={lineNumber} {...lineProps} className={`flex w-full justify-start transition-opacity duration-500 ${isWrapped ? "flex-wrap" : ""} ${lineProps.className ?? ""}`} style={{ opacity: shouldDim ? dimAmount : undefined, ...lineProps.style }}>
                  {showLineNumbers && <div className={`mr-2 flex-none select-none text-right text-text-faint transition-opacity duration-500 ${isWrapped ? "sticky left-0" : ""}`} style={{ width: `calc(8 * ${maxLineWidth / 16}rem)` }}>{lineNumber}</div>}
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
