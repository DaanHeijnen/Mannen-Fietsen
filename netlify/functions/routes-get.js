import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

export default async req => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id || !/^route_[a-zA-Z0-9_-]+$/.test(id)) return json({ error: 'Invalid route id' }, 400);

    const index = getStore({ name: 'gpx-route-index', consistency: 'strong' });
    const files = getStore({ name: 'gpx-route-files', consistency: 'strong' });
    const metaText = await index.get(`routes/${id}.json`, { consistency: 'strong', type: 'text' });
    if (!metaText) return json({ error: 'Route not found' }, 404);
    const route = JSON.parse(metaText);
    const gpx = await files.get(route.fileKey, { consistency: 'strong', type: 'text' });
    if (!gpx) return json({ error: 'GPX file not found' }, 404);

    return json({ route, gpx });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not load route' }, 500);
  }
};
