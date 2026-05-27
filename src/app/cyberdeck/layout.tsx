/** Full-viewport shell for /cyberdeck — avoids body min-width and vh drift on mobile browsers. */
export default function CyberdeckLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cyberdeck-shell flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      {children}
    </div>
  );
}
