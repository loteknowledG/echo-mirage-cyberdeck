export default function PropertyManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="property-manager-shell min-h-[100dvh] w-full overflow-x-hidden bg-black">
      {children}
    </div>
  );
}
