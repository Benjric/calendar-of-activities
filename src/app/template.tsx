/**
 * Remounts on every route change (not on search-param changes), so each page
 * fades in as it arrives while selecting a bar on the calendar stays still.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-fade flex flex-1 flex-col">{children}</div>;
}
