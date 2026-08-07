/*!
 * Adapted from Trigger.dev apps/webapp/app/components/ErrorDisplay.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: permission-owned UI omitted; the host exposes read-only route failures.
 */
import { HomeIcon } from "@heroicons/react/20/solid";
import { isRouteErrorResponse, useRouteError } from "@remix-run/react";
import { type ReactNode } from "react";
import { friendlyErrorDisplay } from "~/utils/httpErrors";
import { LinkButton } from "./primitives/Buttons";
import { Header1 } from "./primitives/Headers";
import { Paragraph } from "./primitives/Paragraph";
import { TriggerRotatingLogo } from "./TriggerRotatingLogo";

type ErrorDisplayOptions = { button?: { title: string; to: string } };

export function RouteErrorDisplay(options?: ErrorDisplayOptions) {
  const error = useRouteError();
  return isRouteErrorResponse(error) ? (
    <ErrorDisplay
      title={friendlyErrorDisplay(error.status, error.statusText).title}
      message={error.data?.message ?? friendlyErrorDisplay(error.status, error.statusText).message}
      {...options}
    />
  ) : error instanceof Error ? (
    <ErrorDisplay title={error.name} message={error.message} {...options} />
  ) : (
    <ErrorDisplay title="Oops" message={JSON.stringify(error)} {...options} />
  );
}

type DisplayOptionsProps = { title: string; message?: ReactNode } & ErrorDisplayOptions;

export function ErrorDisplay({ title, message, button }: DisplayOptionsProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-[#16181C]">
      <div className="z-10 mt-[30vh] flex shrink-0 flex-col items-center gap-8">
        <Header1 className="light:text-charcoal-200">{title}</Header1>
        {message && <Paragraph className="light:text-charcoal-400">{message}</Paragraph>}
        <LinkButton to={button ? button.to : "/"} shortcut={{ key: "enter" }} variant="primary/medium" LeadingIcon={HomeIcon}>
          {button ? button.title : "Go to homepage"}
        </LinkButton>
      </div>
      <TriggerRotatingLogo />
    </div>
  );
}
