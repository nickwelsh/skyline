/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/useRunsLiveReload.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server resource fetchers are replaced by React Router list revalidation.
 */
import { useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import type { PresentedRun } from "~/components/runs/v3/TaskRunsTable";

export function useRunsLiveReload({ runs, pollIntervalMs }: { runs: PresentedRun[]; pollIntervalMs: number }) {
  const revalidator = useRevalidator();
  const hasActiveRuns = runs.some((run) => ["queued", "running", "retrying"].includes(run.status));

  useEffect(() => {
    if (!hasActiveRuns) return;
    const timer = window.setInterval(() => revalidator.revalidate(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [hasActiveRuns, pollIntervalMs, revalidator]);

  return revalidator;
}
