# OrlandoPlanner attraction icons — edition 2

Redrawn with clearer silhouettes and larger default artwork (32px inside a 48px CSS circle). All IDs and paths are unchanged from edition 1.

50 individual SVG assets covering the complete top-50 list in the supplied “Orlando Attractions List” conversation. Names and grouping preserve that planning list; this package is not a current operating-status directory. Each entry has its own icon file and distinct drawing.

## Install

Copy the included `public/` folder into your repository root, merging with your existing public directory. The resulting location is `public/icons/attractions/`. No build step, runtime library or network request to a third party is required.

Open `public/icons/attractions/preview.html` directly to browse all icons, or serve it at `/icons/attractions/preview.html`. The preview works offline. It can be omitted from production.

## Use

Load the stylesheet in your page or application layout:

```html
<link rel="stylesheet" href="/icons/attractions/attractions.css">
<span class="attraction-icon attraction-icon--disney">
  <img src="/icons/attractions/disney/magic-kingdom.svg" alt="">
</span>
<span>Magic Kingdom Park</span>
```

The manifest has `groups` (display names and default colours) and an `attractions` array. Each attraction supplies `id`, `name`, `group`, `type`, `motif` and `icon`. IDs are unique descriptive slugs; map these to any existing database IDs during integration. Paths assume the application is hosted at `/`; prepend your deployment base path if it is hosted in a subdirectory.

```js
const response = await fetch('/icons/attractions/manifest.json');
if (!response.ok) throw new Error('Unable to load attraction icons');
const { attractions } = await response.json();
const attractionById = Object.fromEntries(attractions.map(a => [a.id, a]));
```

Example React component (pass an attraction from the manifest):

```jsx
function AttractionIcon({ attraction }) {
  return (
    <span className={`attraction-icon attraction-icon--${attraction.group}`}>
      <img src={attraction.icon} alt="" />
    </span>
  );
}
```

Use `alt=""` when a visible attraction name accompanies the icon. For a standalone meaningful image, set `alt` to the attraction name. An icon-only button needs an accessible name on the button. These recognisable pictograms indicate a subject or activity, so keep visible names for reliable attraction identification.

## Colour and size

All artwork is transparent with a fixed white stroke. Background circles are entirely CSS; no background shapes or resort colours are embedded in the SVGs. Override variables after the stylesheet:

```css
:root {
  --attraction-color-disney: #1268b3;
  --attraction-color-universal: #6942bb;
  --attraction-color-legoland: #bd8a00;
  --attraction-icon-size: 48px;
  --attraction-icon-art-size: 32px;
}
```

Defaults follow the agreed blue / purple / teal / yellow / green / pink / orange palette. The yellow is a deeper ochre to keep white lines clearer at small sizes. Nature has its own green; rides and indoor attractions use purple variants. These are project palette choices, not official brand colours. Edit CSS to change the display; manifest colours are descriptive defaults and must be updated separately if you need them to mirror overrides.

## Artwork specification

- `width="32"`, `height="32"`, `viewBox="0 0 32 32"` on every file.
- `fill="none"`, `stroke="#fff"`, `stroke-width="2"`.
- Round line caps and joins, transparent canvas, no fonts or external dependencies.
- Original pictograms of familiar subjects; no traced logos, branded characters, branded castle profiles, themed volcano profiles or signature architecture. A conventional castle and simple cone-shaped volcano are used rather than resort landmark outlines.
- Attraction names are identifying metadata only. This is an unofficial icon collection, with no implied affiliation or endorsement.

## Folders

`disney`, `universal`, `seaworld`, `legoland`, `busch-gardens`, `wildlife`, `science`, `icon-park`, `rides`, `indoor`, `nature`.

The Winter Haven family park grouping and ICON Park / International Drive grouping follow the supplied list rather than asserting common ownership. No original application repository or existing attraction ID schema was supplied, so the package is ready to copy and integrate, without changes to application code.
