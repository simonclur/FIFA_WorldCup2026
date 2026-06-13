export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== 'GET') {
      return withCors(jsonResponse({ error: 'Only GET is supported' }, 405));
    }

    try {
      if (path.startsWith('/fifa/')) {
        const target = new URL(`https://api.fifa.com/api/v3/${path.slice('/fifa/'.length)}`);
        copyQuery(url, target);
        return await proxyGet(target.toString(), request);
      }

      if (path.startsWith('/odds/the-odds-api/')) {
        const apiKey = String(env.THE_ODDS_API_KEY || '').trim();
        if (!apiKey) {
          return withCors(jsonResponse({ error: 'Missing THE_ODDS_API_KEY' }, 500));
        }

        const target = new URL(`https://api.the-odds-api.com/${path.slice('/odds/the-odds-api/'.length)}`);
        copyQuery(url, target);
        if (!target.searchParams.has('apiKey')) {
          target.searchParams.set('apiKey', apiKey);
        }
        return await proxyGet(target.toString(), request);
      }

      if (path.startsWith('/odds/oddspapi/')) {
        const apiKey = String(env.ODDSPAPI_KEY || '').trim();
        if (!apiKey) {
          return withCors(jsonResponse({ error: 'Missing ODDSPAPI_KEY' }, 500));
        }

        const target = new URL(`https://api.oddspapi.io/${path.slice('/odds/oddspapi/'.length)}`);
        copyQuery(url, target);
        if (!target.searchParams.has('apiKey')) {
          target.searchParams.set('apiKey', apiKey);
        }
        return await proxyGet(target.toString(), request);
      }

      return withCors(jsonResponse({ error: 'Unknown route' }, 404));
    } catch (error) {
      return withCors(jsonResponse({ error: String(error?.message || error) }, 502));
    }
  },
};

function copyQuery(fromUrl, toUrl) {
  fromUrl.searchParams.forEach((value, key) => {
    toUrl.searchParams.append(key, value);
  });
}

async function proxyGet(targetUrl, request) {
  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: request.headers.get('Accept') || 'application/json',
      'User-Agent': 'fifa-worldcup-2026-tracker-proxy',
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  return withCors(response);
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
