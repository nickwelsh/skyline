import {
  Link,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import { ListPagination } from "./vendor/apps/webapp/app/components/ListPagination";

type RunsData = {
  observedAt: string;
  runs: Array<{ id: string; name: string }>;
  pagination: { previous?: string; next?: string };
};

export function PrototypeShell() {
  const location = useLocation();
  const navigation = useNavigation();

  return (
    <main>
      <header>
        <strong>PROTOTYPE — Remix client imports on static React Router</strong>
        <span className={navigation.state === "idle" ? "idle" : "busy"}>
          navigation: {navigation.state}
        </span>
      </header>
      <section className="state">
        <div><b>browser URL</b><code>{window.location.pathname + window.location.search}</code></div>
        <div><b>router pathname</b><code>{location.pathname}</code></div>
        <div><b>router search</b><code>{location.search || "(empty)"}</code></div>
        <div><b>next location</b><code>{navigation.location?.pathname ?? "(none)"}</code></div>
      </section>
      <Outlet />
    </main>
  );
}

export function RunsRoute() {
  const data = useLoaderData() as RunsData;
  const fetcher = useFetcher<{ checkedAt: string; status: string }>();
  const revalidator = useRevalidator();

  return (
    <section className="route">
      <div className="routeHeader">
        <div>
          <h1>Runs</h1>
          <small>loader result: {data.observedAt}</small>
        </div>
        <ListPagination list={data} />
      </div>
      <div className="actions">
        <button onClick={() => revalidator.revalidate()}>Revalidate route</button>
        <fetcher.Form method="get" action="/resources/status">
          <button type="submit">Background refresh</button>
        </fetcher.Form>
        <code>revalidator: {revalidator.state}</code>
        <code>fetcher: {fetcher.state}</code>
        <code>result: {fetcher.data?.checkedAt ?? "(none)"}</code>
      </div>
      <ul>
        {data.runs.map((run) => (
          <li key={run.id}>
            <Link to={`/runs/${run.id}`}>{run.name}<code>{run.id}</code></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RunRoute() {
  const data = useLoaderData() as { id: string; loadedAt: string };
  return (
    <section className="route">
      <Link to="/runs">← Runs</Link>
      <h1>{data.id}</h1>
      <p>Static client loader completed at <code>{data.loadedAt}</code>.</p>
    </section>
  );
}
