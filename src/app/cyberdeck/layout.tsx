/** Full-viewport shell for /cyberdeck — avoids body min-width and vh drift on mobile browsers. */
export default function CyberdeckLayout({ children }: { children: React.ReactNode }) {
  return <div className="cyberdeck-shell">{children}</div>;
}
