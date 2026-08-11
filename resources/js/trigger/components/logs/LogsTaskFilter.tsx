/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogsTaskFilter.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server types and shared-filter imports use package-local client seams;
 * selection is singular to match Skyline's server-backed Job type contract.
 */
import type { ReactNode } from "react";
import { useMemo } from "react";
import * as Ariakit from "@ariakit/react";
import {
  ComboBox,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectList,
  SelectPopover,
  SelectProvider,
  SelectTrigger,
} from "~/components/primitives/Select";
import { useSearchParams } from "~/hooks/useSearchParam";
import { TaskIconSmall } from "~/assets/icons/TaskIcon";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { appliedSummary, FilterMenuProvider } from "~/components/runs/v3/TimeFilter";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";

const shortcut = { key: "t" };

type TaskTriggerSource = "STANDARD" | "SCHEDULED" | "AGENT";

type TaskOption = {
  slug: string;
  triggerSource: TaskTriggerSource;
  isInLatestDeployment: boolean;
};

interface LogsTaskFilterProps {
  possibleTasks: TaskOption[];
}

export function LogsTaskFilter({ possibleTasks }: LogsTaskFilterProps) {
  const { value, del } = useSearchParams();
  const selectedTask = value("tasks");

  if (!selectedTask) {
    return (
      <FilterMenuProvider>
        {(search, setSearch) => (
          <TasksDropdown
            trigger={
              <SelectTrigger
                aria-label="Tasks"
                icon={<TasksIcon className="size-4" />}
                variant="secondary/small"
                shortcut={shortcut}
                tooltipTitle="Filter by task"
                className="pl-1.5"
              >
                <span className="ml-1">Tasks</span>
              </SelectTrigger>
            }
            searchValue={search}
            clearSearchValue={() => setSearch("")}
            possibleTasks={possibleTasks}
          />
        )}
      </FilterMenuProvider>
    );
  }

  return (
    <FilterMenuProvider>
      {(search, setSearch) => (
        <TasksDropdown
          trigger={
            <Ariakit.Select aria-label="Tasks" render={<div className="group cursor-pointer focus-custom" />}>
              <AppliedFilter
                label="Task"
                icon={<TasksIcon className="size-4" />}
                value={appliedSummary([possibleTasks.find((task) => task.slug === selectedTask)?.slug ?? selectedTask])}
                onRemove={() => del(["tasks", "cursor", "direction"])}
                variant="secondary/small"
              />
            </Ariakit.Select>
          }
          searchValue={search}
          clearSearchValue={() => setSearch("")}
          possibleTasks={possibleTasks}
        />
      )}
    </FilterMenuProvider>
  );
}

function TasksDropdown({
  trigger,
  clearSearchValue,
  searchValue,
  onClose,
  possibleTasks,
}: {
  trigger: ReactNode;
  clearSearchValue: () => void;
  searchValue: string;
  onClose?: () => void;
  possibleTasks: TaskOption[];
}) {
  const { value, replace } = useSearchParams();

  const handleChange = (selected: string) => {
    clearSearchValue();
    replace({ tasks: selected || undefined, cursor: undefined, direction: undefined });
  };

  const filtered = useMemo(() => {
    return possibleTasks.filter((item) => {
      return item.slug.toLowerCase().includes(searchValue.toLowerCase());
    });
  }, [searchValue, possibleTasks]);

  return (
    <SelectProvider value={value("tasks") ?? ""} setValue={handleChange} virtualFocus={true}>
      {trigger}
      <SelectPopover
        className="min-w-0 max-w-[min(360px,var(--popover-available-width))]"
        hideOnEscape={() => {
          if (onClose) {
            onClose();
            return false;
          }

          return true;
        }}
      >
        <ComboBox placeholder={"Filter by task..."} value={searchValue} />
        <SelectList>
          {filtered
            .filter((item) => item.isInLatestDeployment)
            .map((item) => (
              <SelectItem
                key={`${item.triggerSource}-${item.slug}`}
                value={item.slug}
                className="text-text-bright"
                icon={
                  <TaskIconSmall className="size-4 flex-none" />
                }
              >
                {item.slug}
              </SelectItem>
            ))}
          {filtered.some((item) => !item.isInLatestDeployment) && (
            <SelectGroup>
              <SelectGroupLabel>Archived</SelectGroupLabel>
              {filtered
                .filter((item) => !item.isInLatestDeployment)
                .map((item) => (
                  <SelectItem
                    key={`${item.triggerSource}-${item.slug}`}
                    value={item.slug}
                    className="text-text-bright"
                    icon={
                      <span className="opacity-50">
                        <TaskIconSmall className="size-4 flex-none" />
                      </span>
                    }
                  >
                    {item.slug}
                  </SelectItem>
                ))}
            </SelectGroup>
          )}
        </SelectList>
      </SelectPopover>
    </SelectProvider>
  );
}
