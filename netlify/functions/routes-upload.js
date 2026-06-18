import { getStore } from '@netlify/blobs';
import { getUser as getNetlifyUser } from '@netlify/identity';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const MAX_GPX_BYTES = 4 * 1024 * 1024;

function cleanText(value, max = 120) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

async function resolveUser(req, context) {
  try {
    const user = await getNetlifyUser();
    if (user) return user;
  } catch {}
  return context?.clientContext?.user || null;
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
      ownerId: user.sub || user.id,
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
