/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves FiltersBar, ErrorsList, ErrorGroupRow, table, activity, pagination,
 * and route-state composition. Server, tenant, status, assignment, alert,
 * version and write-action concerns are external or capability-hidden.
 */
import { useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { Bar } from "recharts";
import { BugIcon } from "~/assets/icons/BugIcon";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ListPagination } from "~/components/ListPagination";
import { LogsTaskFilter } from "~/components/logs/LogsTaskFilter";
import { ActivityBarChart } from "~/components/metrics/ActivityBarChart";
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
import { TimeFilter, type TimeFilterApplyValues } from "~/components/runs/v3/TimeFilter";

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
  filters: { search: string | null; jobType: string | null; exceptionClass: string | null; period: string | null; from: string | null; to: string | null };
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
  const applyTime = (value: TimeFilterApplyValues) => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["period", "from", "to", "cursor", "direction"]) next.delete(key);
    if (value.period) next.set("period", value.period);
    if (value.from) next.set("from", value.from);
    if (value.to) next.set("to", value.to);
    setSearchParams(next);
  };

  return (
    <div
      aria-label="Error group filters"
      className="flex items-start justify-between gap-x-2 border-b border-grid-bright p-2"
    >
      <div className="flex min-w-0 flex-row flex-wrap items-center gap-1.5">
        <SearchInput placeholder="Search errors…" paramName="search" />
        <LogsTaskFilter
          possibleTasks={list.filterOptions.jobTypes.map((slug) => ({
            slug,
            triggerSource: "STANDARD" as const,
            isInLatestDeployment: true,
          }))}
        />
        <TimeFilter
          defaultPeriod="24h"
          labelName="Occurred"
          period={list.filters.period ?? undefined}
          from={list.filters.from ?? undefined}
          to={list.filters.to ?? undefined}
          onValueChange={applyTime}
          valueClassName="text-text-bright"
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
          <TableHeaderCell>Activity (24h)</TableHeaderCell>
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
  const [searchParams] = useSearchParams();
  const timeParams = new URLSearchParams();
  for (const key of ["period", "from", "to"]) {
    const value = searchParams.get(key);
    if (value) timeParams.set(key, value);
  }
  const errorPath = timeParams.size > 0 ? `${errorGroup.path}?${timeParams}` : errorGroup.path;

  return (
    <TableRow>
      <TableCell to={errorPath} isTabbableCell className="font-mono">
        {errorGroup.fingerprint.slice(-8)}
      </TableCell>
      <TableCell to={errorPath}>{errorGroup.jobType}</TableCell>
      <TableCell to={errorPath} className="max-w-96 font-mono">
        <span title={errorGroup.representativeMessage}>
          {errorGroup.representativeMessage.length > 128
            ? `${errorGroup.representativeMessage.slice(0, 128)}…`
            : errorGroup.representativeMessage}
        </span>
      </TableCell>
      <TableCell to={errorPath}>
        <span className="tabular-nums">{errorGroup.occurrenceCount.toLocaleString()}</span>
      </TableCell>
      <TableCell to={errorPath} actionClassName="py-1.5">
        <ErrorActivityGraph activity={errorGroup.activity} />
      </TableCell>
      <TableCell to={errorPath} className="tabular-nums">
        <RelativeDateTime date={errorGroup.firstObservedAt} />
      </TableCell>
      <TableCell to={errorPath} className="tabular-nums">
        <RelativeDateTime date={errorGroup.lastObservedAt} />
      </TableCell>
    </TableRow>
  );
}

function ErrorActivityGraph({ activity }: { activity: ErrorGroup["activity"] }) {
  const peak = Math.max(0, ...activity.map((point) => point.occurrences));

  return (
    <div role="img" aria-label="Error occurrences over the past 24 hours">
      <ActivityBarChart
        data={activity}
        max={peak}
        tooltip={<span />}
        peak={formatNumberCompact(peak)}
        peakTooltip="Peak occurrences in a single hour"
      >
        <Bar dataKey="occurrences" fill="#6366F1" strokeWidth={0} isAnimationActive={false} />
      </ActivityBarChart>
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
