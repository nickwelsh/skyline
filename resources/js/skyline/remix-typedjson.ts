import { useMemo } from "react";

type TypedFetcher<T> = {
  data: any;
  state: "idle" | "loading" | "submitting";
  load: (path: string) => void;
};

/** Compatibility seam: Skyline loads detail externally and supplies `initialLog`. */
export function useTypedFetcher<T>(): TypedFetcher<T> {
  return useMemo(() => ({ data: undefined, state: "idle", load: () => undefined }), []);
}
