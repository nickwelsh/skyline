/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: server loader and dashboard-agent concerns omitted.
 */
import { Outlet } from "@remix-run/react";
import { RouteErrorDisplay } from "~/components/ErrorDisplay";

export default function Page() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return <RouteErrorDisplay />;
}
