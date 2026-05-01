import Link from "next/link";

const highlights = [
  {
    title: "Floating shell",
    body: "A compact cyberdeck entry point that feels like an instrument, not a dashboard.",
  },
  {
    title: "Voice lock",
    body: "MUTHUR keeps a frozen preset with restore and save commands so the voice does not wander.",
  },
  {
    title: "Operator surfaces",
    body: "Agents, characters, stories, and live tools sit under one control plane instead of separate apps.",
  },
] as const;

const stackNotes = [
  "Desktop-first shell",
  "Voice-locked MUTHUR",
  "Restore / save masters",
  "Local + remote model routing",
] as const;

const productShots = [
  {
    label: "MUTHUR",
    value: "MichelleNeural / intercom dry",
  },
  {
    label: "Recovery",
    value: "pnpm voice:restore",
  },
  {
    label: "Archive",
    value: "pnpm voice:save",
  },
  {
    label: "Launch",
    value: "/cyberdeck",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative h-screen overflow-y-auto overflow-x-hidden bg-[#05060a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,89,121,0.22),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(201,0,132,0.16),transparent_28%),linear-gradient(180deg,rgba(7,10,16,0.92),rgba(2,3,7,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.38em] text-rose-300/80">Echo Mirage Cyberdeck</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[0.16em] text-white sm:text-3xl">
              Operator Interface
            </h1>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {stackNotes.map((note) => (
              <span
                key={note}
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300"
              >
                {note}
              </span>
            ))}
          </div>
        </header>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-rose-200">
              <span className="h-2 w-2 rounded-full bg-rose-300 shadow-[0_0_12px_rgba(249,89,121,0.8)]" />
              Ready for demos, operators, and desktop control
            </div>

            <h2 className="mt-6 text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              A voice-locked cyberdeck for the people who actually have to use it.
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Echo Mirage turns the AI surface into a floating instrument: quick to summon, hard to break,
              and built around a frozen MUTHUR voice so the assistant sounds the same tomorrow as it does
              today.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cyberdeck"
                className="inline-flex items-center justify-center rounded-full border border-rose-300/30 bg-rose-500 px-5 py-3 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_18px_40px_rgba(249,89,121,0.2)] transition hover:-translate-y-0.5 hover:bg-rose-400"
              >
                Launch Cyberdeck
              </Link>
              <Link
                href="/agents"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                See Agent Surfaces
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
                >
                  <p className="text-[10px] uppercase tracking-[0.28em] text-rose-200/80">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-rose-500/20 via-transparent to-fuchsia-500/15 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(12,15,20,0.94),rgba(5,6,10,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">System panel</p>
                  <p className="mt-1 text-lg font-medium text-white">MUTHUR voice lock active</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-200">
                  backend-first
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {productShots.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{item.label}</span>
                    <span className="text-sm text-slate-100">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-3xl border border-rose-400/15 bg-rose-500/8 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-rose-200/80">What ships</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  A desktop cyberdeck, a stable voice lock, and a restore path that lets you recover the
                  exact sound instead of re-tuning from scratch.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 py-5">
          <div className="flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Built for operators who want one surface, one voice, and one recovery path.</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.22em]">
                /cyberdeck
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.22em]">
                /agents
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.22em]">
                /characters
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
