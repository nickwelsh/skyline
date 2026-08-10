/*!
 * Adapted from Trigger.dev apps/webapp/app/components/BlankStatePanels.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Deployment actions and documentation links remain capability-hidden.
 */
import { ProdEnvironmentIconSmall } from "~/assets/icons/EnvironmentIcons";
import { Header1, Header2 } from "~/components/primitives/Headers";
import { Paragraph } from "~/components/primitives/Paragraph";
import { Spinner } from "~/components/primitives/Spinner";

export function HasNoTasksDeployed({ environmentLabel }: { environmentLabel: string }) {
  return <DeploymentOnboardingSteps environmentLabel={environmentLabel} />;
}

function DeploymentOnboardingSteps({ environmentLabel }: { environmentLabel: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <ProdEnvironmentIconSmall className="-ml-1 size-8 shrink-0 text-prod" />
          <Header1 className="truncate">Deploy your tasks to {environmentLabel}</Header1>
        </div>
      </div>

      {/* GitHub, manual, and GitHub Actions controls are unsupported by the host. */}
      <div className="mr-3">
        <div className="flex items-center gap-x-3">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-grid-bright bg-background-bright py-1 text-xs font-semibold text-text-dimmed">2</span>
          <div className="flex items-center gap-x-2">
            <Header2>Waiting for tasks to deploy</Header2>
            <Spinner />
          </div>
        </div>
      </div>
      <div className="mb-6 ml-9 mt-1">
        <Paragraph>This page will automatically refresh when your tasks are deployed.</Paragraph>
      </div>
    </div>
  );
}
