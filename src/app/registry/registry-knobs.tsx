'use client';

import * as React from 'react';

import { Knob } from '@/components/ui/knob';

export function RegistryKnobs() {
  const [power, setPower] = React.useState(42);
  const [tone, setTone] = React.useState(24);
  const [balance, setBalance] = React.useState(0);
  const [trim, setTrim] = React.useState(7);

  return (
    <section className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-5 shadow-[var(--realmorphism-shadow-rest)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Rotary Surface</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#9eada7]">
            Wheel for precise increments, drag for a quick sweep, press the dial face to toggle power,
            double-click to snap back to default.
          </p>
        </div>
        <span className="font-mono text-xs text-[#7dffb4]">wheel-first tuning</span>
      </div>
      <div className="grid justify-items-center gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Knob
          label="Power"
          value={power}
          onValueChange={setPower}
          min={0}
          max={100}
          step={1}
          mode="power"
          theme="dark"
        />
        <Knob
          label="Tone"
          value={tone}
          onValueChange={setTone}
          min={0}
          max={100}
          step={1}
          mode="power"
          theme="dark"
        />
        <Knob
          label="Balance"
          value={balance}
          onValueChange={setBalance}
          min={-12}
          max={12}
          step={1}
          wheelMultiplier={0.5}
          dragMultiplier={0.75}
          mode="balance"
          theme="dark"
        />
        <Knob
          label="Trim"
          value={trim}
          onValueChange={setTrim}
          min={0}
          max={10}
          step={0.1}
          mode="power"
          size="sm"
          theme="dark"
        />
      </div>
    </section>
  );
}
