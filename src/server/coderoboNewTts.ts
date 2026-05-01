export type CoderoboNewTtsInput = {
  text: string;
  language?: string;
  voiceType?: string;
  gender?: "Male" | "Female";
  ratePercent?: number;
  pitchHz?: number;
};

export type CoderoboRenderResult =
  | { ok: true; audio: Buffer }
  | { ok: false; stage: string; message: string; details: string };

const DEFAULT_BASE_URL = "https://tts-api.coderobo.org";
const DEFAULT_ENDPOINT = "/tts";
const DEFAULT_JWT =
  "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZGVmYXVsdF93ZWJfY2xpZW50IiwgInJvbGUiOiAidXNlciJ9.eSHTiqjO5QItqrB7UCKbW2zrYW5AFoFTwYMQ8gJa4AY";

function env(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function getBaseUrl() {
  return env("CODEROBO_NEW_TTS_BASE_URL", "CODER0BO_NEW_TTS_BASE_URL") || DEFAULT_BASE_URL;
}

function getEndpoint() {
  return env("CODEROBO_NEW_TTS_ENDPOINT", "CODER0BO_NEW_TTS_ENDPOINT") || DEFAULT_ENDPOINT;
}

function getToken() {
  return env("CODEROBO_JWT_TOKEN", "CODER0BO_JWT_TOKEN") || DEFAULT_JWT;
}

function getUserIp() {
  return env("CODEROBO_USER_IP", "CODER0BO_USER_IP") || "127.0.0.1";
}

function resolveUrl(baseUrl: string, maybePath: string): string {
  try {
    return new URL(maybePath, baseUrl).toString();
  } catch {
    return maybePath;
  }
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function makeHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Origin: "https://aivoice.coderobo.org",
    Referer: "https://aivoice.coderobo.org/new-tts.html",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
  };
}

function normalizeText(value: string) {
  return (value || "").trim();
}

function toIntegerString(value: number | undefined, fallback: number) {
  const resolved = Number.isFinite(value ?? NaN) ? Math.trunc(value as number) : fallback;
  return String(resolved);
}

function logRequest(payload: Record<string, unknown>) {
  console.info("[coderobo:new-tts] request", payload);
}

function pickAudioUrl(json: Record<string, unknown>): string {
  const audioUrl =
    (typeof json.audio_url === "string" && json.audio_url) ||
    (typeof json.audioUrl === "string" && json.audioUrl) ||
    (typeof json.url === "string" && json.url) ||
    (typeof json.download_url === "string" && json.download_url) ||
    (typeof json.downloadUrl === "string" && json.downloadUrl) ||
    "";
  return audioUrl.trim();
}

function pickBase64(json: Record<string, unknown>): string {
  const audioBase64 =
    (typeof json.audio_base64 === "string" && json.audio_base64) ||
    (typeof json.audioBase64 === "string" && json.audioBase64) ||
    (typeof json.audio === "string" && json.audio) ||
    (typeof json.data === "string" && json.data) ||
    "";
  return audioBase64.trim();
}

export async function renderCoderoboNewTts(
  input: CoderoboNewTtsInput,
): Promise<CoderoboRenderResult> {
  const baseUrl = getBaseUrl();
  const endpoint = getEndpoint();
  const token = getToken();
  const text = normalizeText(input.text);
  const language = normalizeText(input.language || "en-US");
  const voiceType = normalizeText(input.voiceType || "AriaNeural");
  const gender = input.gender || "Female";
  const ratePercent = toIntegerString(input.ratePercent, -34);
  const pitchHz = toIntegerString(input.pitchHz, -7);
  const userIp = getUserIp();

  const requestUrl = resolveUrl(baseUrl, endpoint);
  const payload = {
    text,
    language,
    voice: voiceType,
    gender,
    rate: ratePercent,
    pitch: pitchHz,
    user_ip: userIp,
  };

  logRequest({
    url: requestUrl,
    payload,
    tokenPresent: Boolean(token),
    baseUrl,
    endpoint,
  });

  if (!endpoint) {
    return {
      ok: false,
      stage: "coderobo_render",
      message: "Missing CODEROBO_NEW_TTS_ENDPOINT",
      details: "Inspect new-tts.html network tab and set CODEROBO_NEW_TTS_ENDPOINT.",
    };
  }

  if (!token) {
    return {
      ok: false,
      stage: "coderobo_render",
      message: "Missing CODEROBO_JWT_TOKEN",
      details: "No bearer token available for Coderobo new TTS.",
    };
  }

  if (!text) {
    return {
      ok: false,
      stage: "request_validation",
      message: "Missing text",
      details: "text was empty",
    };
  }

  const formData = new FormData();
  formData.append("text", text);
  formData.append("language", language);
  formData.append("voice", voiceType);
  formData.append("rate", ratePercent);
  formData.append("pitch", pitchHz);
  formData.append("user_ip", userIp);

  const startResponse = await fetch(requestUrl, {
    method: "POST",
    headers: makeHeaders(token),
    body: formData,
  });

  const contentType = startResponse.headers.get("content-type") || "";
  const raw = Buffer.from(await startResponse.arrayBuffer());

  console.info("[coderobo:new-tts] start response", {
    httpStatus: startResponse.status,
    contentType,
    bytes: raw.length,
  });

  if (!startResponse.ok) {
    const body = contentType.includes("application/json") || contentType.includes("text")
      ? raw.toString("utf8")
      : `<${raw.length} bytes>`;
    return {
      ok: false,
      stage: "coderobo_render",
      message: `Coderobo new TTS start failed with HTTP ${startResponse.status}`,
      details: body || startResponse.statusText || "Unknown start failure",
    };
  }

  if (contentType.includes("audio/") || raw.length > 1000) {
    return { ok: true, audio: raw };
  }

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      stage: "coderobo_render",
      message: "Coderobo returned an unexpected non-audio response",
      details: raw.toString("utf8").slice(0, 1000),
    };
  }

  const initialJson = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  const directAudioBase64 = pickBase64(initialJson);
  if (directAudioBase64) {
    console.info("[coderobo:new-tts] direct base64 audio", {
      audioBytes: directAudioBase64.length,
    });
    return { ok: true, audio: Buffer.from(directAudioBase64, "base64") };
  }

  const directAudioUrl = pickAudioUrl(initialJson);
  if (directAudioUrl) {
    const audioResponse = await fetch(resolveUrl(baseUrl, directAudioUrl), {
      headers: makeHeaders(token),
    });
    if (!audioResponse.ok) {
      const body = await readBody(audioResponse);
      return {
        ok: false,
        stage: "coderobo_render",
        message: `Coderobo direct audio download failed with HTTP ${audioResponse.status}`,
        details: body || audioResponse.statusText || "Unknown audio download failure",
      };
    }
    return { ok: true, audio: Buffer.from(await audioResponse.arrayBuffer()) };
  }

  const taskId = (typeof initialJson.task_id === "string" && initialJson.task_id.trim()) || "";
  if (!taskId) {
    return {
      ok: false,
      stage: "coderobo_render",
      message: "Coderobo returned JSON without audio or task id",
      details: JSON.stringify(initialJson).slice(0, 1000),
    };
  }

  console.info("[coderobo:new-tts] task started", { taskId });

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(resolveUrl(baseUrl, `/task-status/${taskId}`), {
      headers: makeHeaders(token),
    });
    const statusContentType = statusResponse.headers.get("content-type") || "";
    const statusRaw = Buffer.from(await statusResponse.arrayBuffer());
    const statusText = statusRaw.toString("utf8");

    console.info("[coderobo:new-tts] status response", {
      taskId,
      httpStatus: statusResponse.status,
      contentType: statusContentType,
      body: statusText.slice(0, 500),
    });

    if (!statusResponse.ok) {
      continue;
    }

    let statusJson: Record<string, unknown> = {};
    try {
      statusJson = JSON.parse(statusText) as Record<string, unknown>;
    } catch {
      continue;
    }

    const status = String(statusJson.status || "").toLowerCase();
    if (status === "completed") {
      const finalResponse = await fetch(resolveUrl(baseUrl, `/status/${taskId}`), {
        headers: makeHeaders(token),
      });
      const finalContentType = finalResponse.headers.get("content-type") || "";
      const finalRaw = Buffer.from(await finalResponse.arrayBuffer());
      console.info("[coderobo:new-tts] final response", {
        taskId,
        httpStatus: finalResponse.status,
        contentType: finalContentType,
        bytes: finalRaw.length,
      });

      if (!finalResponse.ok) {
        const body = finalContentType.includes("application/json") || finalContentType.includes("text")
          ? finalRaw.toString("utf8")
          : `<${finalRaw.length} bytes>`;
        return {
          ok: false,
          stage: "coderobo_render",
          message: `Coderobo final status failed with HTTP ${finalResponse.status}`,
          details: body || finalResponse.statusText || "Unknown final status failure",
        };
      }

      if (finalContentType.includes("audio/") || finalRaw.length > 1000) {
        return { ok: true, audio: finalRaw };
      }

      try {
        const finalJson = JSON.parse(finalRaw.toString("utf8")) as Record<string, unknown>;
        const finalBase64 = pickBase64(finalJson);
        if (finalBase64) {
          return { ok: true, audio: Buffer.from(finalBase64, "base64") };
        }

        const finalAudioUrl = pickAudioUrl(finalJson);
        if (finalAudioUrl) {
          const audioResponse = await fetch(resolveUrl(baseUrl, finalAudioUrl), {
            headers: makeHeaders(token),
          });
          if (!audioResponse.ok) {
            const body = await readBody(audioResponse);
            return {
              ok: false,
              stage: "coderobo_render",
              message: `Coderobo audio fetch failed with HTTP ${audioResponse.status}`,
              details: body || audioResponse.statusText || "Unknown audio fetch failure",
            };
          }
          return { ok: true, audio: Buffer.from(await audioResponse.arrayBuffer()) };
        }
      } catch {
        /* fall through */
      }

      return {
        ok: false,
        stage: "coderobo_render",
        message: "Coderobo completed without audio payload",
        details: finalRaw.toString("utf8").slice(0, 1000),
      };
    }

    if (["failed", "cancelled", "expired"].includes(status)) {
      return {
        ok: false,
        stage: "coderobo_render",
        message: `Coderobo task ${status}`,
        details: JSON.stringify(statusJson).slice(0, 1000),
      };
    }
  }

  return {
    ok: false,
    stage: "coderobo_render",
    message: "Coderobo timed out waiting for audio",
    details: "Timed out after 60000ms",
  };
}
