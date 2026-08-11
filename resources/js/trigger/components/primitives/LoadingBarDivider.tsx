/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/LoadingBarDivider.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: none beyond source provenance.
 */
import { AnimatePresence, useAnimate, usePresence } from "framer-motion";
import { useEffect } from "react";
import { cn } from "~/utils/cn";

type LoadingBarDividerProps = {
  isLoading: boolean;
  className?: string;
};

export function LoadingBarDivider({ isLoading, className }: LoadingBarDividerProps) {
  return (
    <div className={cn("relative h-px w-full overflow-hidden bg-grid-bright", className)}>
      <AnimationDivider isLoading={isLoading} />
    </div>
  );
}

export function AnimationDivider({ isLoading }: LoadingBarDividerProps) {
  const [scope, animate] = useAnimate();
  const [isPresent, safeToRemove] = usePresence();

  useEffect(() => {
    if (!scope.current) return;

    if (isPresent) {
      const enterAnimation = async () => {
        await animate(
          scope.current,
          { left: ["-100%", "100%"], width: "100%" },
          { duration: 2, ease: "easeOut", repeat: Infinity }
        );
      };
      enterAnimation();
    } else {
      const exitAnimation = async () => {
        await animate(scope.current, { opacity: 0 });
        safeToRemove();
      };

      exitAnimation();
    }
  }, [isPresent, isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <div
          ref={scope}
          className="width-0 absolute left-0 top-0 h-full bg-linear-to-r from-transparent from-5% via-blue-500 to-transparent to-95%"
        />
      )}
    </AnimatePresence>
  );
}
