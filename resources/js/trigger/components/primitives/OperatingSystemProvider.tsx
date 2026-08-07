/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/OperatingSystemProvider.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adds Linux and unknown platform classification for truthful shortcut labels.
 */
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type OperatingSystemPlatform = "linux" | "mac" | "unknown" | "windows";

export function operatingSystemFromUserAgent(userAgent: string): OperatingSystemPlatform {
  if (/windows/i.test(userAgent)) return "windows";
  if (/(macintosh|mac os x|iphone|ipad|ipod)/i.test(userAgent)) return "mac";
  if (/(android|cros|linux)/i.test(userAgent)) return "linux";

  return "unknown";
}

type OperatingSystemContext = {
  platform: OperatingSystemPlatform;
};

type OperatingSystemContextProviderProps = {
  platform: OperatingSystemPlatform;
  children: ReactNode;
};

const Context = createContext<OperatingSystemContext | null>(null);

export const OperatingSystemContextProvider = ({
  platform,
  children,
}: OperatingSystemContextProviderProps) => {
  return <Context.Provider value={{ platform }}>{children}</Context.Provider>;
};

const throwIfNoProvider = () => {
  throw new Error("Please wrap your application in an OperatingSystemContextProvider.");
};

export const useOperatingSystem = () => {
  const { platform } = useContext(Context) ?? throwIfNoProvider();
  return { platform };
};
