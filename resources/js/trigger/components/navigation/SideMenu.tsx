/*!
 * Derived from Trigger.dev apps/webapp/app/components/navigation/SideMenu.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Unsupported tenant, account, execution, and future navigation branches remain omitted.
 */
import { PlayIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import { Link, useLocation } from "@remix-run/react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";
import { cn } from "~/utils/cn";

type SideMenuProps = {
  applicationName: string;
  brandMark: React.ReactNode;
  environmentLabel: string;
  runsPath: string;
};

export function SideMenu({ applicationName, brandMark, environmentLabel, runsPath }: SideMenuProps) {
  const location = useLocation();
  const [width, setWidth] = useState(224);
  const widthRef = useRef(width);
  const collapsed = width <= 44;
  const labelOpacity = collapsed ? 0 : 1;
  const settle = useCallback((value: number) => {
    widthRef.current = value;
    setWidth(value);
  }, []);

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    let dragged = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (Math.abs(delta) < 4 && !dragged) return;
      dragged = true;
      settle(Math.min(400, Math.max(44, startWidth + delta)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!dragged) settle(collapsed ? 224 : 44);
      else if (widthRef.current < 134) settle(44);
      else if (widthRef.current < 224) settle(224);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside
      data-testid="side-menu"
      className="relative flex min-w-0 flex-col border-r border-grid-bright bg-background-bright"
      style={{ width, "--sm-label-opacity": labelOpacity } as CSSProperties}
    >
      <div className="flex h-11 items-center gap-2 border-b border-grid-bright px-3">
        {brandMark}
        <span className="min-w-0 truncate font-semibold text-text-bright" style={{ opacity: labelOpacity }}>{applicationName}</span>
      </div>
      <div className="px-2 py-3">
        <div className="mb-1 truncate px-1 text-xs text-text-faint" style={{ opacity: labelOpacity }}>Application environment</div>
        <div className="flex h-8 items-center gap-2 rounded px-1 text-prod">
          <Squares2X2Icon className="size-5 shrink-0" />
          <span className="truncate font-medium capitalize" style={{ opacity: labelOpacity }}>{environmentLabel}</span>
        </div>
      </div>
      <nav aria-label="Application" className="px-2">
        <Link
          to={runsPath}
          className={cn(
            "flex h-8 items-center gap-2 rounded px-1",
            location.pathname === runsPath ? "bg-background-raised text-text-bright" : "hover:bg-background-hover"
          )}
        >
          <PlayIcon className="size-5 shrink-0 text-runs" />
          <span className="truncate" style={{ opacity: labelOpacity }}>Runs</span>
        </Link>
      </nav>
      <div
        data-testid="side-menu-resizer"
        className="group absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none"
        onPointerDown={resize}
      >
        <div className="absolute inset-y-0 left-[3px] w-px bg-grid-bright group-hover:bg-indigo-500" />
      </div>
    </aside>
  );
}
