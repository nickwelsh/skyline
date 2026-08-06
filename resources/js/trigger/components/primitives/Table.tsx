import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { Link } from "@remix-run/react";
import React, { type ReactNode, createContext, forwardRef, useContext } from "react";
import { cn } from "~/utils/cn";
import { InfoIconTooltip } from "./Tooltip";

/*!
 * Trigger.dev Table presenter at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Unreached copy, chevron, and popover-menu branches are omitted.
 */

const variants = {
  bright: {
    header: "bg-background-bright",
    headerCell: "px-3 py-2.5 pb-3 text-sm",
    cell: "group-hover/table-row:bg-background-hover group-has-[[tabindex='0']:focus]/table-row:bg-background-hover",
    cellSize: "px-3 py-3",
    cellText: "text-xs group-hover/table-row:text-text-bright",
    stickyCell: "bg-background-bright group-hover/table-row:bg-background-hover",
    menuButton:
      "bg-background-bright group-hover/table-row:bg-background-hover group-hover/table-row:ring-border-bright/70 group-has-[[tabindex='0']:focus]/table-row:bg-background-hover",
    menuButtonDivider: "group-hover/table-row:border-border-bright/70",
    rowSelected: "bg-background-hover group-hover/table-row:bg-background-hover",
  },
  "bright/no-hover": {
    header: "bg-transparent",
    headerCell: "px-3 py-2.5 pb-3 text-sm",
    cell: "group-hover/table-row:bg-transparent",
    cellSize: "px-3 py-3",
    cellText: "text-xs",
    stickyCell: "bg-background-bright",
    menuButton: "bg-background-bright",
    menuButtonDivider: "",
    rowSelected: "bg-background-hover",
  },
  dimmed: {
    header: "bg-background-dimmed",
    headerCell: "px-3 py-2.5 pb-3 text-sm",
    cell: "group-hover/table-row:bg-background-bright group-has-[[tabindex='0']:focus]/table-row:bg-background-bright",
    cellSize: "px-3 py-3",
    cellText: "text-xs group-hover/table-row:text-text-bright",
    stickyCell: "group-hover/table-row:bg-background-bright",
    menuButton:
      "bg-background-dimmed group-hover/table-row:bg-background-bright group-hover/table-row:ring-grid-bright group-has-[[tabindex='0']:focus]/table-row:bg-background-bright",
    menuButtonDivider: "group-hover/table-row:border-grid-bright",
    rowSelected: "bg-background-hover group-hover/table-row:bg-background-hover",
  },
  "compact/mono": {
    header: "bg-background-dimmed",
    headerCell: "px-2 py-1.5 text-sm",
    cell: "group-hover/table-row:bg-background-bright group-has-[[tabindex='0']:focus]/table-row:bg-background-bright",
    cellSize: "px-2 py-1.5",
    cellText: "text-xs font-mono group-hover/table-row:text-text-bright",
    stickyCell: "group-hover/table-row:bg-background-bright",
    menuButton:
      "bg-background-dimmed group-hover/table-row:bg-background-bright group-hover/table-row:ring-grid-bright group-has-[[tabindex='0']:focus]/table-row:bg-background-bright",
    menuButtonDivider: "group-hover/table-row:border-grid-bright",
    rowSelected: "bg-background-hover group-hover/table-row:bg-background-hover",
  },
} as const;

export type TableVariant = keyof typeof variants;

type TableProps = {
  containerClassName?: string;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
  showTopBorder?: boolean;
  stickyHeader?: boolean;
};

// Add TableContext
const TableContext = createContext<{ variant: TableVariant }>({ variant: "dimmed" });

export const Table = forwardRef<HTMLTableElement, TableProps & { variant?: TableVariant }>(
  (
    {
      className,
      containerClassName,
      children,
      fullWidth,
      variant = "dimmed",
      showTopBorder = true,
      stickyHeader = false,
    },
    ref
  ) => {
    return (
      <TableContext.Provider value={{ variant }}>
        <div
          className={cn(
            "whitespace-nowrap scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control",
            stickyHeader ? "overflow-visible" : "overflow-x-auto",
            showTopBorder && "border-t",
            containerClassName,
            fullWidth && "w-full"
          )}
        >
          <table ref={ref} className={cn("w-full", className)}>
            {children}
          </table>
        </div>
      </TableContext.Provider>
    );
  }
);

type TableHeaderProps = {
  className?: string;
  children: ReactNode;
};

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, children }, ref) => {
    const { variant } = useContext(TableContext);
    return (
      <thead
        ref={ref}
        className={cn(
          "safari-only sticky top-0 z-10 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-grid-bright supports-[(-webkit-hyphens:none)]:after:content-none",
          variants[variant].header,
          className
        )}
      >
        {children}
      </thead>
    );
  }
);

type TableBodyProps = {
  className?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
};

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, children, style }, ref) => {
    return (
      <tbody ref={ref} className={cn("relative overflow-y-auto", className)} style={style}>
        {children}
      </tbody>
    );
  }
);

type TableRowProps = JSX.IntrinsicElements["tr"] & {
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  isSelected?: boolean;
};

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, disabled, isSelected, children, ...props }, ref) => {
    const { variant } = useContext(TableContext);
    return (
      <tr
        ref={ref}
        {...props}
        className={cn(
          "group/table-row relative w-full outline-hidden after:absolute after:bottom-0 after:left-3 after:right-0 after:h-px after:bg-grid-dimmed",
          isSelected && variants[variant].rowSelected,
          disabled && "opacity-50",
          className
        )}
      >
        {children}
      </tr>
    );
  }
);

type TableBlankRowProps = {
  className?: string;
  colSpan: number;
  children?: ReactNode;
};

export const TableBlankRow = forwardRef<HTMLTableRowElement, TableBlankRowProps>(
  ({ children, colSpan, className }, ref) => (
    <tr ref={ref}>
      <td colSpan={colSpan} className={cn("py-6 text-center text-sm", className)}>{children}</td>
    </tr>
  )
);

type TableCellBasicProps = {
  className?: string;
  alignment?: "left" | "center" | "right";
  children?: ReactNode;
  colSpan?: number;
};

type TableHeaderCellProps = TableCellBasicProps & {
  hiddenLabel?: boolean;
  tooltip?: ReactNode;
  /** Extra class merged onto the tooltip content. */
  tooltipContentClassName?: string;
  disableTooltipHoverableContent?: boolean;
  /**
   * When set (together with `onSort`), the header renders a sort indicator and becomes clickable.
   * `"asc"`/`"desc"` show the active direction; `null` shows the neutral (unsorted) affordance.
   * This cell is presentational and fully controlled — the parent owns the sort state (see
   * `useTableSort`).
   */
  sortDirection?: "asc" | "desc" | null;
  /** Invoked when the header is clicked or activated via keyboard. Enables sorting when provided. */
  onSort?: () => void;
};

export const TableHeaderCell = forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  (
    {
      className,
      alignment = "left",
      children,
      colSpan,
      hiddenLabel = false,
      tooltip,
      tooltipContentClassName,
      disableTooltipHoverableContent = false,
      sortDirection,
      onSort,
    },
    ref
  ) => {
    const { variant } = useContext(TableContext);
    let alignmentClassName = "text-left";
    switch (alignment) {
      case "center":
        alignmentClassName = "text-center";
        break;
      case "right":
        alignmentClassName = "text-right";
        break;
    }

    const sortable = typeof onSort === "function";

    const label = hiddenLabel ? <span className="sr-only">{children}</span> : children;

    const tooltipNode = tooltip ? (
      <InfoIconTooltip
        content={tooltip}
        contentClassName={cn("normal-case tracking-normal", tooltipContentClassName)}
        disableHoverableContent={disableTooltipHoverableContent}
      />
    ) : null;

    const sortIndicator = sortable ? (
      <span className="ml-1 flex items-center">
        {sortDirection === "asc" ? (
          <ChevronUpIcon className="size-4 text-text-bright" />
        ) : sortDirection === "desc" ? (
          <ChevronDownIcon className="size-4 text-text-bright" />
        ) : (
          <ChevronUpDownIcon className="size-4 text-text-dimmed transition-colors group-hover/sort:text-text-bright" />
        )}
      </span>
    ) : null;

    const rowClassName = cn("flex items-center gap-1", {
      "justify-center": alignment === "center",
      "justify-end": alignment === "right",
    });

    return (
      <th
        ref={ref}
        scope="col"
        aria-sort={
          sortable
            ? sortDirection === "asc"
              ? "ascending"
              : sortDirection === "desc"
                ? "descending"
                : "none"
            : undefined
        }
        className={cn(
          "align-middle font-medium text-text-bright",
          variants[variant].headerCell,
          alignmentClassName,
          className
        )}
        colSpan={colSpan}
        tabIndex={-1}
      >
        {sortable ? (
          // Only the sort arrows toggle sorting — the label (and info tooltip) are not clickable, so
          // clicking the header text does nothing. Order is always title → info icon → sort arrows.
          <div className={rowClassName}>
            {label}
            {tooltip ? tooltipNode : null}
            <button
              type="button"
              onClick={onSort}
              aria-label="Toggle sort"
              className="group/sort flex cursor-pointer select-none items-center rounded-sm focus-custom"
            >
              {sortIndicator}
            </button>
          </div>
        ) : tooltip ? (
          <div className={rowClassName}>
            {label}
            {tooltipNode}
          </div>
        ) : (
          label
        )}
      </th>
    );
  }
);

type TableCellProps = TableCellBasicProps & {
  to?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  hasAction?: boolean;
  isSticky?: boolean;
  actionClassName?: string;
  rowHoverStyle?: string;
  isSelected?: boolean;
  isTabbableCell?: boolean;
  children?: ReactNode;
  /**
   * Content rendered beside the cell's link/button but OUTSIDE it, so interactive adornments
   * (tooltip triggers, badges that are themselves buttons) don't nest inside the `<a>`/`<button>`
   * — invalid DOM that fails a11y audits. Use for a `to`/`onClick` cell that also shows a tooltip.
   * `leadingContent` renders before the link, `trailingContent` after.
   */
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
  style?: React.CSSProperties;
};

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  (
    {
      className,
      actionClassName,
      alignment = "left",
      children,
      colSpan,
      to,
      onClick,
      hasAction = false,
      isSticky = false,
      isSelected,
      isTabbableCell = false,
      leadingContent,
      trailingContent,
      style,
    },
    ref
  ) => {
    let alignmentClassName = "text-left";
    switch (alignment) {
      case "center":
        alignmentClassName = "text-center";
        break;
      case "right":
        alignmentClassName = "text-right";
        break;
    }

    const { variant } = useContext(TableContext);
    const flexClasses = cn(
      "flex w-full whitespace-nowrap items-center text-text-dimmed",
      variants[variant].cellSize,
      variants[variant].cellText,
      alignment === "left"
        ? "justify-start text-left"
        : alignment === "center"
          ? "justify-center text-center"
          : "justify-end text-right"
    );

    return (
      <td
        ref={ref}
        className={cn(
          "safari-only text-xs text-text-dimmed has-[[tabindex='0']:focus]:before:absolute has-[[tabindex='0']:focus]:before:-top-px has-[[tabindex='0']:focus]:before:left-0 has-[[tabindex='0']:focus]:before:h-px has-[[tabindex='0']:focus]:before:w-3 has-[[tabindex='0']:focus]:before:bg-grid-dimmed has-[[tabindex='0']:focus]:after:absolute has-[[tabindex='0']:focus]:after:bottom-0 has-[[tabindex='0']:focus]:after:left-0 has-[[tabindex='0']:focus]:after:right-0 has-[[tabindex='0']:focus]:after:h-px has-[[tabindex='0']:focus]:after:bg-grid-dimmed",
          variants[variant].cellText,
          variants[variant].cell,
          to || onClick || hasAction
            ? "cursor-pointer"
            : cn("cursor-default align-middle", variants[variant].cellSize),
          !to && !onClick && alignmentClassName,
          isSticky && "[&:has([data-hidden-buttons])]:w-auto sticky right-0 bg-background-dimmed",
          isSticky && variants[variant].stickyCell,
          isSelected && variants[variant].rowSelected,
          !isSelected &&
            "group-hover/table-row:before:absolute group-hover/table-row:before:left-0 group-hover/table-row:before:-top-px group-hover/table-row:before:h-px group-hover/table-row:before:w-3 group-hover/table-row:before:bg-background-hover group-hover/table-row:after:absolute group-hover/table-row:after:bottom-0 group-hover/table-row:after:left-0 group-hover/table-row:after:h-px group-hover/table-row:after:w-3 group-hover/table-row:after:bg-background-hover group-focus-visible/table-row:bg-background-bright",
          className
        )}
        colSpan={colSpan}
        style={style}
      >
        {to ? (
          // With leading/trailing content, the link is content-sized and the adornments sit beside
          // it (still inside the td) so interactive triggers never nest inside the <a>.
          leadingContent || trailingContent ? (
            // Stretched link: the <a> covers the whole cell via an inset ::before overlay, so the
            // entire cell is clickable — not just the text. The interactive adornments (tooltip
            // icons, badge buttons) sit above the overlay (relative z-10) and stay clickable, and
            // never nest inside the <a>.
            <div className={cn(flexClasses, "relative gap-2")}>
              {leadingContent ? (
                <span className="relative z-10 flex items-center">{leadingContent}</span>
              ) : null}
              <Link
                to={to}
                className={cn(
                  "inline-flex items-center gap-2 before:absolute before:inset-0 before:content-[''] focus:outline-hidden",
                  actionClassName
                )}
                tabIndex={isTabbableCell ? 0 : -1}
              >
                {children}
              </Link>
              {trailingContent ? (
                <span className="relative z-10 flex items-center">{trailingContent}</span>
              ) : null}
            </div>
          ) : (
            <Link
              to={to}
              className={cn("cursor-pointer focus:outline-hidden", flexClasses, actionClassName)}
              tabIndex={isTabbableCell ? 0 : -1}
            >
              {children}
            </Link>
          )
        ) : onClick ? (
          leadingContent || trailingContent ? (
            <div className={cn(flexClasses, "gap-2")}>
              {leadingContent}
              <button
                onClick={onClick}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 focus:outline-hidden",
                  actionClassName
                )}
                tabIndex={isTabbableCell ? 0 : -1}
              >
                {children}
              </button>
              {trailingContent}
            </div>
          ) : (
            <button
              onClick={onClick}
              className={cn("cursor-pointer focus:outline-hidden", flexClasses, actionClassName)}
              tabIndex={isTabbableCell ? 0 : -1}
            >
              {children}
            </button>
          )
        ) : leadingContent || trailingContent ? (
          <div className={cn(flexClasses, "gap-2")}>
            {leadingContent}
            {children}
            {trailingContent}
          </div>
        ) : (
          <>{children}</>
        )}
      </td>
    );
  }
);

export const TableCellMenu = forwardRef<
  HTMLTableCellElement,
  Pick<TableCellProps, "className"> & { hiddenButtons: ReactNode }
>(({ className, hiddenButtons }, ref) => {
  const { variant } = useContext(TableContext);

  return (
    <TableCell className={className} ref={ref} alignment="right" hasAction>
      <div className="relative h-full p-1">
        <div className={cn("absolute right-0 top-1/2 mr-1 flex -translate-y-1/2 items-center justify-end gap-0.5 rounded-[0.25rem] p-0.5 group-hover/table-row:ring-1", variants[variant].menuButton)}>
          <div data-hidden-buttons className="hidden group-hover/table-row:block">
            <div className="flex items-center gap-x-0.5 divide-x divide-grid-bright">{hiddenButtons}</div>
          </div>
        </div>
      </div>
    </TableCell>
  );
});
