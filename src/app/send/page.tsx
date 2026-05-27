"use client";

import { FormEvent, useEffect, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

function fileFromClipboardItem(blob: File, index: number): File {
  const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return new File([blob], `pasted-${Date.now()}-${index}.${ext}`, { type: blob.type });
}

export default function SendPage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("android");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;

        event.preventDefault();
        setImageFile(fileFromClipboardItem(blob, index));
        setState("idle");
        setMessage("Image pasted — ready to send.");
        return;
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

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

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">IMAGE (OPTIONAL)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null);
                setState("idle");
                setMessage("");
              }}
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[12px] text-[#bbb] file:mr-3 file:rounded-sm file:border-0 file:bg-emerald-950/40 file:px-3 file:py-1 file:font-mono file:text-[10px] file:tracking-[0.08em] file:text-emerald-200"
            />
            <span className="font-mono text-[9px] tracking-[0.06em] text-[#555]">
              Pick from gallery/files, or paste an image anywhere on this page (Ctrl+V / long-press paste).
            </span>
            {imageFile ? (
              <div className="mt-1 flex items-start gap-3">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreviewUrl}
                    alt="Selected drop"
                    className="max-h-32 max-w-[40%] rounded-sm border border-[#222] object-contain"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-mono text-[9px] tracking-[0.06em] text-[#666]">
                    {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setMessage("");
                    }}
                    className="self-start font-mono text-[9px] tracking-[0.08em] text-[#888] underline underline-offset-2"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            ) : null}
          </div>

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
