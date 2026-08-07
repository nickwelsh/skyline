/*!
 * Exact copy of Trigger.dev apps/webapp/app/components/TriggerRotatingLogo.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "spline-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { url?: string; "loading-anim-type"?: string },
        HTMLElement
      >;
    }
  }

  interface Window {
    __splineLoader?: Promise<void>;
  }
}

export function TriggerRotatingLogo() {
  const [isSplineReady, setIsSplineReady] = useState(false);

  useEffect(() => {
    if (customElements.get("spline-viewer")) {
      setIsSplineReady(true);
      return;
    }
    if (window.__splineLoader) {
      window.__splineLoader.then(() => setIsSplineReady(true)).catch(() => setIsSplineReady(false));
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@splinetool/viewer@1.12.29/build/spline-viewer.js";
    window.__splineLoader = new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject();
    });
    window.__splineLoader.then(() => setIsSplineReady(true)).catch(() => setIsSplineReady(false));
    document.head.appendChild(script);
  }, []);

  if (!isSplineReady) return null;

  return (
    <motion.div className="pointer-events-none absolute inset-0 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 2, ease: "easeOut" }}>
      <spline-viewer loading-anim-type="spinner-small-light" url="https://prod.spline.design/wRly8TZN-e0Twb8W/scene.splinecode" style={{ width: "100%", height: "100%" }} />
    </motion.div>
  );
}
