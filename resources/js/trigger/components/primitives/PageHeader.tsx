/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/PageHeader.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: run-route geometry only; Remix back link.
 */
import { Link } from "@remix-run/react";
import { type ReactNode } from "react";
import { BreadcrumbIcon } from "./BreadcrumbIcon";
import { Header2 } from "./Headers";

type WithChildren = {
  children: React.ReactNode;
};

export function NavBar({ children }: WithChildren) {
  return (
    <div>
      <div className="grid h-10 w-full grid-rows-[auto_1px] bg-background-bright">
        <div className="flex w-full items-center gap-2 pl-3 pr-2">
          <div className="flex flex-1 items-center justify-between">{children}</div>
        </div>
        <div className="relative h-px w-full overflow-hidden bg-grid-bright" />
      </div>
    </div>
  );
}

type PageTitleProps = {
  title: ReactNode;
  backButton?: {
    to: string;
    text: string;
  };
};

export function PageTitle({ title, backButton }: PageTitleProps) {
  return (
    <div className="flex items-center gap-1.5">
      {backButton && (
        <div className="group -ml-1.5 flex items-center gap-0">
          <Link
            to={backButton.to}
            className="rounded px-1.5 py-1 text-xs text-text-dimmed transition focus-custom group-hover:bg-background-raised group-hover:text-text-bright"
          >
            {backButton.text}
          </Link>
          <BreadcrumbIcon className="h-5" />
        </div>
      )}
      <Header2 className="flex items-center gap-1">{title}</Header2>
    </div>
  );
}

export function PageAccessories({ children }: WithChildren) {
  return <div className="flex items-center gap-2">{children}</div>;
}
