const TARGET_URL = "https://lista.mercadolivre.com.br/_CustId_238205366";
const HIDE_THRESHOLD = 20;
const STATE_KEY = "ml_hide_state";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === "/healthz") {
			return new Response("ok", {
				headers: { "content-type": "text/plain; charset=UTF-8" },
			});
		}

		const state = await getState(env);
		const hide = state?.hide === true;

		const assetResponse = await env.ASSETS.fetch(request);
		const contentType = assetResponse.headers.get("content-type") || "";

		if (!hide || !contentType.includes("text/html")) {
			return assetResponse;
		}

		const html = await assetResponse.text();
		const hiddenHtml = injectHideStyle(html);

		const headers = new Headers(assetResponse.headers);
		headers.delete("content-length");
		headers.set("cache-control", "no-store");

		return new Response(hiddenHtml, {
			status: assetResponse.status,
			headers,
		});
	},

	async scheduled(event, env, ctx) {
		ctx.waitUntil(updateState(env));
	},
};

async function getState(env) {
	try {
		return await env.STATE.get(STATE_KEY, { type: "json" });
	} catch {
		return null;
	}
}

function injectHideStyle(html) {
	const style = "<style id=\"ml-hide\">body > * { display: none !important; }</style>";
	if (html.includes("</head>")) {
		return html.replace("</head>", `${style}</head>`);
	}
	return `${style}${html}`;
}

async function updateState(env) {
	const now = new Date().toISOString();
	let count = 0;
	let ok = false;
	let status = 0;
	let found = false;

	try {
		const response = await fetch(TARGET_URL, {
			headers: {
				"user-agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
				"accept":
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
				"accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
				"cache-control": "no-cache",
				"pragma": "no-cache",
				"upgrade-insecure-requests": "1",
			},
			cf: {
				cacheTtl: 0,
				cacheEverything: false,
			},
		});

		status = response.status;

		if (response.ok) {
			ok = true;
			const result = await countResults(response);
			found = result.found;
			count = result.count;
		}
	} catch {
		ok = false;
	}

	const hide = !ok || !found || count < HIDE_THRESHOLD;

	const state = {
		hide,
		count,
		found,
		ok,
		status,
		checkedAt: now,
	};

	// await env.STATE.put(STATE_KEY, JSON.stringify(state));
}

async function countResults(response) {
	const text = await response.text();
	const match = text.match(
		/quantity-results\"\>(\d+) resultados/i
	);

	if (!match) {
		return { found: false, count: 0 };
	}

	return { found: true, count: Number(match[1]) };
}
