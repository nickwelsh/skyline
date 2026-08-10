/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogsRunIdFilter.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Shared-filter imports use the package-local client seam; validation accepts
 * Skyline's bounded opaque Run identities rather than Trigger generator shapes.
 */
import * as Ariakit from "@ariakit/react";
import { FingerPrintIcon } from "@heroicons/react/20/solid";
import { useCallback, useState } from "react";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";
import { Button } from "~/components/primitives/Buttons";
import { Input } from "~/components/primitives/Input";
import { Label } from "~/components/primitives/Label";
import { SelectPopover, SelectProvider, SelectTrigger } from "~/components/primitives/Select";
import { useSearchParams } from "~/hooks/useSearchParam";
import { FilterMenuProvider } from "~/components/runs/v3/TimeFilter";

const shortcut = { key: "i" };

export function LogsRunIdFilter() {
  const { value } = useSearchParams();
  const runIdValue = value("runId");

  if (runIdValue) {
    return <AppliedRunIdFilter />;
  }

  return (
    <FilterMenuProvider>
      {(search, setSearch) => (
        <RunIdDropdown
          trigger={
            <SelectTrigger
              icon={<FingerPrintIcon className="size-4" />}
              variant="secondary/small"
              shortcut={shortcut}
              tooltipTitle="Filter by run ID"
              className="pl-1.5"
            >
              <span className="ml-1">Run ID</span>
            </SelectTrigger>
          }
          clearSearchValue={() => setSearch("")}
        />
      )}
    </FilterMenuProvider>
  );
}

function RunIdDropdown({
  trigger,
  clearSearchValue,
  onClose,
}: {
  trigger: React.ReactNode;
  clearSearchValue: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState<boolean | undefined>();
  const { value, replace } = useSearchParams();
  const runIdValue = value("runId");

  const [runId, setRunId] = useState(runIdValue);

  const apply = useCallback(() => {
    clearSearchValue();
    replace({
      cursor: undefined,
      direction: undefined,
      runId: runId === "" ? undefined : runId?.toString(),
    });

    setOpen(false);
  }, [runId, replace, clearSearchValue]);

  return (
    <SelectProvider virtualFocus={true} open={open} setOpen={setOpen}>
      {trigger}
      <SelectPopover
        hideOnEnter={false}
        hideOnEscape={() => {
          if (onClose) {
            onClose();
            return false;
          }
          return true;
        }}
        className="max-w-[min(32ch,var(--popover-available-width))]"
      >
        <div className="flex flex-col gap-4 p-3">
          <div className="flex flex-col gap-1">
            <Label>Run ID</Label>
            <Input
              placeholder="run_"
              value={runId ?? ""}
              onChange={(e) => setRunId(e.target.value)}
              variant="small"
              className="w-[27ch] font-mono"
              spellCheck={false}
              maxLength={512}
            />
          </div>
          <div className="flex justify-between gap-1 border-t border-grid-dimmed pt-3">
            <Button variant="tertiary/small" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!runId || runId.length > 512}
              variant="secondary/small"
              shortcut={{
                modifiers: ["mod"],
                key: "Enter",
                enabledOnInputElements: true,
              }}
              onClick={() => apply()}
            >
              Apply
            </Button>
          </div>
        </div>
      </SelectPopover>
    </SelectProvider>
  );
}

function AppliedRunIdFilter() {
  const { value, del } = useSearchParams();

  const runId = value("runId");
  if (!runId) {
    return null;
  }

  return (
    <FilterMenuProvider>
      {(search, setSearch) => (
        <RunIdDropdown
          trigger={
            <Ariakit.Select render={<div className="group cursor-pointer focus-custom" />}>
              <AppliedFilter
                label="Run ID"
                icon={<FingerPrintIcon className="size-4" />}
                value={runId}
                onRemove={() => del(["runId", "cursor", "direction"])}
                variant="secondary/small"
              />
            </Ariakit.Select>
          }
          clearSearchValue={() => setSearch("")}
        />
      )}
    </FilterMenuProvider>
  );
}
