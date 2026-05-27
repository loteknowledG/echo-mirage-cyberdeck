"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function SendPage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("android");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const trimmedText = text.trim();
    const trimmedUrl = url.trim();
    if (!trimmedText && !trimmedUrl && !imageFile) {
      setState("error");
      setMessage("Add a note, URL, or image.");
      return;
    }

    try {
      let res: Response;
      if (imageFile) {
        const form = new FormData();
        if (trimmedText) form.append("text", trimmedText);
        if (trimmedUrl) form.append("url", trimmedUrl);
        form.append("source", source.trim() || "android");
        form.append("image", imageFile);
        res = await fetch("/api/drop", { method: "POST", body: form });
      } else {
        res = await fetch("/api/drop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmedText || undefined,
            url: trimmedUrl || undefined,
            source: source.trim() || "android",
          }),
        });
      }

      const payload = (await res.json()) as { ok?: boolean; error?: string; drop?: { id?: string } };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Submit failed (${res.status})`);
      }
      setText("");
      setUrl("");
      setImageFile(null);
      setState("success");
      setMessage(`Drop relayed // ${payload.drop?.id ?? "ok"}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Submit failed.");
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-[#d8d8d8]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <header>
          <h1 className="font-mono text-lg tracking-[0.12em] text-emerald-300">ECHO MIRAGE // SEND</h1>
          <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-[#777]">
            Drop Bay uplink — local / Tailscale only
          </p>
        </header>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-3 rounded-sm border border-[#1c1c1c] bg-[#050505] p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">NOTE</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              placeholder="investigate this"
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[14px] text-[#ddd] outline-none focus:border-emerald-500/50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">URL (OPTIONAL)</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              type="url"
              inputMode="url"
              placeholder="https://example.com"
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[14px] text-[#ddd] outline-none focus:border-emerald-500/50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">IMAGE (OPTIONAL)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[12px] text-[#bbb] file:mr-3 file:rounded-sm file:border-0 file:bg-emerald-950/40 file:px-3 file:py-1 file:font-mono file:text-[10px] file:tracking-[0.08em] file:text-emerald-200"
            />
            {imageFile ? (
              <span className="font-mono text-[9px] tracking-[0.06em] text-[#666]">
                {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">SOURCE</span>
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="android"
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[14px] text-[#ddd] outline-none focus:border-emerald-500/50"
            />
          </label>

          <button
            type="submit"
            disabled={state === "submitting"}
            className="mt-1 rounded-sm border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 font-mono text-[12px] tracking-[0.1em] text-emerald-200 transition hover:border-emerald-500/70 disabled:opacity-40"
          >
            {state === "submitting" ? "RELAYING…" : "SEND DROP"}
          </button>
        </form>

        {message ? (
          <p
            className={`font-mono text-[10px] tracking-[0.06em] ${
              state === "error" ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
