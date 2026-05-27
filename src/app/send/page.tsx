"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DROP_BAY_MAX_IMAGES } from "@/lib/dropbay/dropbay-types";

type SubmitState = "idle" | "submitting" | "success" | "error";

type ImagePreview = {
  id: string;
  file: File;
  url: string;
};

function fileFromClipboardItem(blob: File, index: number): File {
  const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return new File([blob], `pasted-${Date.now()}-${index}.${ext}`, { type: blob.type });
}

function mergeImageFiles(existing: File[], incoming: File[]): File[] {
  const merged = [...existing];
  for (const file of incoming) {
    if (merged.length >= DROP_BAY_MAX_IMAGES) break;
    merged.push(file);
  }
  return merged;
}

export default function SendPage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("android");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const imagePreviews = useMemo<ImagePreview[]>(
    () =>
      imageFiles.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        url: URL.createObjectURL(file),
      })),
    [imageFiles],
  );

  useEffect(() => {
    return () => {
      for (const preview of imagePreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [imagePreviews]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const pasted: File[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        pasted.push(fileFromClipboardItem(blob, index));
      }
      if (pasted.length === 0) return;

      event.preventDefault();
      setImageFiles((current) => mergeImageFiles(current, pasted));
      setState("idle");
      setMessage(
        pasted.length === 1
          ? "Image pasted — ready to send."
          : `${pasted.length} images pasted — ready to send.`,
      );
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
    if (!trimmedText && !trimmedUrl && imageFiles.length === 0) {
      setState("error");
      setMessage("Add a note, URL, or image.");
      return;
    }

    try {
      let res: Response;
      if (imageFiles.length > 0) {
        const form = new FormData();
        if (trimmedText) form.append("text", trimmedText);
        if (trimmedUrl) form.append("url", trimmedUrl);
        form.append("source", source.trim() || "android");
        for (const file of imageFiles) {
          form.append("images", file);
        }
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
      setImageFiles([]);
      setState("success");
      setMessage(`Drop relayed // ${payload.drop?.id ?? "ok"}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Submit failed.");
    }
  };

  return (
    <main className="send-shell min-h-screen w-full max-w-full overflow-x-hidden bg-black px-4 py-6 text-[#d8d8d8]">
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
            <span className="font-mono text-[10px] tracking-[0.08em] text-[#888]">
              IMAGES (OPTIONAL, UP TO {DROP_BAY_MAX_IMAGES})
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setImageFiles((current) => mergeImageFiles(current, selected));
                event.target.value = "";
                setState("idle");
                setMessage("");
              }}
              className="rounded-sm border border-[#222] bg-black px-3 py-2 font-mono text-[12px] text-[#bbb] file:mr-3 file:rounded-sm file:border-0 file:bg-emerald-950/40 file:px-3 file:py-1 file:font-mono file:text-[10px] file:tracking-[0.08em] file:text-emerald-200"
            />
            <span className="font-mono text-[9px] tracking-[0.06em] text-[#555]">
              Pick multiple from gallery/files, or paste images anywhere on this page.
            </span>
            {imagePreviews.length > 0 ? (
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={preview.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.url}
                        alt={`Selected drop ${index + 1}`}
                        className="h-24 w-24 rounded-sm border border-[#222] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                          setMessage("");
                        }}
                        className="absolute right-1 top-1 rounded-sm bg-black/80 px-1 font-mono text-[8px] text-[#ccc]"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] tracking-[0.06em] text-[#666]">
                    {imagePreviews.length} image{imagePreviews.length === 1 ? "" : "s"} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFiles([]);
                      setMessage("");
                    }}
                    className="font-mono text-[9px] tracking-[0.08em] text-[#888] underline underline-offset-2"
                  >
                    Clear all
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
