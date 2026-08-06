/*!
 * Derived from Trigger.dev apps/webapp/app/root.tsx and components/layout/AppLayout.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Remix document/server providers are replaced by static-router inputs.
 */
import { Outlet } from "@remix-run/react";
import { AppContainer } from "~/components/layout/AppLayout";
import { SideMenu } from "~/components/navigation/SideMenu";

type TriggerShellProps = {
  applicationName: string;
  brandMark: React.ReactNode;
  environmentLabel: string;
  capabilities: Record<string, boolean>;
};

export function TriggerShell({ applicationName, brandMark, environmentLabel, capabilities }: TriggerShellProps) {
  return (
    <AppContainer className="isolate h-screen min-w-[1024px] bg-background-dimmed text-[0.8125rem] text-text-dimmed antialiased">
      <div className="grid h-full min-w-0 grid-cols-[auto_1fr] overflow-hidden">
        <SideMenu applicationName={applicationName} brandMark={brandMark} environmentLabel={environmentLabel} capabilities={capabilities} jobsPath="/jobs" runsPath="/runs" queuesPath="/queues" errorsPath="/errors" />
        <main className="min-w-0 overflow-hidden"><Outlet /></main>
      </div>
    </AppContainer>
  );
}
