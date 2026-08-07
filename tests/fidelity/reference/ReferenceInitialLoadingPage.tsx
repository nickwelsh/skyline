import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Spinner } from "~/components/primitives/Spinner";

export type ReferenceLoadingRoute = {
  label: string;
  title: string;
  back?: { to: string; text: string };
};

const routeMetadata = {
  jobs: { rootSurface: "jobs", detailSurface: "job", list: "Jobs", detail: "Job" },
  runs: { rootSurface: "runs", detailSurface: "run", list: "Runs", detail: "Run" },
  queues: { rootSurface: "queues", detailSurface: "queue", list: "Queues", detail: "Queue target" },
  errors: { rootSurface: "errors", detailSurface: "error", list: "Errors", detail: "Error group" },
  logs: { rootSurface: "logs", detailSurface: "log", list: "Logs", detail: "Telemetry event" },
} as const;

type RouteMetadata = (typeof routeMetadata)[keyof typeof routeMetadata];
export type ReferenceLoadingSurface = RouteMetadata["rootSurface"] | RouteMetadata["detailSurface"] | "shell";

export function ReferenceInitialLoadingPage({ route }: { route: ReferenceLoadingRoute }) {
  return (
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
  );
}

export function referenceInitialLoadingRoute(canonicalUrl: string): ReferenceLoadingRoute {
  const pathname = new URL(canonicalUrl, "https://skyline.invalid").pathname;
  const relative = pathname === "/skyline"
    ? "/"
    : pathname.startsWith("/skyline/")
      ? pathname.slice("/skyline".length)
      : pathname;
  const [segment = "runs", id] = relative.replace(/^\/+/, "").split("/");
  const labels = routeMetadata[segment as keyof typeof routeMetadata] ?? routeMetadata.runs;

  if (!id) return { label: labels.list, title: labels.list };

  return {
    label: labels.detail,
    title: decode(id),
    back: { to: `/${segment}`, text: labels.list },
  };
}

export function referenceInitialLoadingCanonicalCapture(surface: ReferenceLoadingSurface): string {
  if (surface === "shell") return "runs-populated";
  const route = Object.values(routeMetadata).find(({ rootSurface, detailSurface }) => rootSurface === surface || detailSurface === surface);
  if (!route) return "runs-populated";
  return surface === route.detailSurface ? `${surface}-found` : `${surface}-populated`;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
