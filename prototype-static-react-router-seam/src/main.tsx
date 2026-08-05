import React from "react";
import ReactDOM from "react-dom/client";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  type LoaderFunctionArgs,
} from "react-router-dom";
import { PrototypeShell, RunRoute, RunsRoute } from "./routes";
import "./styles.css";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function runsLoader({ request }: LoaderFunctionArgs) {
  await wait(450);
  const url = new URL(request.url);
  const cursor = Number(url.searchParams.get("cursor") ?? "0");
  const start = Number.isFinite(cursor) ? cursor : 0;
  return {
    observedAt: new Date().toISOString(),
    runs: Array.from({ length: 3 }, (_, index) => ({
      id: `run-${start + index + 1}`,
      name: ["GenerateInvoices", "SendDigest", "ImportOrders"][(start + index) % 3],
    })),
    pagination: {
      previous: start > 0 ? String(Math.max(0, start - 3)) : undefined,
      next: start < 6 ? String(start + 3) : undefined,
    },
  };
}

async function runLoader({ params }: LoaderFunctionArgs) {
  await wait(450);
  return { id: params.runId, loadedAt: new Date().toISOString() };
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <PrototypeShell />,
      children: [
        { index: true, element: <Navigate to="runs" replace /> },
        { path: "runs", loader: runsLoader, element: <RunsRoute /> },
        { path: "runs/:runId", loader: runLoader, element: <RunRoute /> },
        {
          path: "resources/status",
          loader: async () => {
            await wait(450);
            return { checkedAt: new Date().toISOString(), status: "ok" };
          },
        },
      ],
    },
  ],
  { basename: "/skyline" },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
