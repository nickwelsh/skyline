import {
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { CopyButton, HighlightedCode } from "./CapturePreview";

type ExceptionFrame = {
  file: string;
  line: number | null;
  class: string | null;
  type: string | null;
  function: string;
  isVendor: boolean;
  href: string | null;
  snippet: { code: string; startingLine: number; highlightedLine: number } | null;
};

type ExceptionDetails = {
  class: string;
  message: string;
  messageTruncated: boolean;
  messageOriginalBytes: number;
  code: string | null;
  runtime: { php: string; laravel: string };
  location: { file: string; line: number | null; href: string | null };
  frames: ExceptionFrame[];
  framesTruncated: boolean;
  markdown: string;
};

type FrameEntry = { frame: ExceptionFrame; index: number };

export function ExceptionPreview({ exception }: { exception: ExceptionDetails }) {
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupFrames(exception.frames), [exception.frames]);
  const mainFrame = exception.frames.findIndex((frame) => !frame.isVendor);

  return (
    <section aria-label="Exception" className="@container overflow-hidden rounded border border-error/40 bg-error/5">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 font-mono text-base text-error @sm:text-xs">{exception.class}</div>
          <CopyButton value={exception.markdown} label="exception as Markdown" idleText="Copy as Markdown" />
        </div>
        <p className="text-pretty text-base text-text-bright @sm:text-sm">{exception.message}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-base text-text-faint @sm:text-xs">
          <SourceLink file={exception.location.file} line={exception.location.line} href={exception.location.href} />
          <div className="font-mono">Laravel {exception.runtime.laravel}</div>
          <div className="font-mono">PHP {exception.runtime.php}</div>
          {exception.code && <div className="font-mono">Code {exception.code}</div>}
        </div>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="exception-trace"
        onClick={() => setExpanded((value) => !value)}
        className="relative flex h-11 w-full items-center gap-2 border-t border-error/20 px-3 text-base text-text-faint hover:bg-error/5 hover:text-text-bright @sm:h-9 @sm:text-xs"
      >
        <IconCode className="size-4 shrink-0" />
        <span>{expanded ? "Hide trace" : `Show ${exception.frames.length.toLocaleString()} ${exception.frames.length === 1 ? "frame" : "frames"}`}</span>
        {exception.framesTruncated && <span>· Truncated</span>}
        {expanded ? <IconChevronUp className="ml-auto size-4 shrink-0" /> : <IconChevronDown className="ml-auto size-4 shrink-0" />}
        <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
      </button>
      {expanded && (
        <div id="exception-trace" className="flex flex-col gap-2 border-t border-error/20 p-2">
          {groups.map((group, index) => group.vendor
            ? <VendorFrames key={`vendor-${index}`} entries={group.entries} />
            : group.entries.map((entry) => <ApplicationFrame key={`${entry.frame.file}:${entry.frame.line}:${entry.index}`} entry={entry} main={entry.index === mainFrame} />))}
        </div>
      )}
    </section>
  );
}

function ApplicationFrame({ entry, main }: { entry: FrameEntry; main: boolean }) {
  const { frame } = entry;
  const [expanded, setExpanded] = useState(main && frame.snippet !== null);

  return (
    <article className="overflow-hidden rounded border border-grid-bright bg-background-deep">
      <div className="flex min-w-0 items-stretch">
        <button
          type="button"
          disabled={!frame.snippet}
          aria-expanded={frame.snippet ? expanded : undefined}
          onClick={() => frame.snippet && setExpanded((value) => !value)}
          className="relative flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left hover:bg-background-hover disabled:cursor-default disabled:hover:bg-transparent @sm:min-h-9"
        >
          <div className="min-w-0 flex-1 truncate font-mono text-base text-text-bright @sm:text-xs">{formatCall(frame)}</div>
          {frame.snippet && (expanded ? <IconChevronUp className="size-4 shrink-0 text-text-faint" /> : <IconChevronDown className="size-4 shrink-0 text-text-faint" />)}
          <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 max-w-1/2 items-center border-l border-grid-bright px-3 text-base text-text-faint @sm:text-xs">
          <SourceLink file={frame.file} line={frame.line} href={frame.href} compact />
        </div>
      </div>
      {expanded && frame.snippet && (
        <div className="border-t border-grid-bright bg-background-dimmed">
          <HighlightedCode
            code={frame.snippet.code}
            language="php"
            startingLine={frame.snippet.startingLine}
            highlightedLine={frame.snippet.highlightedLine}
            wrap={false}
          />
        </div>
      )}
    </article>
  );
}

function VendorFrames({ entries }: { entries: FrameEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded border border-dashed border-grid-bright bg-background-dimmed">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="relative flex h-11 w-full items-center gap-2 px-3 text-base text-text-faint hover:bg-background-hover hover:text-text-bright @sm:h-9 @sm:text-xs"
      >
        {expanded ? <IconFolderOpen className="size-4 shrink-0" /> : <IconFolder className="size-4 shrink-0" />}
        <span>{entries.length.toLocaleString()} vendor {entries.length === 1 ? "frame" : "frames"}</span>
        {expanded ? <IconChevronUp className="ml-auto size-4 shrink-0" /> : <IconChevronDown className="ml-auto size-4 shrink-0" />}
        <span className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
      </button>
      {expanded && (
        <ol role="list" className="divide-y divide-grid-dimmed border-t border-grid-bright">
          {entries.map(({ frame, index }) => (
            <li key={`${frame.file}:${frame.line}:${index}`} className="flex min-w-0 flex-col gap-1 p-3 @sm:flex-row @sm:items-center @sm:justify-between">
              <div className="min-w-0 truncate font-mono text-base text-text-bright @sm:text-xs">{formatCall(frame)}</div>
              <div className="min-w-0 shrink-0 text-base text-text-faint @sm:max-w-1/2 @sm:text-xs"><SourceLink file={frame.file} line={frame.line} href={frame.href} compact /></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SourceLink({ file, line, href, compact = false }: { file: string; line: number | null; href: string | null; compact?: boolean }) {
  const location = `${file}:${line ?? 0}`;
  const content = <><span className={compact ? "truncate" : "min-w-0 truncate"}>{location}</span>{href && <IconExternalLink className="size-4 shrink-0" />}</>;

  return href ? (
    <a href={href} title={`Open ${location} in editor`} className="flex min-w-0 items-center gap-1 hover:text-text-bright hover:underline" onClick={(event) => event.stopPropagation()}>{content}</a>
  ) : <div className="flex min-w-0 items-center gap-1">{content}</div>;
}

function formatCall(frame: ExceptionFrame) {
  if (frame.class && frame.type) return `${frame.class}${frame.type}${frame.function}`;
  return frame.function || "throw";
}

function groupFrames(frames: ExceptionFrame[]) {
  return frames.reduce<Array<{ vendor: boolean; entries: FrameEntry[] }>>((groups, frame, index) => {
    const group = groups.at(-1);
    if (!group || group.vendor !== frame.isVendor) groups.push({ vendor: frame.isVendor, entries: [] });
    groups.at(-1)?.entries.push({ frame, index });
    return groups;
  }, []);
}
