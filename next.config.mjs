import { createRequire } from "module";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function resolveRealmorphismPackageRoot() {
	const sibling = path.resolve(projectRoot, "../realmorphism");
	if (existsSync(path.join(sibling, "package.json"))) {
		return sibling;
	}
	return path.dirname(require.resolve("realmorphism/package.json"));
}

const realmorphismPackageRoot = resolveRealmorphismPackageRoot();
const realmorphismRoot = path.join(realmorphismPackageRoot, "src");
const realmorphismWheelCss = path.join(
	realmorphismRoot,
	"components/ui/float-wheel-picker.module.css",
);
const echoWheelCss = path.join(
	projectRoot,
	"src/components/cyberdeck/float-wheel-picker.module.css",
);
const pdfjsDistRoot = path.join(projectRoot, "node_modules/pdfjs-dist");
const piWebUiPdfjsLoader = path.join(
	projectRoot,
	"scripts/pi-attachment-utils-loader.cjs",
);

/** @type {import('next').NextConfig} */
const RUNTIME_WATCH_IGNORE = [
	"**/.memory/**",
	"**/.atlas/**",
	"**/.powerfist/**",
	"**/.cursor/**",
	"**/.tmp/**",
	"**/data/**",
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
	transpilePackages: [
		"realmorphism",
		"@eigenpal/docx-editor-react",
		"lit",
		"@lit/reactive-element",
		"lit-element",
		"lit-html",
		"@mariozechner/mini-lit",
		"@mariozechner/pi-agent-core",
		"@mariozechner/pi-ai",
		"@mariozechner/pi-web-ui",
	],
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
	outputFileTracingIncludes: {
		"/api/glyph/*": ["./assets/figlet-fonts/**"],
		"/*": ["./assets/figlet-fonts/**"],
	},
	// Treat as external in the Node.js server runtime (native / optional / E2E-only).
	serverExternalPackages: [
		"figlet",
		"google-photos-album-image-url-fetch",
		"md-to-pdf",
		"puppeteer",
		"playwright",
		"playwright-core",
		"just-bash",
		"@mongodb-js/zstd",
		"sql.js",
		"@napi-rs/canvas",
		"gif-frames",
		"gif-encoder-2",
		"node-pty",
	],
	webpack: (config, { dev, isServer }) => {
		if (isServer) {
			const playwrightExternals = ["playwright", "playwright-core"];
			if (Array.isArray(config.externals)) {
				config.externals.push(...playwrightExternals);
			} else if (config.externals) {
				config.externals = [config.externals, ...playwrightExternals];
			} else {
				config.externals = playwrightExternals;
			}
		}

		config.resolve.alias = {
			...config.resolve.alias,
			[realmorphismWheelCss]: echoWheelCss,
			"realmorphism/styles/kit.css": path.join(
				realmorphismPackageRoot,
				"src/styles/realmorphism-kit.css",
			),
			// pi-web-ui pins pdfjs-dist@5.4.x whose build/pdf.mjs is pre-webpacked and breaks under Next 16.
			"pdfjs-dist": pdfjsDistRoot,
		};

		config.module.rules.push(
			{
				test: /[\\/]pdfjs-dist[\\/].*\.mjs$/,
				type: "javascript/auto",
				resolve: {
					fullySpecified: false,
				},
			},
			{
				enforce: "pre",
				test: /[\\/]pi-web-ui[\\/]dist[\\/].+\.js$/,
				loader: piWebUiPdfjsLoader,
			},
		);

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
