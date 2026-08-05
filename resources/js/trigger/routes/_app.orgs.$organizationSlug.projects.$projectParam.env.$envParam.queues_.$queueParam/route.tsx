/*!
 * Trigger.dev Queue-detail route composition at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Loader data crosses the external QueueTargetDetailPresentation seam; administration stays absent.
 */
import { useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { QueueTargetDetailPresenter, type QueueTargetDetailPresentation } from "~/components/queues/QueueTargetDetailPresenter";

export type QueueTargetDetailRouteData = QueueTargetDetailPresentation;

export default function Page() {
  const data = useLoaderData() as QueueTargetDetailPresentation;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar><PageTitle title={data.queueTarget.queue} backButton={{ to: "/queues", text: "Queues" }} /></NavBar>
      <div className="flex items-center gap-2 border-b border-grid-bright bg-background-bright px-3 py-2">
        <span className="font-mono text-xs text-text-dimmed">{data.queueTarget.destination}</span>
        <Badge variant="small" className={data.queueTarget.state === "Busy" ? "text-pending" : "text-text-dimmed"}>{data.queueTarget.state}</Badge>
        <span className="ml-auto text-xs text-text-dimmed">Recorded Runs, not broker depth</span>
      </div>
      <QueueTargetDetailPresenter data={data} loading={navigation.state !== "idle"} />
    </PageContainer>
  );
}

export function QueueDetailErrorBoundary() {
  const error = useRouteError();
  const notFound = (error instanceof Response || (typeof error === "object" && error !== null && "status" in error))
    && error.status === 404;
  return (
    <PageContainer>
      <NavBar><PageTitle title="Queue target" backButton={{ to: "/queues", text: "Queues" }} /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">{notFound ? "Queue target not found" : "Unable to load Queue target"}</h1>
          <p className="mt-1 text-sm text-text-dimmed">{notFound ? "This observed Queue target is unavailable." : "Queue-target evidence could not be loaded."}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
