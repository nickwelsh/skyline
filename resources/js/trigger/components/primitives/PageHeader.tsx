/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/PageHeader.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: reached navigation loading, title, favorite geometry, React Router back link, and protected title marker.
 */
import { Link, useLocation, useNavigation } from "@remix-run/react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useHref } from "react-router-dom";
import { type ReactNode } from "react";
import { JobFavoriteButton } from "~/components/navigation/JobFavorites";
import { BreadcrumbIcon } from "./BreadcrumbIcon";
import { Header2 } from "./Headers";
import { LoadingBarDivider } from "./LoadingBarDivider";
import { SimpleTooltip } from "./Tooltip";

type WithChildren = {
  children: React.ReactNode;
};

export function NavBar({ children }: WithChildren) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" || navigation.state === "submitting";

  return (
    <div>
      <div className="grid h-10 w-full grid-rows-[auto_1px] bg-background-bright">
        <div className="flex w-full items-center gap-2 pl-3 pr-2">
          <div className="flex flex-1 items-center justify-between">{children}</div>
        </div>
        <LoadingBarDivider isLoading={isLoading} />
      </div>
    </div>
  );
}

type PageTitleProps = {
  title: ReactNode;
  accessory?: ReactNode;
  favoriteLabel?: string;
  protectedMarker?: string;
  backButton?: {
    to: string;
    text: string;
  };
};

export function PageTitle({ title, backButton, accessory, favoriteLabel, protectedMarker }: PageTitleProps) {
  const titleText = typeof title === "string" ? title : undefined;
  const resolvedFavoriteLabel = favoriteLabel ?? titleText;
  const rootHref = useHref("/");
  const location = useLocation();
  const basename = rootHref === "/" ? "" : rootHref.replace(/\/$/, "");
  const favoritePath = location.pathname.startsWith(basename)
    ? location.pathname.slice(basename.length) || "/"
    : location.pathname;

  return (
    <div data-skyline-protected={protectedMarker} className="flex items-center gap-1.5">
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
      {accessory !== undefined ? <span className="ml-px flex items-center">{typeof accessory === "string" ? (
        <SimpleTooltip
          button={<QuestionMarkCircleIcon className="size-4 text-text-dimmed" />}
          content={accessory}
          className="max-w-xs"
          disableHoverableContent
        />
      ) : accessory}</span> : null}
      {resolvedFavoriteLabel ? <JobFavoriteButton id={`page:${favoritePath}`} label={resolvedFavoriteLabel} path={favoritePath} className="-ml-1" /> : null}
    </div>
  );
}

export function PageAccessories({ children }: WithChildren) {
  return <div className="flex items-center gap-2">{children}</div>;
}
