Nostalgia Moderna static site + Cloudflare Worker.

Worker behavior:
- Crawls `https://lista.mercadolivre.com.br/_CustId_238205366` every hour.
- If results are less than 20, hides all HTML content on the home page.

Setup:
1. Create a KV namespace:
   - `wrangler kv:namespace create STATE`
2. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with the ID.
3. Deploy:
   - `wrangler deploy`
