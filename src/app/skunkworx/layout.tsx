export default function SkunkworxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-black text-[#d8d8d8]">{children}</div>
  );
}
