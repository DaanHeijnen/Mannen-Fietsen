import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const MAX_GPX_BYTES = 4 * 1024 * 1024;

function cleanText(value, max = 120) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}


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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await resolveUser(req, context);
  if (!user) return json({ error: 'Log in before uploading routes' }, 401);

  try {
    const body = await req.json();
    const gpx = String(body.gpx || '');
    if (!gpx.trim()) return json({ error: 'Missing GPX file' }, 400);
    if (!gpx.includes('<gpx')) return json({ error: 'This does not look like a GPX file' }, 400);
    if (Buffer.byteLength(gpx, 'utf8') > MAX_GPX_BYTES) return json({ error: 'GPX file is too large' }, 413);

    const id = `route_${crypto.randomUUID()}`;
    const fileKey = `routes/${id}.gpx`;
    const now = new Date().toISOString();
    const title = cleanText(body.title, 80) || 'Untitled route';
    const creatorName = cleanText(body.creatorName, 60) || user.email?.split('@')[0] || 'Unknown rider';
    const description = cleanText(body.description, 160);

    const route = {
      id,
      title,
      creatorName,
      description,
      ownerId: user.sub || user.id || user.email,
      ownerEmail: user.email || '',
      distanceKm: Number(body.distanceKm) || 0,
      createdAt: now,
      startLat: Number(body.startLat),
      startLon: Number(body.startLon),
      endLat: Number(body.endLat),
      endLon: Number(body.endLon),
      bounds: Array.isArray(body.bounds) ? body.bounds : null,
      pointCount: Number(body.pointCount) || 0,
      fileKey,
      visibility: 'public'
    };

    const files = getStore({ name: 'gpx-route-files', consistency: 'strong' });
    const index = getStore({ name: 'gpx-route-index', consistency: 'strong' });

    await files.set(fileKey, gpx, {
      metadata: { ownerId: route.ownerId, title: route.title, createdAt: now }
    });
    await index.set(`routes/${id}.json`, JSON.stringify(route), {
      metadata: { ownerId: route.ownerId, title: route.title, createdAt: now }
    });

    return json({ route }, 201);
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not upload route' }, 500);
  }
};
