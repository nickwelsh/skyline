/*!
 * Derived from Trigger.dev apps/webapp/app/hooks/useCopy.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0; no behavioral changes.
 */
import { useCallback, useState } from "react";

export function useCopy(value: string, duration = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, duration);
    },
    [value, duration]
  );

  return { copy, copied };
}
