/*!
 * Adapted from Trigger.dev RunError in
 * apps/webapp/app/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Retains the failure container, heading, message callout, and code-viewer
 * composition; accepts Skyline's captured PHP frames and editor links.
 */
import {
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { CopyButton } from "./CapturePreview";
import { CodeBlock } from "./CodeBlock";
import { Callout } from "./components/primitives/Callout";
import { Header3 } from "./components/primitives/Headers";

export type ExceptionPreviewFrame = {
  file: string;
  line: number | null;
  class: string | null;
  type: string | null;
  function: string;
  isVendor: boolean;
  href: string | null;
  snippet: { code: string; startingLine: number; highlightedLine: number } | null;
};

export type ExceptionPreviewData = {
  class: string;
  message: string;
  messageTruncated: boolean;
  messageOriginalBytes: number;
  code: string | null;
  location: { file: string; line: number | null; href: string | null } | null;
  frames: ExceptionPreviewFrame[];
  framesTruncated: boolean;
  markdown: string;
};

type FrameEntry = { frame: ExceptionPreviewFrame; index: number };

export function ExceptionPreview({ exception, extensionId = "error-exception-evidence" }: { exception: ExceptionPreviewData; extensionId?: string | null }) {
  const exceptionKey = `${exception.class}\n${exception.message}\n${exception.markdown}`;
  const [disclosure, setDisclosure] = useState({ key: exceptionKey, expanded: false });
  const expanded = disclosure.key === exceptionKey && disclosure.expanded;
  const attemptPresenter = extensionId === "attempt-exception-evidence";
  const groups = useMemo(() => groupFrames(exception.frames), [exception.frames]);
  const mainFrame = exception.frames.findIndex((frame) => !frame.isVendor);

  const metadata = (
    <>
      {exception.messageTruncated && <div className="text-xs text-warning">Exception message truncated</div>}
      <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs text-text-faint">
        {exception.location
          ? <SourceLink file={exception.location.file} line={exception.location.line} href={exception.location.href} outOfTabOrder={attemptPresenter} />
          : <span>Source location not captured</span>}
        {exception.code && <span>Code {exception.code}</span>}
        {attemptPresenter && <CopyButton value={exception.markdown} label="exception as Markdown" idleText="Copy as Markdown" tabIndex={-1} />}
      </div>
    </>
  );

  const trace = exception.frames.length > 0 ? (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="exception-trace"
        onClick={() => setDisclosure({ key: exceptionKey, expanded: !expanded })}
        className="relative flex min-h-9 w-full items-center gap-2 border-t border-grid-bright pt-2 text-left text-xs text-text-dimmed hover:text-text-bright focus-custom"
      >
        <IconCode className="size-4 shrink-0" />
        <span>{expanded ? "Hide trace" : `Show ${exception.frames.length.toLocaleString()} ${exception.frames.length === 1 ? "frame" : "frames"}`}</span>
        {exception.framesTruncated && <span>· Truncated</span>}
        {expanded ? <IconChevronUp className="ml-auto size-4 shrink-0" /> : <IconChevronDown className="ml-auto size-4 shrink-0" />}
      </button>
      {expanded && (
        <div id="exception-trace" className="flex max-h-[40rem] flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
          {groups.map((group) => group.vendor
            ? <VendorFrames key={`vendor-${group.entries[0].index}`} entries={group.entries} />
            : group.entries.map((entry) => <ApplicationFrame key={`${entry.frame.file}:${entry.frame.line}:${entry.index}`} entry={entry} main={entry.index === mainFrame} />))}
        </div>
      )}
    </>
  ) : <div className="border-t border-grid-bright pt-2 text-xs text-text-faint">Stack trace not captured</div>;

  return (
    <section data-skyline-extension={attemptPresenter ? undefined : extensionId ?? undefined} role={attemptPresenter ? undefined : "region"} aria-label={attemptPresenter ? undefined : "Exception"} className="flex flex-col gap-2 rounded-sm border border-rose-500/50 px-3 pb-3 pt-2">
      {attemptPresenter
        ? <Header3 className="text-rose-500">{exception.class}</Header3>
        : <div className="flex min-w-0 items-center gap-2">
          <Header3 className="min-w-0 flex-1 truncate text-rose-500">{exception.class}</Header3>
          <CopyButton value={exception.markdown} label="exception as Markdown" idleText="Copy as Markdown" />
        </div>}
      <Callout variant="error">
        <pre className="text-wrap font-sans text-sm font-normal text-rose-500 dark:text-rose-200 [word-break:break-word]">
          {exception.message}
        </pre>
      </Callout>
      {attemptPresenter
        ? <div data-skyline-extension="attempt-exception-evidence" role="region" aria-label="Exception" className="flex h-[3.625rem] flex-col overflow-y-auto rounded-md border border-grid-bright px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">{metadata}{trace}</div>
        : <>{metadata}{trace}</>}
    </section>
  );
}

function ApplicationFrame({ entry, main }: { entry: FrameEntry; main: boolean }) {
  const { frame, index } = entry;
  const [expanded, setExpanded] = useState(main && frame.snippet !== null);
  const panelId = `exception-frame-${index}`;

  return (
    <article className="shrink-0 overflow-hidden rounded border border-grid-bright bg-background-deep">
      <div className="flex min-w-0 items-stretch">
        <button
          type="button"
          disabled={!frame.snippet}
          aria-expanded={frame.snippet ? expanded : undefined}
          aria-controls={frame.snippet ? panelId : undefined}
          onClick={() => frame.snippet && setExpanded((value) => !value)}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-3 text-left hover:bg-background-hover disabled:cursor-default disabled:hover:bg-transparent focus-custom"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-bright">{formatCall(frame)}</span>
          {frame.snippet && (expanded ? <IconChevronUp className="size-4 shrink-0" /> : <IconChevronDown className="size-4 shrink-0" />)}
        </button>
        <div className="flex min-w-0 max-w-1/2 items-center border-l border-grid-bright px-3 text-xs text-text-faint">
          <SourceLink file={frame.file} line={frame.line} href={frame.href} compact />
        </div>
      </div>
      {expanded && frame.snippet && (
        <div id={panelId} className="border-t border-grid-bright bg-background-dimmed">
          <CodeBlock
            code={frame.snippet.code}
            language="php"
            highlightedRanges={[[frame.snippet.highlightedLine - frame.snippet.startingLine + 1, frame.snippet.highlightedLine - frame.snippet.startingLine + 1]]}
            label={`application frame ${index + 1}`}
            maxLines={20}
            showLineNumbers
            showTextWrapping
          />
        </div>
      )}
    </article>
  );
}

function VendorFrames({ entries }: { entries: FrameEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `exception-vendor-${entries[0].index}`;

  return (
    <div className="shrink-0 overflow-hidden rounded border border-dashed border-grid-bright bg-background-dimmed">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-9 w-full items-center gap-2 px-3 text-xs text-text-faint hover:bg-background-hover hover:text-text-bright focus-custom"
      >
        {expanded ? <IconFolderOpen className="size-4" /> : <IconFolder className="size-4" />}
        <span>{entries.length.toLocaleString()} vendor {entries.length === 1 ? "frame" : "frames"}</span>
        {expanded ? <IconChevronUp className="ml-auto size-4" /> : <IconChevronDown className="ml-auto size-4" />}
      </button>
      {expanded && (
        <ol id={panelId} role="list" className="divide-y divide-grid-dimmed border-t border-grid-bright">
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

function SourceLink({ file, line, href, compact = false, outOfTabOrder = false }: { file: string; line: number | null; href: string | null; compact?: boolean; outOfTabOrder?: boolean }) {
  const location = `${file}:${line ?? "?"}`;
  const content = <><span className={compact ? "truncate" : "min-w-0 truncate"}>{location}</span>{href && <IconExternalLink className="size-4 shrink-0" />}</>;

  return href
    ? <a href={href} target="_blank" rel="noreferrer" tabIndex={outOfTabOrder ? -1 : undefined} title={`Open ${location} in editor`} className="flex min-w-0 items-center gap-1 hover:text-text-bright hover:underline" onClick={(event) => event.stopPropagation()}>{content}</a>
    : <span className="flex min-w-0 items-center gap-1">{content}</span>;
}

function formatCall(frame: ExceptionPreviewFrame) {
  if (frame.class && frame.type) return `${frame.class}${frame.type}${frame.function}`;
  return frame.function || "throw";
}

function groupFrames(frames: ExceptionPreviewFrame[]) {
  return frames.reduce<Array<{ vendor: boolean; entries: FrameEntry[] }>>((groups, frame, index) => {
    const group = groups.at(-1);
    if (!group || group.vendor !== frame.isVendor) groups.push({ vendor: frame.isVendor, entries: [] });
    groups.at(-1)?.entries.push({ frame, index });
    return groups;
  }, []);
}
