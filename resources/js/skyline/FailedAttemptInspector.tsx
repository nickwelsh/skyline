import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { ClipboardCheckIcon, ClipboardIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { TextCapturePreview } from "../trigger/CapturePreview";
import { Callout } from "../trigger/components/primitives/Callout";
import { Header3 } from "../trigger/components/primitives/Headers";
import { useCopy } from "../trigger/hooks/useCopy";
import type { ExceptionDetails, ExceptionFrame } from "./dto";

type FrameEntry = { frame: ExceptionFrame; index: number };

export function FailedAttemptInspector({ exception }: { exception: ExceptionDetails }) {
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupFrames(exception.frames), [exception.frames]);
  const mainFrame = exception.frames.findIndex((frame) => !frame.isVendor);

  return (
    <section aria-label="Exception" className="flex flex-col gap-2 rounded-sm border border-rose-500/50 px-3 pb-3 pt-2">
      <div className="flex min-w-0 items-center gap-2">
        <Header3 className="min-w-0 flex-1 truncate text-rose-500">{exception.class}</Header3>
        <CopyMarkdown markdown={exception.markdown} />
      </div>
      <Callout variant="error">
        <pre className="text-wrap font-sans text-sm font-normal text-rose-500 dark:text-rose-200 [word-break:break-word]">
          {exception.message}
        </pre>
      </Callout>
      {exception.messageTruncated && <div className="text-xs text-warning">Exception message truncated</div>}
      <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs text-text-faint">
        {exception.location
          ? <SourceLink file={exception.location.file} line={exception.location.line} href={exception.location.href} />
          : <span>Source location not captured</span>}
        {exception.code && <span>Code {exception.code}</span>}
      </div>
      {exception.frames.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="exception-trace"
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-9 w-full items-center gap-2 border-t border-grid-bright pt-2 text-left text-xs text-text-dimmed hover:text-text-bright focus-custom"
          >
            <span>{expanded ? "Hide stack trace" : `Show ${exception.frames.length.toLocaleString()} ${exception.frames.length === 1 ? "frame" : "frames"}`}</span>
            {exception.framesTruncated && <span>· Truncated</span>}
            {expanded ? <ChevronUpIcon className="ml-auto size-4" /> : <ChevronDownIcon className="ml-auto size-4" />}
          </button>
          {expanded && (
            <div id="exception-trace" className="flex max-h-[40rem] flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
              {groups.map((group, index) => group.vendor
                ? <VendorFrames key={`vendor-${index}`} entries={group.entries} />
                : group.entries.map((entry) => <ApplicationFrame key={`${entry.frame.file}:${entry.frame.line}:${entry.index}`} entry={entry} main={entry.index === mainFrame} />))}
            </div>
          )}
        </>
      ) : <div className="border-t border-grid-bright pt-2 text-xs text-text-faint">Stack trace not captured</div>}
    </section>
  );
}

function CopyMarkdown({ markdown }: { markdown: string }) {
  const { copy, copied } = useCopy(markdown);

  return (
    <button
      type="button"
      aria-label="Copy exception as Markdown"
      onClick={copy}
      className={`inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus-custom ${copied ? "text-success" : "text-text-dimmed hover:text-text-bright"}`}
    >
      {copied ? "Copied" : "Copy as Markdown"}
      {copied ? <ClipboardCheckIcon className="size-3" /> : <ClipboardIcon className="size-3" />}
    </button>
  );
}

function ApplicationFrame({ entry, main }: { entry: FrameEntry; main: boolean }) {
  const { frame, index } = entry;
  const [expanded, setExpanded] = useState(main && frame.snippet !== null);

  return (
    <article className="shrink-0 overflow-hidden rounded border border-grid-bright bg-background-deep">
      <div className="flex min-w-0 items-stretch">
        <button
          type="button"
          disabled={!frame.snippet}
          aria-expanded={frame.snippet ? expanded : undefined}
          onClick={() => frame.snippet && setExpanded((value) => !value)}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-3 text-left hover:bg-background-hover disabled:cursor-default disabled:hover:bg-transparent focus-custom"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-bright">{formatCall(frame)}</span>
          {frame.snippet && (expanded ? <ChevronUpIcon className="size-4 shrink-0" /> : <ChevronDownIcon className="size-4 shrink-0" />)}
        </button>
        <div className="flex min-w-0 max-w-1/2 items-center border-l border-grid-bright px-3 text-xs text-text-faint">
          <SourceLink file={frame.file} line={frame.line} href={frame.href} compact />
        </div>
      </div>
      {expanded && frame.snippet && (
        <div className="border-t border-grid-bright bg-background-dimmed p-2">
          <TextCapturePreview
            value={frame.snippet.code}
            language="php"
            label={`application frame ${index + 1}`}
          />
        </div>
      )}
    </article>
  );
}

function VendorFrames({ entries }: { entries: FrameEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0 overflow-hidden rounded border border-dashed border-grid-bright bg-background-dimmed">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-9 w-full items-center gap-2 px-3 text-xs text-text-faint hover:bg-background-hover hover:text-text-bright focus-custom"
      >
        {expanded ? <FolderOpenIcon className="size-4" /> : <FolderIcon className="size-4" />}
        <span>{entries.length.toLocaleString()} vendor {entries.length === 1 ? "frame" : "frames"}</span>
        {expanded ? <ChevronUpIcon className="ml-auto size-4" /> : <ChevronDownIcon className="ml-auto size-4" />}
      </button>
      {expanded && (
        <ol className="divide-y divide-grid-dimmed border-t border-grid-bright">
          {entries.map(({ frame, index }) => (
            <li key={`${frame.file}:${frame.line}:${index}`} className="flex min-w-0 flex-col gap-1 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 truncate font-mono text-text-bright">{formatCall(frame)}</span>
              <SourceLink file={frame.file} line={frame.line} href={frame.href} compact />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SourceLink({ file, line, href, compact = false }: { file: string; line: number | null; href: string | null; compact?: boolean }) {
  const location = `${file}:${line ?? "?"}`;
  const content = <span className={compact ? "truncate" : "min-w-0 truncate"}>{location}</span>;

  return href
    ? <a href={href} title={`Open ${location} in editor`} className="flex min-w-0 items-center gap-1 hover:text-text-bright hover:underline" onClick={(event) => event.stopPropagation()}>{content}</a>
    : <span className="flex min-w-0 items-center gap-1">{content}</span>;
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
