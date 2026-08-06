/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, status, assignment, alert, version, search, and write-action concerns are removed.
 */
import { useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { BugIcon } from "~/assets/icons/BugIcon";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import { Spinner } from "~/components/primitives/Spinner";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "~/components/primitives/Table";
import { DateTimeShort } from "~/components/primitives/DateTime";

type ErrorGroupsRouteData = {
  errorGroups: Array<{
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
    latest: { runId: string; attemptNumber: number; runPath: string; attemptPath: string };
  }>;
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

export default function ErrorsRoute() {
  const data = useLoaderData() as ErrorGroupsRouteData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value && value !== "all" ? next.set(key, value) : next.delete(key);
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar><PageTitle title={<><BugIcon className="size-4 text-error" />Errors</>} /></NavBar>
      <PageBody scrollable={false}>
        <div className="grid h-full max-h-full grid-rows-[2.5rem_1fr] overflow-hidden">
          <div aria-label="Error group filters" className="flex items-center justify-between gap-2 border-b border-grid-bright px-2">
            <div className="flex min-w-0 items-center gap-2">
              <Filter label="Job type" value={data.filters.jobType ?? ""} options={data.filterOptions.jobTypes} allLabel="All Job types" onChange={(value) => update("jobType", value)} />
              <Filter label="Exception class" value={data.filters.exceptionClass ?? ""} options={data.filterOptions.exceptionClasses} allLabel="All exception classes" onChange={(value) => update("exceptionClass", value)} />
              <Filter label="Time range" value={data.filters.period} options={data.filterOptions.timeRanges.map((option) => option.value)} labels={Object.fromEntries(data.filterOptions.timeRanges.map((option) => [option.value, option.label]))} allLabel="All time" onChange={(value) => update("period", value)} />
              {data.hasFilters ? <button type="button" className="rounded px-2 py-1 text-xs hover:bg-background-hover focus-custom" onClick={() => setSearchParams(new URLSearchParams())}>Clear filters</button> : null}
            </div>
            <ListPagination list={data} />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            {data.errorGroups.length > 0 ? <ErrorsTable groups={data.errorGroups} /> : <ErrorsEmpty filtered={data.hasAnyErrorGroups} />}
            {navigation.state !== "idle" ? <div aria-label="Loading Errors" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div> : null}
          </div>
        </div>
      </PageBody>
    </PageContainer>
  );
}

function Filter({ label, value, options, labels = {}, allLabel, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; allLabel: string; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} className="h-7 max-w-56 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">{allLabel}</option>
      {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
    </select>
  );
}

function ErrorsTable({ groups }: { groups: ErrorGroupsRouteData["errorGroups"] }) {
  return (
    <Table containerClassName="max-h-full pb-10" showTopBorder={false}>
      <TableHeader><TableRow>
        <TableHeaderCell>ID</TableHeaderCell><TableHeaderCell>Job</TableHeaderCell><TableHeaderCell>Exception</TableHeaderCell><TableHeaderCell>Error</TableHeaderCell><TableHeaderCell>Occurrences</TableHeaderCell><TableHeaderCell>Latest</TableHeaderCell><TableHeaderCell>First seen</TableHeaderCell><TableHeaderCell>Last seen</TableHeaderCell>
      </TableRow></TableHeader>
      <TableBody>{groups.map((group) => (
        <TableRow key={group.id}>
          <TableCell to={group.path} isTabbableCell className="font-mono">{group.fingerprint.slice(-8)}</TableCell>
          <TableCell to={group.jobPath}>{group.jobType}</TableCell>
          <TableCell to={group.path} className="font-mono">{group.exceptionClass}</TableCell>
          <TableCell to={group.path} className="max-w-96 font-mono"><span className="block max-w-96 truncate" title={group.representativeMessage}>{group.representativeMessage}</span></TableCell>
          <TableCell to={group.path}><span className="tabular-nums">{group.occurrenceCount.toLocaleString()}</span></TableCell>
          <TableCell to={group.latest.attemptPath}><span className="font-mono">{group.latest.runId} / {group.latest.attemptNumber}</span></TableCell>
          <TableCell to={group.path}><DateTimeShort date={group.firstObservedAt} /></TableCell>
          <TableCell to={group.path}><DateTimeShort date={group.lastObservedAt} /></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

function ErrorsEmpty({ filtered }: { filtered: boolean }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><BugIcon className="size-16 text-secondary" /><div><h2 className="font-medium text-text-bright">{filtered ? "No matching Error groups" : "No Error groups yet"}</h2><Paragraph className="mt-1 text-text-dimmed">{filtered ? "Change or clear filters to see more Error groups." : "Failed Attempts will appear here when Skyline observes them."}</Paragraph></div></div>;
}

export function ErrorsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Error groups could not be loaded.";
  return <PageContainer><NavBar><PageTitle title="Errors" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load Errors</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>;
}
