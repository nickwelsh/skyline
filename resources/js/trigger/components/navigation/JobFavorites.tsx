/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/FavoritePageButton.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * User/server preference writes are replaced by local, Job-only browser persistence.
 */
import { StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

export type JobFavorite = { id: string; label: string; path: string };

const storageKey = "skyline.job-favorites.v1";
const changeEvent = "skyline-job-favorites-change";

export function JobFavoriteButton({ id, label, path }: JobFavorite) {
  const favorites = useJobFavorites();
  const favorite = favorites.some((candidate) => candidate.id === id);
  const action = favorite ? "Remove" : "Add";

  const toggle = () => {
    const next = favorite
      ? favorites.filter((candidate) => candidate.id !== id)
      : [{ id, label, path }, ...favorites];
    writeFavorites(next);
  };

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

  return (
    <button
      type="button"
      aria-label={`${action} ${label} ${favorite ? "from" : "to"} favorites`}
      aria-pressed={favorite}
      onClick={toggle}
      className="group/button flex size-6 items-center justify-center rounded p-1 text-text-dimmed transition hover:bg-background-raised hover:text-text-bright focus-custom"
    >
      {favorite ? <StarIconSolid className="size-4 text-yellow-500" /> : <StarIconOutline className="size-4" />}
    </button>
  );
}

export function useJobFavorites() {
  const [favorites, setFavorites] = useState<JobFavorite[]>(readFavorites);

  useEffect(() => {
    const refresh = () => setFavorites(readFavorites());
    window.addEventListener(changeEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(changeEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return favorites;
}

function readFavorites(): JobFavorite[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter(isJobFavorite) : [];
  } catch {
    return [];
  }
}

function writeFavorites(favorites: JobFavorite[]) {
  localStorage.setItem(storageKey, JSON.stringify(favorites));
  window.dispatchEvent(new Event(changeEvent));
}

function isJobFavorite(value: unknown): value is JobFavorite {
  if (typeof value !== "object" || value === null) return false;
  const favorite = value as Partial<JobFavorite>;
  return typeof favorite.id === "string"
    && typeof favorite.label === "string"
    && typeof favorite.path === "string"
    && /^\/jobs\/job_[A-Za-z0-9_-]+$/.test(favorite.path)
    && favorite.path === `/jobs/${favorite.id}`;
}
