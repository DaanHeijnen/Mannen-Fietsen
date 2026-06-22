import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});


function userIdentityKeys(user) {
  return [user?.sub, user?.id, user?.email].filter(Boolean).map(String);
}

function normaliseUserFromPayload(payload) {
  if (!payload) return null;
  const id = payload.sub || payload.id || payload.email || '';
  const email = payload.email || payload?.user_metadata?.email || '';
  if (!id && !email) return null;

  // Do not accept clearly expired Identity tokens. This keeps the endpoint protected,
  // while avoiding the brittle extra Netlify Identity server-side lookup that was failing in deploy previews.
  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) return null;

  return {
    id: id || email,
    sub: payload.sub || id || email,
    email,
    user_metadata: payload.user_metadata || {},
    app_metadata: payload.app_metadata || {}
  };
}

async function resolveUser(req, context) {
  const contextUser = context?.clientContext?.user || context?.identityContext?.user || null;
  if (contextUser) return contextUser;

  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return normaliseUserFromPayload(decodeJwtPayload(match[1]));
  } catch (err) {
    console.warn('Could not decode Identity token:', err?.message || err);
    return null;
  }
}

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1];
  if (!part) return null;
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
}


export default async (req, context) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);

  const user = await resolveUser(req, context);
  if (!user) return json({ error: 'Log in before deleting routes' }, 401);

  try {
    const body = req.method === 'DELETE'
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await req.json();
    const id = String(body.id || '');
    if (!id || !/^route_[a-zA-Z0-9_-]+$/.test(id)) return json({ error: 'Invalid route id' }, 400);

    const allowedOwnerKeys = userIdentityKeys(user);
    const index = getStore({ name: 'gpx-route-index', consistency: 'strong' });
    const files = getStore({ name: 'gpx-route-files', consistency: 'strong' });
    const metaKey = `routes/${id}.json`;
    const metaText = await index.get(metaKey, { consistency: 'strong', type: 'text' });
    if (!metaText) return json({ error: 'Route not found' }, 404);

    const route = JSON.parse(metaText);
    const ownsRoute = allowedOwnerKeys.includes(String(route.ownerId || '')) || (route.ownerEmail && allowedOwnerKeys.includes(String(route.ownerEmail)));
    if (!ownsRoute) return json({ error: 'You can only delete your own uploaded routes' }, 403);

    if (route.fileKey) await files.delete(route.fileKey);
    await index.delete(metaKey);

    return json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not delete route' }, 500);
  }
};
