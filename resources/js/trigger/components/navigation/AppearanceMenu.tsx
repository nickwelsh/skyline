/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/account._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server preference writes are replaced by an injected external preference callback.
 */
import { ComputerDesktopIcon, MoonIcon, SunIcon, SwatchIcon } from "@heroicons/react/20/solid";
import { Label } from "../primitives/Label";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/Popover";
import { Select, SelectItem } from "../primitives/Select";
import { Slider } from "../primitives/Slider";
import { cn } from "~/utils/cn";

export type AppearancePreference = {
  theme: "classic" | "system" | "dark" | "light";
  contrast: number;
};

const themes: AppearancePreference["theme"][] = ["classic", "system", "dark", "light"];

export function AppearanceMenu({ appearance, onChange, collapsed, labelOpacity }: { appearance: AppearancePreference; onChange: (value: Partial<AppearancePreference>) => void; collapsed: boolean; labelOpacity: number }) {
  return <Popover><PopoverTrigger aria-label="Appearance" className={cn("flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom", collapsed ? "w-8" : "min-w-0 flex-1")}>
    {themeIcon(appearance.theme)}<span className="truncate text-[0.90625rem] font-medium" style={{ opacity: labelOpacity }}>Appearance</span>
  </PopoverTrigger><PopoverContent side={collapsed ? "right" : "top"} align="start" className="w-64 p-3">
    <div className="flex items-center justify-between gap-4"><Label>Interface theme</Label><Select<AppearancePreference["theme"], AppearancePreference["theme"]>
      aria-label="Interface theme"
      value={appearance.theme}
      setValue={(value) => onChange({ theme: value as AppearancePreference["theme"] })}
      variant="secondary/small"
      dropdownIcon
      items={themes}
      text={(value) => <span className="flex items-center gap-1.5">{themeIcon(value)}{themeLabel(value)}</span>}
      className="w-44"
    >
      {(items) => items.map((item) => <SelectItem key={item} value={item} icon={themeIcon(item)}>{themeLabel(item)}</SelectItem>)}
    </Select></div>
    {appearance.theme !== "classic" && <div className="mt-4 flex items-center justify-between gap-4"><Label>Contrast</Label><Slider variant="settings" className="w-44" aria-label="Contrast" min={0} max={100} step={5} value={[appearance.contrast]} onValueChange={(values) => onChange({ contrast: values[0] ?? 50 })} /></div>}
  </PopoverContent></Popover>;
}

function themeLabel(theme: AppearancePreference["theme"]) {
  return { classic: "Classic", system: "System preference", dark: "Dark", light: "Light" }[theme];
}

function themeIcon(theme: AppearancePreference["theme"]) {
  if (theme === "classic") return <SwatchIcon className="size-5 min-w-5 text-text-dimmed" />;
  if (theme === "system") return <ComputerDesktopIcon className="size-5 min-w-5 text-text-dimmed" />;
  if (theme === "dark") return <span className="grid size-5 min-w-5 place-items-center"><MoonIcon className="size-4 text-text-dimmed" /></span>;
  return <SunIcon className="size-5 min-w-5 text-text-dimmed" />;
}
