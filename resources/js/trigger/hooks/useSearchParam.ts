/*!
 * Adapted from Trigger.dev apps/webapp/app/hooks/useSearchParam.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: browser history and popstate replace Remix navigation and location.
 */
import { useCallback, useEffect, useState } from "react";

type Values = Record<string, string | string[] | undefined>;

export function useSearchParams() {
  const [searchString, setSearchString] = useState(() => currentSearch());

  useEffect(() => {
    const updateSearch = () => setSearchString(currentSearch());
    window.addEventListener("popstate", updateSearch);

    return () => window.removeEventListener("popstate", updateSearch);
  }, []);

  const navigate = useCallback((search: URLSearchParams) => {
    const nextSearch = search.toString();
    const url = `${window.location.pathname}?${nextSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
    setSearchString(window.location.search);
  }, []);

  const replace = useCallback(
    (values: Values) => {
      const search = set(new URLSearchParams(searchString), values);
      navigate(search);
    },
    [navigate, searchString]
  );

  const del = useCallback(
    (keys: string | string[]) => {
      const search = new URLSearchParams(searchString);
      if (!Array.isArray(keys)) {
        keys = [keys];
      }
      for (const key of keys) {
        search.delete(key);
      }
      navigate(search);
    },
    [navigate, searchString]
  );

  const value = useCallback(
    (param: string) => {
      const search = new URLSearchParams(searchString);
      return search.get(param) ?? undefined;
    },
    [searchString]
  );

  const values = useCallback(
    (param: string) => {
      const search = new URLSearchParams(searchString);
      return search.getAll(param);
    },
    [searchString]
  );

  const has = useCallback(
    (param: string) => {
      const search = new URLSearchParams(searchString);
      return search.has(param);
    },
    [searchString]
  );

  return {
    value,
    values,
    replace,
    del,
    has,
  };
}

function currentSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function set(searchParams: URLSearchParams, values: Values) {
  const search = new URLSearchParams(searchParams);
  for (const [param, value] of Object.entries(values)) {
    if (value === undefined) {
      search.delete(param);
      continue;
    }

    if (typeof value === "string") {
      search.set(param, value);
      continue;
    }

    search.delete(param);
    for (const v of value) {
      search.append(param, v);
    }
  }

  return search;
}
