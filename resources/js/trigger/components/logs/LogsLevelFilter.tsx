/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogsLevelFilter.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server types and shared-filter imports use package-local client seams;
 * displayed values are conditioned to the server-provided level allowlist.
 */
import * as Ariakit from "@ariakit/react";
import { IconListTree } from "@tabler/icons-react";
import { type ReactNode } from "react";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";
import {
  SelectItem,
  SelectList,
  SelectPopover,
  SelectProvider,
  SelectTrigger,
  shortcutFromIndex,
} from "~/components/primitives/Select";
import { useSearchParams } from "~/hooks/useSearchParam";
import { appliedSummary } from "~/components/runs/v3/TimeFilter";
import type { LogLevelValue as LogLevel } from "~/components/logs/LogLevel";
import { cn } from "~/utils/cn";

const allLogLevels: { level: LogLevel; label: string; color: string }[] = [
  { level: "TRACE", label: "Trace", color: "text-purple-400" },
  { level: "INFO", label: "Info", color: "text-blue-400" },
  { level: "WARN", label: "Warning", color: "text-warning" },
  { level: "ERROR", label: "Error", color: "text-error" },
  { level: "DEBUG", label: "Debug", color: "text-text-dimmed" },
];

// In the future we might add other levels or change which are available
function getAvailableLevels(allowedLevels?: readonly LogLevel[]): typeof allLogLevels {
  return allowedLevels ? allLogLevels.filter(({ level }) => allowedLevels.includes(level)) : allLogLevels;
}

function getLevelBadgeColor(level: LogLevel): string {
  switch (level) {
    case "ERROR":
      return "text-error bg-error/10 border-error/20";
    case "WARN":
      return "text-warning bg-warning/10 border-warning/20";
    case "TRACE":
      return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    case "DEBUG":
      return "text-text-dimmed bg-background-raised border-border-bright";
    case "INFO":
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    default:
      return "text-text-dimmed bg-background-hover border-grid-bright";
  }
}

const shortcut = { key: "l" };

export function LogsLevelFilter({ availableLevels }: { availableLevels?: readonly LogLevel[] } = {}) {
  const { values } = useSearchParams();
  const allowedLevels = getAvailableLevels(availableLevels).map(({ level }) => level);
  const selectedLevels = values("levels").filter((level): level is LogLevel => allowedLevels.includes(level as LogLevel));
  const hasLevels = selectedLevels.length > 0;

  if (hasLevels) {
    return <AppliedLevelFilter availableLevels={availableLevels} />;
  }

  return (
    <LevelDropdown
      availableLevels={availableLevels}
      trigger={
        <SelectTrigger
          aria-label="Level"
          icon={<IconListTree className="size-4" />}
          variant="secondary/small"
          shortcut={shortcut}
          tooltipTitle="Filter by level"
          className="pl-1.5"
        >
          <span className="ml-1">Level</span>
        </SelectTrigger>
      }
    />
  );
}

function LevelDropdown({ trigger, availableLevels: allowedLevels }: { trigger: ReactNode; availableLevels?: readonly LogLevel[] }) {
  const { values, replace } = useSearchParams();

  const handleChange = (values: string[]) => {
    replace({ levels: values, cursor: undefined, direction: undefined });
  };

  const availableLevels = getAvailableLevels(allowedLevels);

  return (
    <SelectProvider value={values("levels")} setValue={handleChange} virtualFocus={true}>
      {trigger}
      <SelectPopover className="min-w-0 max-w-[min(240px,var(--popover-available-width))]">
        <SelectList>
          {availableLevels.map((item, index) => (
            <SelectItem
              key={item.level}
              value={item.level}
              shortcut={shortcutFromIndex(index, { shortcutsEnabled: true })}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium uppercase",
                  getLevelBadgeColor(item.level)
                )}
              >
                {item.level}
              </span>
            </SelectItem>
          ))}
        </SelectList>
      </SelectPopover>
    </SelectProvider>
  );
}

function AppliedLevelFilter({ availableLevels }: { availableLevels?: readonly LogLevel[] }) {
  const { values, del } = useSearchParams();
  const allowedLevels = getAvailableLevels(availableLevels).map(({ level }) => level);
  const levels = values("levels").filter((level): level is LogLevel => allowedLevels.includes(level as LogLevel));

  if (levels.length === 0) {
    return null;
  }

  return (
    <LevelDropdown
      availableLevels={availableLevels}
      trigger={
        <Ariakit.Select aria-label="Level" render={<div className="group cursor-pointer focus-custom" />}>
          <AppliedFilter
            label="Level"
            icon={<IconListTree className="size-4" />}
            value={appliedSummary(levels)}
            onRemove={() => del(["levels", "cursor", "direction"])}
            variant="secondary/small"
          />
        </Ariakit.Select>
      }
    />
  );
}
