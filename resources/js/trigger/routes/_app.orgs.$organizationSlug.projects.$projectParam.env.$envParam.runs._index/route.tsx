/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders, tenant contexts, write actions, development presence, docs, and bulk UI are external or omitted.
 */
import { ArrowPathIcon, PlayIcon } from "@heroicons/react/20/solid";
import { useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Button } from "~/components/primitives/Buttons";
import { NavBar, PageAccessories, PageTitle } from "~/components/primitives/PageHeader";
import { Spinner } from "~/components/primitives/Spinner";
import { RunsFilters, type RunFilterOptions } from "~/components/runs/v3/RunFilters";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import { useRunsLiveReload } from "./useRunsLiveReload";

export type RunsRouteData = {
  generatedAt: string;
  runs: PresentedRun[];
  pagination: { previous?: string; next?: string };
  filterOptions: RunFilterOptions;
  hasAnyRuns: boolean;
  hasFilters: boolean;
  polling: { activeRunsIntervalMs: number; newRunsIntervalMs: number };
};

export default function RunsRoute() {
  const data = useLoaderData() as RunsRouteData;
  const navigation = useNavigation();
  const revalidator = useRunsLiveReload({ runs: data.runs, pollIntervalMs: data.polling.activeRunsIntervalMs });
  const isLoading = navigation.state !== "idle" || revalidator.state !== "idle";

  return (
    <PageContainer>
      <NavBar>
        <PageTitle title={<><PlayIcon className="size-4 text-runs" />Runs</>} />
        <PageAccessories>
          <Button
            variant="secondary/small"
            LeadingIcon={ArrowPathIcon}
            onClick={() => revalidator.revalidate()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </PageAccessories>
      </NavBar>
      <PageBody scrollable={false} className="grid min-h-0 grid-rows-[auto_1fr_auto] p-0">
        <RunsFilters options={data.filterOptions} />
        <div className="relative min-h-0 overflow-hidden">
          {data.runs.length > 0 ? (
            <TaskRunsTable runs={data.runs} isLoading={isLoading} />
          ) : (
            <EmptyState filtered={data.hasAnyRuns && data.hasFilters} />
          )}
          {isLoading && data.runs.length === 0 && <LoadingState />}
        </div>
        <div className="flex h-11 items-center justify-end border-t border-grid-bright px-3">
          <ListPagination list={data} />
        </div>
      </PageBody>
    </PageContainer>
  );
}

export function RunsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "The Runs list could not be loaded.";
  return (
    <PageContainer>
      <NavBar><PageTitle title="Runs" /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">Unable to load Runs</h1>
          <p className="mt-1 text-sm text-text-dimmed">{message}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}

function LoadingState() {
  return <div aria-label="Loading Runs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>;
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid h-full min-h-64 place-items-center text-center">
      <div>
        <h2 className="font-medium text-text-bright">{filtered ? "No matching Runs" : "No Runs yet"}</h2>
        <p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see more Runs." : "Confirmed Runs will appear here."}</p>
      </div>
    </div>
  );
}
