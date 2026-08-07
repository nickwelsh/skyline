import { PageBody, PageContainer } from "../trigger/components/layout/AppLayout";
import { NavBar, PageTitle } from "../trigger/components/primitives/PageHeader";
import { Spinner } from "../trigger/components/primitives/Spinner";
import type { SkylineBootstrap } from "./dto";
import { SkylineShell } from "./SkylineShell";

type LoadingRoute = {
  label: string;
  title: string;
  back?: { to: string; text: string };
};

const routes: Record<string, { list: string; detail: string }> = {
  jobs: { list: "Jobs", detail: "Job" },
  runs: { list: "Runs", detail: "Run" },
  queues: { list: "Queues", detail: "Queue target" },
  errors: { list: "Errors", detail: "Error group" },
  logs: { list: "Logs", detail: "Telemetry event" },
};

export function InitialLoadingState({ bootstrap }: { bootstrap: SkylineBootstrap }) {
  const route = initialLoadingRoute(window.location.pathname, bootstrap.basePath);

  return (
    <SkylineShell bootstrap={bootstrap}>
      <PageContainer>
        <NavBar>
          <PageTitle title={route.title} backButton={route.back} />
        </NavBar>
        <PageBody scrollable={false} className="relative p-0">
          <div aria-label={`Loading ${route.label}`} className="absolute inset-0 grid place-items-center bg-background-dimmed">
            <Spinner />
          </div>
        </PageBody>
      </PageContainer>
    </SkylineShell>
  );
}

export function initialLoadingRoute(pathname: string, basePath: string): LoadingRoute {
  const relative = basePath === "/"
    ? pathname
    : pathname === basePath
      ? "/"
      : pathname.startsWith(`${basePath}/`)
        ? pathname.slice(basePath.length)
        : pathname;
  const [segment = "runs", id] = relative.replace(/^\/+/, "").split("/");
  const labels = routes[segment] ?? routes.runs;

  if (!id) return { label: labels.list, title: labels.list };

  return {
    label: labels.detail,
    title: decode(id),
    back: { to: `/${segment}`, text: labels.list },
  };
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
