import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Samus ai_bootup.py mechanicus chain — keep in sync with samus-manus. */
export const MECHANICUS_FFMPEG_FILTER =
  "aresample=44100,atempo=0.90," +
  "highpass=f=100," +
  "lowpass=f=2800," +
  "chorus=0.6:0.9:50:0.5:0.3:2.5," +
  "aecho=0.8:0.9:80|160:0.3|0.3," +
  "acompressor=threshold=-20dB:ratio=3:attack=5:release=150," +
  "alimiter=limit=0.88";

function resolveFfmpegBinary(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export async function applyFfmpegVoiceEffect(
  input: Buffer,
  filter: string,
): Promise<Buffer | null> {
  if (!input.length || !filter.trim()) return null;

  const ffmpeg = resolveFfmpegBinary();
  const dir = await mkdtemp(join(tmpdir(), "emc-voice-fx-"));
  const inputPath = join(dir, `in-${randomUUID()}.mp3`);
  const outputPath = join(dir, `out-${randomUUID()}.mp3`);

  try {
    await writeFile(inputPath, input);
    const exitCode = await new Promise<number>((resolve, reject) => {
      const proc = spawn(
        ffmpeg,
        ["-y", "-i", inputPath, "-af", filter, "-ar", "48000", "-ac", "1", outputPath],
        { stdio: "ignore" },
      );
      proc.on("error", reject);
      proc.on("close", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) return null;
    const output = await readFile(outputPath);
    return output.length ? output : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
