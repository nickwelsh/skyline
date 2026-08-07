/*!
 * Trigger.dev Queue-detail route composition at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Loader data crosses the external QueueTargetDetailPresentation seam; administration stays absent.
 */
import { useLoaderData, useNavigation } from "@remix-run/react";
import { PageContainer } from "~/components/layout/AppLayout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { QueueTargetDetailPresenter, type QueueTargetDetailPresentation } from "~/components/queues/QueueTargetDetailPresenter";

export type QueueTargetDetailRouteData = QueueTargetDetailPresentation;

export default function Page() {
  const data = useLoaderData() as QueueTargetDetailPresentation;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar><PageTitle title={data.queueTarget.queue} backButton={{ to: "/queues", text: "Queues" }} /></NavBar>
      <QueueTargetDetailPresenter data={data} loading={navigation.state !== "idle"} />
    </PageContainer>
  );
}
