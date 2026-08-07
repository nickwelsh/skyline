/*!
 * Trigger.dev Queue-list route composition at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Loader data crosses the external QueueTargetsPresentation seam; server and broker concerns stay external.
 */
import { useLoaderData, useNavigation } from "@remix-run/react";
import { PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { QueueTargetsPresenter, type QueueTargetsPresentation } from "~/components/queues/QueueTargetsPresenter";

export type QueueTargetsRouteData = QueueTargetsPresentation;

export default function Page() {
  const data = useLoaderData() as QueueTargetsPresentation;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar><PageTitle title="Queues" /></NavBar>
      <QueueTargetsPresenter data={data} loading={navigation.state !== "idle"} />
    </PageContainer>
  );
}
