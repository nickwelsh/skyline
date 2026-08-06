import "non.geist";
import "non.geist/mono";
import React, { createElement, useEffect } from "react";
import ReactDOM from "react-dom/client";
import {
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
  useParams,
} from "@remix-run/react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { LocaleContextProvider } from "~/components/primitives/LocaleProvider";
import { OperatingSystemContextProvider } from "~/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "~/components/primitives/ShortcutsProvider";
import ProjectLayout, { ErrorBoundary as ProjectError } from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam/route";
import Jobs from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route";
import JobDetail from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route";
import RunsLayout from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs/route";
import Runs from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import RunDetail from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route";
import ErrorsLayout from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors/route";
import Errors from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route";
import ErrorDetail from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route";
import Logs from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route";
import Queues from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route";
import QueueDetail from "~/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route";
import "~/tailwind.css";

const fixtureVersion = "nw-227-v1" as const;
const elements = {
  jobs: createElement(Jobs),
  job: createElement(JobDetail),
  runs: createElement(Runs),
  run: createElement(RunDetail),
  errors: createElement(Errors),
  error: createElement(ErrorDetail),
  logs: createElement(Logs),
  queues: createElement(Queues),
  queue: createElement(QueueDetail),
};

const routes = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: () => referencePort().context.root,
    element: createElement(ReferenceRoot),
    children: [{
      id: "routes/_app.orgs.$organizationSlug",
      path: "oracle",
      loader: () => referencePort().context.organization,
      element: createElement(ProjectLayout),
      children: [{
        path: ":captureId",
        element: createElement(ReferenceSurfaceLayout),
        children: [{
          index: true,
          loader: ({ request }: { request: Request }) => loadCapture(request),
          element: createElement(ReferenceSurfacePage),
          errorElement: createElement(ProjectError),
        }],
      }],
    }],
  },
], { basename: "/" });
window.__oracleRouter = routes;
document.documentElement.dataset.oracleBooted = "true";
document.documentElement.dataset.applicationIdentity = "trigger-reference";
document.documentElement.dataset.fixtureValues = fixtureVersion;
document.documentElement.dataset.supportedNavigation = Object.keys(elements).join(",");

ReactDOM.createRoot(document.getElementById("reference")!).render(
  createElement(React.StrictMode, null,
    createElement(LocaleContextProvider, { locales: ["en-US"] },
      createElement(OperatingSystemContextProvider, { platform: "linux" },
        createElement(ShortcutsProvider, null,
          createElement(RouterProvider, { router: routes }),
        ),
      ),
    ),
  ),
);

function ReferenceRoot() {
  const navigation = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const capture = captureFromPath(location.pathname);
  useEffect(() => {
    window.__oracleCanonicalUrl = referencePort().canonicalUrl?.(capture.id) ?? `/${capture.id}`;
    document.documentElement.dataset.oracleFixtureVersion = fixtureVersion;
    delete document.documentElement.dataset.oracleReady;
    const refreshState = capture.state === "loading" || capture.state === "stale-refresh";
    if (refreshState && !location.search.includes("__oracle_refresh=1") && navigation.state === "idle") {
      void navigate(`${location.pathname}?__oracle_refresh=1`, { replace: true });
      return;
    }
    if (navigation.state !== (refreshState ? "loading" : "idle")) return;
    let cancelled = false;
    void document.fonts.ready.then(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))).then(() => {
      if (!cancelled) document.documentElement.dataset.oracleReady = "true";
    });
    return () => { cancelled = true; };
  }, [capture.state, location.pathname, location.search, navigate, navigation.state]);
  return createElement(Outlet);
}

function ReferenceSurfaceLayout() {
  const capture = captureFromPath(`/oracle/${useParams().captureId ?? "runs-populated"}`);
  const Layout = capture.surface === "runs" || capture.surface === "run" || capture.surface === "shell"
    ? RunsLayout
    : capture.surface === "errors" || capture.surface === "error"
      ? ErrorsLayout
      : undefined;
  return Layout ? createElement(Layout) : createElement(Outlet);
}

function ReferenceSurfacePage() {
  const capture = captureFromPath(`/oracle/${useParams().captureId ?? "runs-populated"}`);
  return elements[capture.surface] ?? elements.runs;
}

async function loadCapture(request: Request) {
  const capture = captureFromPath(new URL(request.url).pathname);
  const phase = new URL(request.url).searchParams.has("__oracle_refresh") ? "refresh" : "initial";
  return referencePort().load({ fixtureVersion, captureId: capture.id, surface: capture.surface, state: capture.state, phase, request });
}

function captureFromPath(pathname: string) {
  const id = decodeURIComponent(pathname.replace(/^\/oracle\//, "").split("@")[0] ?? "runs-populated");
  const separator = id.indexOf("-");
  if (separator < 1) throw new Error(`Invalid fidelity capture id: ${id}`);
  const surface = id.slice(0, separator);
  if (!(surface in elements)) throw new Error(`Unsupported fidelity surface: ${surface}`);
  return { id, surface: surface as Surface, state: id.slice(separator + 1) };
}

function referencePort(): ReferencePort {
  const port = window.__TRIGGER_FIDELITY_REFERENCE__;
  if (!port) throw new Error("Install window.__TRIGGER_FIDELITY_REFERENCE__ before opening the pinned Trigger reference.");
  if (port.fixtureVersion !== fixtureVersion) throw new Error(`Expected fidelity fixture ${fixtureVersion}; got ${port.fixtureVersion}.`);
  return port;
}

type Surface = keyof typeof elements;
type ReferenceContext = {
  root: Record<string, unknown>;
  organization: Record<string, unknown>;
};
type ReferenceLoad = {
  fixtureVersion: typeof fixtureVersion;
  captureId: string;
  surface: Surface;
  state: string;
  phase: "initial" | "refresh";
  request: Request;
};
type ReferencePort = {
  fixtureVersion: typeof fixtureVersion;
  context: ReferenceContext;
  canonicalUrl?(captureId: string): string;
  load(input: ReferenceLoad): unknown | Promise<unknown>;
};

declare global {
  interface Window {
    __TRIGGER_FIDELITY_REFERENCE__?: ReferencePort;
    __oracleCanonicalUrl?: string;
    __oracleRouter?: typeof routes;
  }
}
