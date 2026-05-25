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
	// Treat as external in the Node.js server runtime
	serverExternalPackages: [
		"google-photos-album-image-url-fetch",
	],
	webpack: (config, { dev }) => {
		if (dev) {
			config.experiments = {
				...config.experiments,
				lazyCompilation: {
					entries: false,
					imports: true,
				},
			};
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
