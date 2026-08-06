/*!
 * Adapted from Trigger.dev apps/webapp/app/hooks/useSearchParam.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: React Router navigation replaces Remix navigation and location.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams as useRouterSearchParams } from "react-router-dom";

type Values = Record<string, string | string[] | undefined>;

export function useSearchParams() {
  const [searchParams, setSearchParams] = useRouterSearchParams();
  const searchString = searchParams.toString();

  const navigate = useCallback((search: URLSearchParams) => {
    setSearchParams(search, { replace: true });
  }, [setSearchParams]);

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
