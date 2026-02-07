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

  try {
    const response = await fetch(TARGET_URL, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; NostalgiaModernaBot/1.0; +https://nostalgia-moderna.example)",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true,
      },
    });

    status = response.status;

    if (response.ok) {
      ok = true;
      count = await countResults(response);
    }
  } catch {
    ok = false;
  }

  const hide = ok && count < HIDE_THRESHOLD;

  const state = {
    hide,
    count,
    ok,
    status,
    checkedAt: now,
  };

  await env.STATE.put(STATE_KEY, JSON.stringify(state));
}

async function countResults(response) {
  let count = 0;
  const fallback = response.clone();

  const rewriter = new HTMLRewriter().on("li.ui-search-layout__item", {
    element() {
      count += 1;
    },
  });

  await rewriter.transform(response).text();

  if (count > 0) return count;

  const text = await fallback.text();
  const matches = text.match(/ui-search-layout__item/g);
  return matches ? matches.length : 0;
}
