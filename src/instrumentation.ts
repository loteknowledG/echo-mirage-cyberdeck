export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ECHO_MIRAGE_POWERFIST_WS === "0") return;

  const { ensurePowerfistWsServer } = await import("@/lib/server/powerfist-ws-server.server");
  await ensurePowerfistWsServer();
}
