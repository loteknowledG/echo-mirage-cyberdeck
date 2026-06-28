/** True when this Next.js process is embedded in the packaged Electron shell. */
export function isDesktopShellProcess(): boolean {
  return process.env.ECHO_MIRAGE_DESKTOP_SHELL === "1";
}

export function getDesktopShellStatus(): {
  ok: true;
  shell: boolean;
  running: true;
} {
  return {
    ok: true,
    shell: isDesktopShellProcess(),
    running: true,
  };
}
