/*!
 * Derived from Trigger.dev apps/webapp/app/assets/icons/TaskIcon.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Retains only the TaskIcon export used by Skyline's RunIcon.
 */
export function TaskIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="11" y="16" width="2" height="7" rx="1" fill="currentColor" />
      <rect x="11" y="1" width="2" height="7" rx="1" fill="currentColor" />
      <rect x="13" y="11" width="2" height="12" rx="1" transform="rotate(90 13 11)" fill="currentColor" />
      <rect x="23" y="11" width="2" height="7" rx="1" transform="rotate(90 23 11)" fill="currentColor" />
      <rect x="4.92758" y="20.4867" width="2" height="12.0018" rx="1" transform="rotate(-135 4.92758 20.4867)" fill="currentColor" />
      <rect x="15.3185" y="10.0958" width="2" height="6.99687" rx="1" transform="rotate(-135 15.3185 10.0958)" fill="currentColor" />
      <rect x="20.3488" y="18.9346" width="2" height="6.99653" rx="1" transform="rotate(135 20.3488 18.9346)" fill="currentColor" />
      <rect x="13.4161" y="12.002" width="2" height="11.9956" rx="1" transform="rotate(135 13.4161 12.002)" fill="currentColor" />
    </svg>
  );
}
