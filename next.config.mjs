import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const realmorphismPackageRoot = path.resolve(projectRoot, "../realmorphism");
const realmorphismRoot = path.join(realmorphismPackageRoot, "src");
const realmorphismWheelCss = path.join(
	realmorphismRoot,
	"components/ui/float-wheel-picker.module.css",
);
const echoWheelCss = path.join(
	projectRoot,
	"src/components/cyberdeck/float-wheel-picker.module.css",
);

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
	distDir: process.env.CYBERDECK_NEXT_DIST_DIR || ".next",
	transpilePackages: ["realmorphism"],
	allowedDevOrigins: ["127.0.0.1", "localhost"],
	turbopack: {
		resolveAlias: {
			[realmorphismWheelCss]: echoWheelCss,
			"realmorphism/styles/kit.css": path.join(
				realmorphismPackageRoot,
				"src/styles/realmorphism-kit.css",
			),
		},
	},
	experimental: {
		webpackMemoryOptimizations: true,
	},
	// Treat as external in the Node.js server runtime (native / optional / E2E-only).
	serverExternalPackages: [
		"google-photos-album-image-url-fetch",
		"md-to-pdf",
		"puppeteer",
		"playwright",
		"playwright-core",
		"just-bash",
		"@mongodb-js/zstd",
	],
	webpack: (config, { dev }) => {
		config.resolve.alias = {
			...config.resolve.alias,
			[realmorphismWheelCss]: echoWheelCss,
			"realmorphism/styles/kit.css": path.join(
				realmorphismPackageRoot,
				"src/styles/realmorphism-kit.css",
			),
		};

		config.ignoreWarnings = [
			...(config.ignoreWarnings ?? []),
			{
				module: /@mariozechner[\\/]pi-ai[\\/]dist[\\/]providers[\\/]openai-codex-responses\.js/,
				message: /Critical dependency: the request of a dependency is an expression/,
			},
		];

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
