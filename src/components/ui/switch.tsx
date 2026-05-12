"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[3px] border border-[#2d2d2d] bg-[#090909] p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_6px_rgba(0,0,0,0.65)] transition-all duration-150 ease-out [--switch-travel:calc(2.75rem-1rem-6px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:bg-[#0b0b0b]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-4 shrink-0 rounded-[2px] border border-[#444] bg-gradient-to-b from-[#5c5c5c] via-[#3a3a3a] to-[#242424] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.6)] ring-0 transition-transform duration-150 ease-out data-[state=checked]:translate-x-[var(--switch-travel)] data-[state=checked]:border-emerald-400/50 data-[state=checked]:bg-gradient-to-b data-[state=checked]:from-emerald-200 data-[state=checked]:via-emerald-400 data-[state=checked]:to-emerald-700 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
