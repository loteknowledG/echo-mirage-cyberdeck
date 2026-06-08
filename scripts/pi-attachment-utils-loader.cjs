/** Patch pi-web-ui pdfjs worker URLs for Next/webpack (import.meta.url breaks in bundled chunks). */
const WORKER_RE =
	/pdfjsLib\.GlobalWorkerOptions\.workerSrc = new URL\("pdfjs-dist\/build\/pdf\.worker\.min\.mjs", import\.meta\.url\)\.toString\(\);/g;
const WORKER_PATCH =
	'pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";';

module.exports = function piWebUiPdfjsLoader(source) {
	return source.replace(WORKER_RE, WORKER_PATCH);
};
