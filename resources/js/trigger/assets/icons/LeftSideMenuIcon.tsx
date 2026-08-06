/*!
 * Adapted from Trigger.dev apps/webapp/app/assets/icons/LeftSideMenuIcon.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { motion } from "framer-motion";

export function LeftSideMenuIcon({ className, hovered }: { className?: string; hovered: boolean }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <motion.rect x="6" y="6" width="5" height="12" rx="1" fill="currentColor" initial={false} style={{ originX: 0 }} animate={{ scaleX: hovered ? 0.2 : 1 }} transition={{ duration: 0.3, ease: "easeInOut" }} />
    </svg>
  );
}
