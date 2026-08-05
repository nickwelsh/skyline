/*!
 * Derived from Trigger.dev apps/webapp/app/hooks/useInitialDimensions.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0; no behavioral changes.
 */
import { useEffect, useState } from "react";

export function useInitialDimensions(ref: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState<DOMRectReadOnly | null>(null);

  useEffect(() => {
    if (ref.current) {
      setDimensions(ref.current.getBoundingClientRect());
    }
  }, [ref]);

  return dimensions;
}
