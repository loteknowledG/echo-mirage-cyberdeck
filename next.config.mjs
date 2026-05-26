/** @type {import('next').NextConfig} */
const RUNTIME_WATCH_IGNORE = [
	"**/.memory/**",
	"**/.atlas/**",
	"**/.powerfist/**",
	"**/logs/**",
	"**/generated/**",
	"**/screenshots/**",
	"**/audio/**",
	"**/spectrograms/**",
	"**/exports/**",
	"**/dist/**",
	"**/tmp/**",
];

function normalizeWebpackWatchIgnored(ignored) {
	if (ignored == null) return [];
	const list = Array.isArray(ignored) ? ignored : [ignored];
	return list.filter((item) => typeof item === "string" && item.length > 0);
}

const nextConfig = {
	devIndicators: false,
	allowedDevOrigins: ["127.0.0.1", "localhost"],
	turbopack: {},
	experimental: {
		webpackMemoryOptimizations: true,
	},
	// Treat as external in the Node.js server runtime
	serverExternalPackages: [
		"google-photos-album-image-url-fetch",
		"md-to-pdf",
		"puppeteer",
	],
	webpack: (config, { dev }) => {
		if (dev) {
			config.parallelism = 1;
			// LazyCompilationBackend ECONNRESET on Windows when warm + Electron race the dev server.
			if (config.experiments?.lazyCompilation) {
				config.experiments.lazyCompilation = false;
			}
			config.watchOptions = {
				...(config.watchOptions ?? {}),
				ignored: [
					...normalizeWebpackWatchIgnored(config.watchOptions?.ignored),
					...RUNTIME_WATCH_IGNORE,
				],
			};
		}
		return config;
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "models.dev",
			},
		],
	},
};

export default nextConfig;
