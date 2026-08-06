/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/FavoritePageButton.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server mutations are replaced by an injected external preference port.
 */
import { StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect } from "react";
import { cn } from "~/utils/cn";
import { Button } from "../primitives/Buttons";
import { ShortcutKey } from "../primitives/ShortcutKey";
import { SimpleTooltip } from "../primitives/Tooltip";

export type JobFavorite = { id: string; label: string; path: string; icon?: string };

const FavoritesContext = createContext<{
  favorites: JobFavorite[];
  onChange: (favorites: JobFavorite[]) => void;
}>({ favorites: [], onChange: () => {} });

export function FavoritesProvider({
  favorites,
  onChange,
  children,
}: {
  favorites: JobFavorite[];
  onChange: (favorites: JobFavorite[]) => void;
  children: React.ReactNode;
}) {
  return <FavoritesContext.Provider value={{ favorites, onChange }}>{children}</FavoritesContext.Provider>;
}

export function JobFavoriteButton({ id, label, path, className }: JobFavorite & { className?: string }) {
  const { favorites, onChange } = useContext(FavoritesContext);
  const favorite = favorites.some((candidate) => candidate.id === id);
  const action = favorite ? "Remove" : "Add";

  const toggle = () => onChange(favorite
    ? favorites.filter((candidate) => candidate.id !== id)
    : [{ id, label, path }, ...favorites]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyF") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [favorite, favorites, id, label, path]);

  const tooltipLabel = `${action} ${label} ${favorite ? "from" : "to"} favorites`;
  return <SimpleTooltip delayDuration={500} disableHoverableContent asChild side="bottom" button={
    <span className={cn("flex", className)}>
      <Button variant="minimal/small" className="aspect-square h-6 p-1" onClick={toggle} aria-label={tooltipLabel} aria-pressed={favorite} LeadingIcon={favorite ? <StarIconSolid className="size-4 text-yellow-500" /> : <StarIconOutline className="size-4 text-text-dimmed transition-colors group-hover/button:text-text-bright" />} />
    </span>
  } content={<span className="flex items-center gap-2">{tooltipLabel}<ShortcutKey shortcut={{ modifiers: ["alt"], key: "f" }} variant="medium/bright" /></span>} />;
}

export function useJobFavorites() {
  return useContext(FavoritesContext).favorites;
}
