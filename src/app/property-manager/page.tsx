import { PropertyManagerWorkspace } from "@/components/property-manager/PropertyManagerWorkspace";

export default function PropertyManagerPage() {
  return (
    <main
      data-testid="property-manager-case-viewer"
      className="flex min-h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-black px-3 py-3 text-green-300 sm:px-5 sm:py-5"
    >
      <PropertyManagerWorkspace />
    </main>
  );
}
