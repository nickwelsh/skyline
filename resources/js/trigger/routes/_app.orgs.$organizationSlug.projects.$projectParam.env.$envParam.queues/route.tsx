/*!
 * Trigger.dev Queue-list route composition at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Loader data crosses the external QueueTargetsPresentation seam; server and broker concerns stay external.
 */
import { useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { QueueTargetsPresenter, type QueueTargetsPresentation } from "~/components/queues/QueueTargetsPresenter";

export type QueueTargetsRouteData = QueueTargetsPresentation;

export default function Page() {
  const data = useLoaderData() as QueueTargetsPresentation;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar><PageTitle title={<><QueuesIcon className="size-4 text-queues" />Queues</>} /></NavBar>
      <QueueTargetsPresenter data={data} loading={navigation.state !== "idle"} />
    </PageContainer>
  );
}

export function QueuesErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Queue targets could not be loaded.";
  return (
    <PageContainer>
      <NavBar><PageTitle title="Queues" /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">Unable to load Queues</h1>
          <p className="mt-1 text-sm text-text-dimmed">{message}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
