import { getStore } from '@netlify/blobs';
import { getUser as getNetlifyUser } from '@netlify/identity';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

async function resolveUser(req, context) {
  try {
    const user = await getNetlifyUser();
    if (user) return user;
  } catch {}
  return context?.clientContext?.user || null;
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

    const ownerId = user.sub || user.id;
    const index = getStore({ name: 'gpx-route-index', consistency: 'strong' });
    const files = getStore({ name: 'gpx-route-files', consistency: 'strong' });
    const metaKey = `routes/${id}.json`;
    const metaText = await index.get(metaKey, { consistency: 'strong', type: 'text' });
    if (!metaText) return json({ error: 'Route not found' }, 404);

    const route = JSON.parse(metaText);
    if (route.ownerId !== ownerId) return json({ error: 'You can only delete your own uploaded routes' }, 403);

    if (route.fileKey) await files.delete(route.fileKey);
    await index.delete(metaKey);

    return json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not delete route' }, 500);
  }
};
