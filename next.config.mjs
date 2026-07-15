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
	"**/.venv-pi/**",
	"**/notebooks/**",
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

/** Webpack dev cannot resolve `node:` URIs when bundling instrumentation. */
function nodeProtocolAliases() {
	const builtins = [
		"assert",
		"buffer",
		"child_process",
		"crypto",
		"fs",
		"http",
		"https",
		"net",
		"os",
		"path",
		"readline",
		"stream",
		"url",
		"util",
		"zlib",
	];
	/** @type {Record<string, string>} */
	const aliases = { "node:fs/promises": "fs/promises" };
	for (const name of builtins) {
		aliases[`node:${name}`] = name;
	}
	return aliases;
}

const nextConfig = {
	devIndicators: false,
	distDir: process.env.CYBERDECK_NEXT_DIST_DIR || ".next",
	...(process.env.ECHO_MIRAGE_ELECTRON_BUILD === "1" ? { output: "standalone" } : {}),
	outputFileTracingRoot: projectRoot,
	outputFileTracingExcludes: {
		"*": [
			".venv-pi/**",
			"notebooks/**",
			"**/*.ipynb",
			"**/__pycache__/**",
		],
	},
	transpilePackages: [
		"realmorphism",
		"@eigenpal/docx-editor-react",
		"lit",
		"@lit/reactive-element",
		"lit-element",
		"lit-html",
		"@mariozechner/mini-lit",
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
		"/api/survey/capture": ["./node_modules/node-screenshots/**", "./node_modules/node-screenshots-*/**/*"],
		"/*": [
			"./assets/figlet-fonts/**",
			// Next standalone trace can omit hoisted/pnpm symlinks — force runtime deps for Electron.
			"./node_modules/@cursor/sdk*/**",
			"./node_modules/next/**",
			"./node_modules/@next/env/**",
			"./node_modules/@swc/helpers/**",
			"./node_modules/styled-jsx/**",
			"./node_modules/react/**",
			"./node_modules/react-dom/**",
		],
	},
	// Treat as external in the Node.js server runtime (native / optional / E2E-only).
	serverExternalPackages: [
		"@cursor/sdk",
		"@mariozechner/pi-ai",
		"@mariozechner/pi-agent-core",
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
		"@nut-tree-fork/nut-js",
		"node-screenshots",
		"windows-use",
		"node-screenshots",
		"ws",
	],
	webpack: (config, { dev, isServer }) => {
		// Avoid Windows EPERM readlink failures on Jupyter runtime / Pi venv symlinks.
		config.resolve.symlinks = false;
		if (process.env.CI && !dev) {
			config.parallelism = 1;
		}
		if (!dev) {
			config.cache = false;
		}

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
			...nodeProtocolAliases(),
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
		} else {
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
