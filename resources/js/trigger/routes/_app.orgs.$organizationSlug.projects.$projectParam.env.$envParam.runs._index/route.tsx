/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders, tenant contexts, write actions, development presence, docs, and bulk UI are external or omitted.
 */
import { useLoaderData, useNavigation } from "@remix-run/react";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { RunsFilters, type RunFilterOptions } from "~/components/runs/v3/RunFilters";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import { useRunsLiveReload } from "./useRunsLiveReload";

export type RunsRouteData = {
  generatedAt: string;
  runs: PresentedRun[];
  pagination: { previous?: string; next?: string };
  filterOptions: RunFilterOptions;
  hasFilters: boolean;
  polling: { activeRunsIntervalMs: number; newRunsIntervalMs: number };
};

export default function RunsRoute() {
  const data = useLoaderData() as RunsRouteData;
  const navigation = useNavigation();
  const revalidator = useRunsLiveReload({
    runs: data.runs,
    activeRunsIntervalMs: data.polling.activeRunsIntervalMs,
    newRunsIntervalMs: data.polling.newRunsIntervalMs,
  });
  const isLoading = navigation.state !== "idle" || revalidator.state !== "idle";

  return (
    <PageContainer>
      <NavBar>
        <PageTitle title="Runs" />
      </NavBar>
      <PageBody scrollable={false}>
        <div className="grid h-full max-h-full grid-rows-[auto_1fr] overflow-hidden">
          <div className="flex items-start justify-between gap-x-2 p-2">
            <RunsFilters options={data.filterOptions} />
            <div className="flex items-center justify-end gap-x-2">
              <ListPagination list={data} />
            </div>
          </div>
          <TaskRunsTable
            total={data.runs.length}
            hasFilters={data.hasFilters}
            runs={data.runs}
            isLoading={isLoading}
          />
        </div>
      </PageBody>
    </PageContainer>
  );
}
