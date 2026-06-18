import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

export default async () => {
  try {
    const index = getStore({ name: 'gpx-route-index', consistency: 'strong' });
    const { blobs } = await index.list({ prefix: 'routes/' });
    const routes = [];

    await Promise.all(blobs.map(async blob => {
      try {
        const text = await index.get(blob.key, { consistency: 'strong', type: 'text' });
        if (!text) return;
        const route = JSON.parse(text);
        routes.push(route);
      } catch (err) {
        console.error('Could not read route metadata', blob.key, err);
      }
    }));

    routes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return json({ routes });
  } catch (err) {
    console.error(err);
    return json({ error: 'Could not list routes' }, 500);
  }
};
