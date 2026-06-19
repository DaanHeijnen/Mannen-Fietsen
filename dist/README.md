# Mannen Fietsplanner

Mannen Fietsplanner is a cycling weather and GPX route planner for the northern Netherlands. The app combines a cycling-focused map, current and future weather conditions, animated wind particles, route uploads, and shared GPX browsing so riders can choose a route based on the conditions.

The live site is intended for `fietsen.daanheijnen.nl`.

## Main features

- Full-screen Leaflet map optimized for cycling routes and cycle paths
- CyclOSM bicycle map tiles with deeper zoom support
- Search for a city or place and center the map there
- Current conditions for the selected place
- Forecast windows for full day, morning, afternoon and evening
- Expandable daily forecast cards with hourly rain chance and rain amount
- Animated wind particles that keep running over the map
- Clickable map pin that shows wind speed and gusts for that exact point
- Forecast-day mode with a button to return to current conditions
- Temperature, humidity, UV and hooikoorts/pollen values per forecast day
- Confidence score that takes rain, wind, gusts, temperature, humidity, UV and pollen into account
- GPX route upload, browsing, display, download and delete
- Netlify Identity login with a secret signup key
- Netlify Blobs storage for route metadata and GPX files

## Weather data

The app uses Open-Meteo and does not require an API key.

Forecast data includes:

```txt
temperature_2m
relative_humidity_2m
uv_index
precipitation_probability
precipitation
rain
showers
cloud_cover
wind_speed_10m
wind_direction_10m
wind_gusts_10m
weather_code
```

Pollen data is loaded from the Open-Meteo Air Quality API and is shown as a hooikoorts value. The app combines several pollen types into one simple risk label:

```txt
alder_pollen
birch_pollen
grass_pollen
mugwort_pollen
ragweed_pollen
```

## GPX routes

Logged-in users can upload GPX files. Uploaded routes are public in the route browser, so friends can browse the shared list and pick a ride.

Each route stores:

```txt
route title
creator name
description
distance
upload date
owner id
start location
end location
route bounds
point count
GPX file key
```

Users can:

```txt
upload their own GPX routes
view all shared GPX routes
view only their own GPX routes
show a route on the map
download any uploaded GPX route
delete only their own uploaded routes
```

When a GPX route is selected, the route is drawn on top of the map while the wind animation keeps running.

## Login and signup

The app uses Netlify Identity.

Users can only create an upload-enabled account through the app when they know the secret signup key:

```txt
Mannenavond
```

No custom JWT token or `user_setup_codes` environment variable is needed for this version. Netlify Identity handles authentication tokens automatically.

## Netlify Blobs

The app uses Netlify Blobs through Netlify Functions. The frontend does not write directly to Blobs.

Blob stores used:

```txt
gpx-route-files
```

Stores the actual `.gpx` files.

```txt
gpx-route-index
```

Stores one JSON metadata file per uploaded route.

## Netlify Functions

The route feature depends on these functions:

```txt
netlify/functions/routes-list.js
netlify/functions/routes-upload.js
netlify/functions/routes-get.js
netlify/functions/routes-delete.js
```

Function purpose:

```txt
routes-list.js    Lists uploaded route metadata
routes-upload.js  Checks login, validates GPX and stores the route
routes-get.js     Returns route metadata and GPX content
routes-delete.js  Checks ownership and deletes a user's own route
```

## Local development

Install dependencies:

```bash
npm install
```

Run the full Netlify local environment:

```bash
netlify dev
```

Use `netlify dev` when testing login, GPX uploads, route downloads, route deletion and Netlify Blobs.

The map and static UI can be viewed with a normal static server, but the route storage features need Netlify Functions.

## Deploying to Netlify

Build command:

```txt
npm run build
```

Publish directory:

```txt
dist
```

The `netlify.toml` file contains the deploy settings.

After changes that add or update Netlify Functions, dependencies or Blob behavior, trigger a fresh deploy. A deploy without cache can help if Netlify appears to reuse an old dependency install.

## Project structure

```txt
index.html
src/main.js
src/styles.css
public/manifest.webmanifest
public/sw.js
netlify/functions/routes-list.js
netlify/functions/routes-upload.js
netlify/functions/routes-get.js
netlify/functions/routes-delete.js
package.json
netlify.toml
README.md
```

## Notes

This is not meant to be a social network. The route feature is intentionally simple: users log in, upload GPX files, browse shared routes, download routes and choose a ride based on the current and predicted weather conditions.


## Latest map and route updates

- Selected GPX routes can now be hidden again with the **Hide route** button.
- The map uses a faster OpenStreetMap tile layer at high zoom levels to reduce blank/slow loading tiles.
- Wind particles are darker and more visible on the lighter cycling-style map.


## Hooikoorts / pollen

The app uses the Open-Meteo Air Quality API pollen forecast for alder, birch, grass, mugwort, olive and ragweed. Pollen is shown as a hay fever risk level, not just a raw total. The risk is based on the dominant pollen type, so grass pollen in June is treated more sensitively than a simple total count. If pollen data is outside the available pollen forecast horizon, the app shows `Unknown` instead of incorrectly showing `Low`.
