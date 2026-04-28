"use client"

import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable"
import type { ComponentProps } from "react"

type ContentEditableProps = Omit<
  ComponentProps<typeof LexicalContentEditable>,
  "placeholder" | "aria-placeholder"
> & {
  placeholderText?: string
}

export function ContentEditable({
  placeholderText = "Start typing ...",
  className,
  ...props
}: ContentEditableProps) {
  return (
    <LexicalContentEditable
      {...props}
      aria-placeholder={placeholderText}
      placeholder={<span className="pointer-events-none text-zinc-500">{placeholderText}</span>}
      className={[
        "min-h-[180px] w-full rounded-md border border-zinc-800 bg-transparent px-4 py-3 text-sm outline-none",
        "selection:bg-primary selection:text-primary-foreground focus:outline-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  )
}
