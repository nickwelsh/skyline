import { Link } from "@remix-run/react";
import type { ComponentType, MouseEventHandler, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function LinkButton({
  to,
  LeadingIcon,
  TrailingIcon,
  className,
  onClick,
  disabled,
  tooltip,
}: {
  to: string;
  variant: string;
  LeadingIcon?: Icon;
  TrailingIcon?: Icon;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  shortcut?: { key: string };
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-disabled={disabled}
      aria-label={tooltip}
      className={className}
      title={tooltip}
    >
      {LeadingIcon && <LeadingIcon width={16} />}
      {TrailingIcon && <TrailingIcon width={16} />}
    </Link>
  );
}
