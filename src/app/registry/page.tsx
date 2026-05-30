import type { Metadata } from 'next';

const installCommands = [
  {
    label: 'Theme',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism.json',
  },
  {
    label: 'Base Kit',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism-base.json',
  },
  {
    label: 'Showroom Site',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism-site.json',
  },
];

const swatches = [
  ['Host', '#060708'],
  ['Raised', '#0e1011'],
  ['Face', '#171c19'],
  ['Wall', '#2a6b56'],
  ['Hover', '#3a9174'],
  ['Amber', '#8a6530'],
  ['Signal', '#7dffb4'],
  ['Ink', '#e8efeb'],
];

const registryItems = [
  {
    name: 'realmorphism',
    type: 'registry:theme',
    href: '/registry/realmorphism.json',
    summary: 'Tokens, color planes, radius, hard wall shadow, and motion CSS.',
  },
  {
    name: 'realmorphism-base',
    type: 'registry:block',
    href: '/registry/realmorphism-base.json',
    summary: 'Turnkey shadcn wrappers for tactile controls and layout primitives.',
  },
  {
    name: 'realmorphism-site',
    type: 'registry:block',
    href: '/registry/realmorphism-site.json',
    summary: 'A portable showroom page for presenting the registry itself.',
  },
];

export const metadata: Metadata = {
  title: 'Realmorphism Registry',
  description: 'Echo Mirage shadcn registry showroom for the Realmorphism theme.',
};

export default function RegistryPage() {
  return (
    <main
      data-deck-mode="realmorphism"
      className="h-screen overflow-y-auto bg-[#060708] px-4 py-6 text-[#e8efeb] sm:px-6 lg:px-10"
    >
      <div data-morphism="realmorphism" className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="grid gap-6 border-b border-[#2a3530] pb-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex border border-[#2a3530] bg-[#0e1011] px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-[#7dffb4]">
              Echo Mirage Registry
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-[#e8efeb] sm:text-6xl">
                Realmorphism
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#9eada7]">
                A blocky tactile shadcn theme for operational interfaces. The colors define the
                planes; the motion tells the operator an action is alive.
              </p>
            </div>
          </div>
          <div className="grid gap-3 rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-4 shadow-[var(--realmorphism-shadow-rest)]">
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-[#9eada7]">
              Install
            </div>
            {installCommands.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="font-mono text-xs text-[#7dffb4]">{item.label}</div>
                <pre className="overflow-x-auto rounded-[var(--realmorphism-radius-sm)] border border-[#2a3530] bg-[#060708] p-3 text-xs text-[#e8efeb]">
                  {item.command}
                </pre>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {swatches.map(([label, color]) => (
            <div
              key={label}
              className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-3"
            >
              <div className="mb-3 h-16 border border-[#2a3530]" style={{ background: color }} />
              <div className="font-mono text-sm text-[#e8efeb]">{label}</div>
              <div className="font-mono text-xs text-[#6f7a75]">{color}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-5 shadow-[var(--realmorphism-shadow-rest)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Action Surface</h2>
                <p className="mt-1 text-sm text-[#9eada7]">Hover and press the controls.</p>
              </div>
              <span className="font-mono text-xs text-[#7dffb4]">motion = affordance</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <button className="realmorphism-control border px-5 py-3 font-mono text-sm">
                Commit
              </button>
              <button className="realmorphism-control is-latched border px-5 py-3 font-mono text-sm">
                Latched
              </button>
              <button className="realmorphism-control is-amber border px-5 py-3 font-mono text-sm">
                Caution
              </button>
              <button className="realmorphism-control border px-4 py-3 font-mono text-sm" disabled>
                Disabled
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {registryItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="realmorphism-control grid gap-2 border p-4 no-underline"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-lg text-[#e8efeb]">{item.name}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[#7dffb4]">
                    {item.type}
                  </div>
                </div>
                <p className="text-sm leading-6 text-[#9eada7]">{item.summary}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-5">
          <h2 className="mb-3 text-xl font-semibold">Community Upload Notes</h2>
          <p className="max-w-3xl text-sm leading-6 text-[#9eada7]">
            Tweakcn can carry the Realmorphism colors and tokens. The shadcn registry carries the
            installable part: theme JSON, wrappers, and this showroom page. Publish the colors on
            tweakcn, then point builders to this registry when they need the full motion layer.
          </p>
        </section>
      </div>
    </main>
  );
}
