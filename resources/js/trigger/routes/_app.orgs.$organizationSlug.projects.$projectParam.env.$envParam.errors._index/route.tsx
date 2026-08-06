/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves FiltersBar, ErrorsList, ErrorGroupRow, table, activity, pagination,
 * and route-state composition. Server, tenant, status, assignment, alert,
 * version, search, and write-action concerns are external or capability-hidden.
 */
import { useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useMemo } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BugIcon } from "~/assets/icons/BugIcon";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ListPagination } from "~/components/ListPagination";
import { Button } from "~/components/primitives/Buttons";
import { Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Spinner } from "~/components/primitives/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
import { SimpleTooltip } from "~/components/primitives/Tooltip";

type ErrorGroup = {
  id: string;
  fingerprint: string;
  path: string;
  jobType: string;
  jobPath: string;
  exceptionClass: string;
  representativeMessage: string;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
  activity: Array<{ timestamp: string; occurrences: number }>;
};

type ErrorsListData = {
  errorGroups: ErrorGroup[];
  pagination: { next?: string; previous?: string };
  filters: { jobType: string | null; exceptionClass: string | null; period: string };
  filterOptions: {
    jobTypes: string[];
    exceptionClasses: string[];
    timeRanges: Array<{ value: string; label: string }>;
  };
  hasAnyErrorGroups: boolean;
  hasFilters: boolean;
};

export default function Page() {
  const data = useLoaderData() as ErrorsListData;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar>
        <PageTitle title="Errors" />
      </NavBar>
      <PageBody scrollable={false}>
        <div className="grid h-full max-h-full grid-rows-[2.5rem_1fr] overflow-hidden">
          <FiltersBar list={data} />
          <div className="relative min-h-0 overflow-hidden">
            <ErrorsList
              errorGroups={data.errorGroups}
              hasAnyErrorGroups={data.hasAnyErrorGroups}
              hasFilters={data.hasFilters}
            />
            {navigation.state !== "idle" && (
              <div
                aria-label="Loading Errors"
                className="absolute inset-0 grid place-items-center bg-background-dimmed/80"
              >
                <Spinner />
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </PageContainer>
  );
}

function FiltersBar({ list }: { list: ErrorsListData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value && value !== "all" ? next.set(key, value) : next.delete(key);
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };

  return (
    <div
      aria-label="Error group filters"
      className="flex items-start justify-between gap-x-2 border-b border-grid-bright p-2"
    >
      <div className="flex min-w-0 flex-row flex-wrap items-center gap-1.5">
        <SearchInput placeholder="Search errors…" paramName="exceptionClass" />
        <Filter
          label="Task"
          value={list.filters.jobType ?? ""}
          options={list.filterOptions.jobTypes.map((value) => ({ value, label: value }))}
          allLabel="Tasks"
          onChange={(value) => update("jobType", value)}
        />
        <Filter
          label="Exception class"
          value={list.filters.exceptionClass ?? ""}
          options={list.filterOptions.exceptionClasses.map((value) => ({ value, label: value }))}
          allLabel="All exception classes"
          onChange={(value) => update("exceptionClass", value)}
        />
        <Filter
          label="Time range"
          value={list.filters.period}
          options={list.filterOptions.timeRanges}
          onChange={(value) => update("period", value)}
        />
        {list.hasFilters && (
          <Button
            variant="minimal/small"
            LeadingIcon={XMarkIcon}
            tooltip="Clear all filters"
            className="group-hover/button:bg-transparent"
            leadingIconClassName="group-hover/button:text-text-bright"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Clear filters
          </Button>
        )}
      </div>
      <ListPagination list={list} />
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className="h-6 max-w-56 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {allLabel && <option value="">{allLabel}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function ErrorsList({
  errorGroups,
  hasAnyErrorGroups,
  hasFilters,
}: {
  errorGroups: ErrorGroup[];
  hasAnyErrorGroups: boolean;
  hasFilters: boolean;
}) {
  if (errorGroups.length === 0) {
    const filtered = hasAnyErrorGroups && hasFilters;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <BugIcon className="size-16 text-secondary" />
        <div className="text-center">
          <h2 className="font-medium text-text-bright">
            {filtered ? "No matching Error groups" : "No Error groups yet"}
          </h2>
          <Paragraph className="mt-1 text-text-dimmed">
            {filtered
              ? "Change or clear filters to see more Error groups."
              : "Failed Attempts will appear here when Skyline observes them."}
          </Paragraph>
        </div>
      </div>
    );
  }

  return (
    <Table containerClassName="max-h-full pb-10" showTopBorder={false}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
        <TableHeaderCell>Task</TableHeaderCell>
          <TableHeaderCell>Error</TableHeaderCell>
          <TableHeaderCell>Occurrences</TableHeaderCell>
          <TableHeaderCell>Activity</TableHeaderCell>
          <TableHeaderCell>First seen</TableHeaderCell>
          <TableHeaderCell>Last seen</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {errorGroups.map((errorGroup) => (
          <ErrorGroupRow key={errorGroup.id} errorGroup={errorGroup} />
        ))}
      </TableBody>
    </Table>
  );
}

function ErrorGroupRow({ errorGroup }: { errorGroup: ErrorGroup }) {
  return (
    <TableRow>
      <TableCell to={errorGroup.path} isTabbableCell className="font-mono">
        {errorGroup.fingerprint.slice(-8)}
      </TableCell>
      <TableCell to={errorGroup.jobPath}>{errorGroup.jobType}</TableCell>
      <TableCell to={errorGroup.path} className="max-w-96 font-mono">
        <span title={errorGroup.representativeMessage}>
          {errorGroup.representativeMessage.length > 128
            ? `${errorGroup.representativeMessage.slice(0, 128)}…`
            : errorGroup.representativeMessage}
        </span>
      </TableCell>
      <TableCell to={errorGroup.path}>
        <span className="tabular-nums">{errorGroup.occurrenceCount.toLocaleString()}</span>
      </TableCell>
      <TableCell to={errorGroup.path} actionClassName="py-1.5">
        <ErrorActivityGraph activity={errorGroup.activity} />
      </TableCell>
      <TableCell to={errorGroup.path} className="tabular-nums">
        <RelativeDateTime date={errorGroup.firstObservedAt} />
      </TableCell>
      <TableCell to={errorGroup.path} className="tabular-nums">
        <RelativeDateTime date={errorGroup.lastObservedAt} />
      </TableCell>
    </TableRow>
  );
}

function ErrorActivityGraph({ activity }: { activity: ErrorGroup["activity"] }) {
  const data = useMemo(() => activity.map((point) => ({ date: point.timestamp, count: point.occurrences })), [activity]);
  const peak = Math.max(...data.map((point) => point.count));

  return (
    <div role="img" aria-label="Error occurrence activity" className="flex items-start gap-1.5">
      <div className="h-6 w-28 rounded-sm">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <YAxis domain={[0, peak || 1]} hide />
            <Tooltip animationDuration={0} content={() => null} />
            <Bar dataKey="count" fill="#6366F1" strokeWidth={0} isAnimationActive={false} minPointSize={1} />
            <ReferenceLine y={0} stroke="var(--color-border-bright)" strokeWidth={1} />
            {peak > 0 && <ReferenceLine y={peak} stroke="var(--color-border-brighter)" strokeDasharray="4 4" strokeWidth={1} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SimpleTooltip
        asChild
        button={<span className="-mt-1 text-xxs tabular-nums text-text-dimmed">{formatNumberCompact(peak)}</span>}
        content="Peak occurrences in a single time bucket"
      />
    </div>
  );
}

function RelativeDateTime({ date }: { date: string }) {
  const elapsed = Date.now() - new Date(date).getTime();
  const divisions = [
    { milliseconds: 86_400_000, singular: "day", plural: "days" },
    { milliseconds: 3_600_000, singular: "hour", plural: "hours" },
    { milliseconds: 60_000, singular: "minute", plural: "minutes" },
  ];
  const unit = divisions.find(({ milliseconds }) => elapsed >= milliseconds) ?? divisions[2];
  const value = Math.max(1, Math.floor(elapsed / unit.milliseconds));
  return <span title={date}>{value} {value === 1 ? unit.singular : unit.plural} ago</span>;
}

function formatNumberCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ErrorsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Error groups could not be loaded.";

  return (
    <PageContainer>
      <NavBar><PageTitle title="Errors" /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">Unable to load Errors</h1>
          <p className="mt-1 text-sm text-text-dimmed">{message}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
