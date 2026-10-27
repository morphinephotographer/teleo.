/** Branding is plain text: never a route, action, tab stop or focus target. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand wordmark ${className}`} translate="no">
      teleo.
    </span>
  );
}
