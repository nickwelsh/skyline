/* Reached variants adapted from Trigger.dev at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0. */
export function DevEnvironmentIconSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <path d="M7 3H5C3.89543 3 3 3.89543 3 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7L17 5C17 3.89543 16.1046 3 15 3L13 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 17L15 17C16.1046 17 17 16.1046 17 15L17 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13L3 15C3 16.1046 3.89543 17 5 17L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProdEnvironmentIconSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.4174 6.23514C10.263 5.86384 9.73701 5.86384 9.58258 6.23514L8.70207 8.35213L6.4166 8.53536C6.01575 8.56749 5.85322 9.06773 6.15862 9.32934L7.89991 10.8209L7.36792 13.0512C7.27461 13.4423 7.70014 13.7515 8.04332 13.5419L10 12.3467L11.9567 13.5419C12.2999 13.7515 12.7254 13.4423 12.6321 13.0512L12.1001 10.8209L13.8414 9.32934C14.1468 9.06773 13.9842 8.56749 13.5834 8.53536L11.2979 8.35213L10.4174 6.23514Z" fill="currentColor" />
    </svg>
  );
}
