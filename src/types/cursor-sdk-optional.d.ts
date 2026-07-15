/** Optional peer — installed when Cursor Survey fallback is enabled. */
declare module "@cursor/sdk" {
  export const Agent: {
    prompt: (
      message: string,
      options: {
        apiKey: string;
        model: { id: string };
        local: { cwd: string };
      },
    ) => Promise<{ status?: string; result?: string }>;
  };
}
