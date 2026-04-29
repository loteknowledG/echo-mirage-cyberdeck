import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const MURF_TTS_URL = "https://global.api.murf.ai/v1/speech/stream";
const AZURE_JENNY_VOICE = "en-US-JennyNeural";
const MUTHUR_VOICE_STYLE = "Azure Jenny Neural";
const MUTHUR_RATE = "-5%";
const MUTHUR_PITCH = "-2Hz";
const NON_COMMERCIAL_FALLBACK = process.env.NON_COMMERCIAL_FALLBACK === "1";
const LOCAL_SYNTH_ENABLED = (process.env.LOCAL_SYNTH || "1").trim() !== "0";
const CODEROBO_API_URL = (process.env.CODEROBO_TTS_API_URL || "https://tts-api.coderobo.org").trim();
const CODEROBO_JWT =
  (
    process.env.CODEROBO_TTS_JWT ||
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZGVmYXVsdF93ZWJfY2xpZW50IiwgInJvbGUiOiAidXNlciJ9.eSHTiqjO5QItqrB7UCKbW2zrYW5AFoFTwYMQ8gJa4AY"
  ).trim();

async function synthesizeWithCoderobo(text: string): Promise<ArrayBuffer | null> {
  if (!CODEROBO_API_URL || !CODEROBO_JWT) return null;

  const formData = new FormData();
  formData.append("text", text);
  formData.append("language", "en-US");
  formData.append("voice", "JennyNeural");
  // Mirror game calibration approximately in coderobo's expected units.
  formData.append("rate", "-5");
  formData.append("pitch", "-2");
  formData.append("user_ip", "127.0.0.1");

  const start = await fetch(`${CODEROBO_API_URL}/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CODEROBO_JWT}`,
    },
    body: formData,
  });
  if (!start.ok) return null;

  const startPayload = (await start.json().catch(() => null)) as { task_id?: string } | null;
  const taskId = startPayload?.task_id;
  if (!taskId) return null;

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusRes = await fetch(`${CODEROBO_API_URL}/task-status/${taskId}`, {
      headers: {
        Authorization: `Bearer ${CODEROBO_JWT}`,
      },
    });
    if (!statusRes.ok) continue;
    const statusPayload = (await statusRes.json().catch(() => null)) as
      | { status?: string }
      | null;
    const status = (statusPayload?.status || "").toLowerCase();
    if (status === "completed") {
      const finalRes = await fetch(`${CODEROBO_API_URL}/status/${taskId}`, {
        headers: {
          Authorization: `Bearer ${CODEROBO_JWT}`,
        },
      });
      if (!finalRes.ok) return null;
      const finalPayload = (await finalRes.json().catch(() => null)) as
        | { audio_url?: string }
        | null;
      const audioUrl = (finalPayload?.audio_url || "").trim();
      if (!audioUrl) return null;
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) return null;
      return audioRes.arrayBuffer();
    }
    if (status === "failed" || status === "cancelled" || status === "expired") {
      return null;
    }
  }

  return null;
}

async function synthesizeWithMurf(text: string, suppliedApiKey?: string): Promise<ArrayBuffer | null> {
  const murfApiKey = (suppliedApiKey || process.env.MURF_API_KEY || "").trim();
  if (!murfApiKey) return null;

  const murfVoiceId = (process.env.MURF_VOICE_ID || "Jenny").trim();
  const response = await fetch(MURF_TTS_URL, {
    method: "POST",
    headers: {
      "api-key": murfApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_id: murfVoiceId,
      text,
      locale: "en-US",
      model: "FALCON",
      format: "MP3",
      sampleRate: 24000,
      channelType: "MONO",
      // Match prior calibration intent.
      rate: "-5%",
      pitch: "-2Hz",
    }),
  });

  if (!response.ok) return null;
  return response.arrayBuffer();
}

async function synthesizeWithLocalSapi(text: string): Promise<ArrayBuffer | null> {
  if (process.platform !== "win32") return null;
  const outPath = path.join(
    os.tmpdir(),
    `muthur-local-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`,
  );

  const psScript = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$female = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | Where-Object { $_.Gender -eq 'Female' } | Select-Object -First 1;
if ($female -ne $null) { $synth.SelectVoice($female.Name) }
$synth.Rate = -1;
$synth.Volume = 90;
$synth.SetOutputToWaveFile($env:TTS_OUT_PATH);
$synth.Speak($env:TTS_TEXT);
$synth.Dispose();
`;

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        "powershell",
        ["-NoProfile", "-Command", psScript],
        {
          env: {
            ...process.env,
            TTS_TEXT: text,
            TTS_OUT_PATH: outPath,
          },
          windowsHide: true,
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });

    const wav = await readFile(outPath);
    await unlink(outPath).catch(() => {});
    return wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  } catch {
    await unlink(outPath).catch(() => {});
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = (body?.text || "").toString().trim();
    const suppliedApiKey = (body?.apiKey || "").toString().trim();
    const apiKey = suppliedApiKey || process.env.OPENAI_API_KEY || "";
    const suppliedMurfApiKey = (body?.murfApiKey || "").toString().trim();
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY || "";
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION || "";

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    if (LOCAL_SYNTH_ENABLED) {
      const localAudio = await synthesizeWithLocalSapi(text);
      if (localAudio) {
        return new Response(localAudio, {
          status: 200,
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    // Preferred path: Murf stream TTS.
    const murfAudio = await synthesizeWithMurf(text, suppliedMurfApiKey);
    if (murfAudio) {
      return new Response(murfAudio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    if (NON_COMMERCIAL_FALLBACK) {
      return NextResponse.json(
        { error: "NON_COMMERCIAL_FALLBACK_ENABLED // USE_LOCAL_BROWSER_VOICE" },
        { status: 503 },
      );
    }

    // Secondary path: Azure Jenny Neural (en-US-JennyNeural).
    if (azureSpeechKey && azureSpeechRegion) {
      const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${AZURE_JENNY_VOICE}"><prosody rate="${MUTHUR_RATE}" pitch="${MUTHUR_PITCH}">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</prosody></voice></speak>`;

      const azureResponse = await fetch(
        `https://${azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureSpeechKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "echo-mirage-cyberdeck",
          },
          body: ssml,
        },
      );

      if (azureResponse.ok) {
        const audioBuffer = await azureResponse.arrayBuffer();
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    // Third fallback path: coderobo JennyNeural.
    const coderoboAudio = await synthesizeWithCoderobo(text);
    if (coderoboAudio) {
      return new Response(coderoboAudio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    // Final fallback path when Murf/Azure/coderobo are unavailable.
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing Murf/Azure/coderobo voice configuration and OpenAI API key for fallback synthesis",
        },
        { status: 401 },
      );
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "shimmer",
        response_format: "mp3",
        input: text,
        instructions:
          `You are MU/TH/UR 6000. Voice target: ${MUTHUR_VOICE_STYLE}. Keep a calm, precise, slightly detached delivery. Apply speaking style equivalent to rate ${MUTHUR_RATE} and pitch ${MUTHUR_PITCH}. Use short phrases, deliberate micro-pauses, clean articulation, and no emotional spikes.`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `Voice API error ${response.status}: ${errorText || response.statusText}` },
        { status: 502 },
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice synthesis failed" },
      { status: 500 },
    );
  }
}
