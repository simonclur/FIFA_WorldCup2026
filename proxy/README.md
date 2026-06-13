# Proxy Setup (Cloudflare Worker)

This folder contains a server-side proxy template so you can publish the tracker publicly without exposing API keys.

## Routes exposed by the worker

- `/fifa/*` -> proxies to `https://api.fifa.com/api/v3/*`
- `/odds/the-odds-api/*` -> proxies to `https://api.the-odds-api.com/*` and injects `THE_ODDS_API_KEY`
- `/odds/oddspapi/*` -> proxies to `https://api.oddspapi.io/*` and injects `ODDSPAPI_KEY`

## Quick start

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Set Worker secrets:
   - `wrangler secret put THE_ODDS_API_KEY`
   - `wrangler secret put ODDSPAPI_KEY`
3. Deploy:
   - `wrangler deploy`
4. Open the tracker with:
   - `https://<your-pages-domain>/index.html?proxyBase=https://<your-worker-domain>`

## Notes

- The frontend does not require browser API keys when `proxyBase` is set.
- Keep the worker on HTTPS.
- You can restrict `Access-Control-Allow-Origin` in `cloudflare-worker.js` to your Pages domain.
