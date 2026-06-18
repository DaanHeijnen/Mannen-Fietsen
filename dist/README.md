# CycleCast Noord

A Windy-like cycling weather planner for the northern Netherlands. It focuses on the two things that matter most for planning a ride: **rain** and **wind**.

It uses the free Open-Meteo Forecast API and does not require an API key.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite shows, usually:

```txt
http://localhost:5173/
```

## Deploy to Netlify

1. Upload this folder to GitHub.
2. In Netlify, create a new site from that repository.
3. Use these settings:

```txt
Build command: npm run build
Publish directory: dist
```

The `netlify.toml` file already contains these settings.

## What it does

- Full-screen Windy-like map UI
- Northern Netherlands map scope
- Animated wind particles
- Daily humidity, temperature and UV indicators
- Rain and wind overlays
- City/zone picker
- Best cycling windows for the next 10 days
- Morning / afternoon / evening / full-day forecast windows
- Cycling score based on rain probability, rain amount, wind speed and wind gusts
- Confidence label based on forecast horizon and forecast stability
- Open-Meteo attribution included

## Files

```txt
index.html
src/main.js
src/styles.css
package.json
netlify.toml
README.md
```

## Notes

This is not a global Windy clone. It is intentionally narrowed to cycling conditions in the top half of the Netherlands. That makes the app simpler, faster and more useful for the exact decision: “When should I go cycling next week?”

## GPX route uploads

This version adds a GPX route browser and upload flow.

Required Netlify setup:

1. Enable Netlify Identity for the site.
2. Keep the site connected to Netlify so Functions can run.
3. Install dependencies with `npm install`.
4. Test locally with `netlify dev`, not only `npm run dev`, because the route feature uses Netlify Functions and Netlify Blobs.

The app uses:

```txt
Netlify Identity: user accounts
Netlify Functions: safe upload/list/read endpoints
Netlify Blobs: GPX file storage and route metadata
Leaflet: route overlay on the existing weather map
```

Function endpoints:

```txt
GET  /.netlify/functions/routes-list
POST /.netlify/functions/routes-upload
GET  /.netlify/functions/routes-get?id=route_id
```

Blob stores used:

```txt
gpx-route-files
gpx-route-index
```

## Latest GPX route update

- Users can delete their own uploaded GPX routes.
- When a route is selected on mobile, the routes panel closes automatically so the selected route is visible on the map.
