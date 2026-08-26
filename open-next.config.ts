// The adapter is installed by the staging deploy workflow rather than the app lockfile.
// @ts-expect-error Cloudflare staging dependency is injected in CI.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
