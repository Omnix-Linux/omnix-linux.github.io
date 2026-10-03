# omnix-linux.github.io

The Omnix website, served at https://www.omnix-linux.com.

A static page (`index.html`) with a three.js shader in `coronal.js`. The oversized O uses [Coronal](https://fragcoord.xyz/s/3otcb9tt) by [@Xor](https://fragcoord.xyz/u/Xor), derived from [3D Fire](https://fragcoord.xyz/s/3zoe0vgo). The shader is expanded from Golf syntax into GLSL and rendered as a full-page background anchored to the oversized O, using a cropped WebGL surface, CSS-pixel coordinates, a 320k desktop / 160k mobile render-pixel budget, and adaptive quality. It runs at up to 30fps in the hero and 15fps with half the pixel budget below it. The smaller `mnix` lettering is persistent white text.

`coronal-poster.png` is a static render at shader time 6 seconds. It supplies the initial image and the fallback for reduced motion, unavailable WebGL, or context loss. To refresh it, render the shader at that time with a centered O in a square viewport and export the O against a transparent background. The logo and lettering resize with the layout.

Link previews use Open Graph and Twitter Card metadata in the static HTML head. `social-preview.png` is the public 1200 × 630 preview image; `social-preview.svg` is its editable source. After editing the SVG, render it to an opaque PNG at the same dimensions and update both files.

`shader-profile.json` is a versioned shader registry. `activeShader` selects an enum in `shaders` (currently `CORONAL`); each entry links its source, renderer, poster, reference screenshot, and measured geometry. Coordinates are normalized square artwork with a top-left origin. Coronal's isolated 560 × 560 render at time 6 seconds is saved in `coronal-reference.png`: the circular rim is approximately centered at (280, 280), radius 162 pixels. Thus `geometry.ring.center` is (0.5, 0.5), and `radius` is 162 / 560. Ring bounds exclude animated plumes; `effectBounds` covers the rendered glow.

`shader-layout.js` computes the shared text anchor in CSS pixels: `x = artworkLeft + (ring.center.x + ring.radius + clearance) × artworkSize`, `y = artworkTop + ring.center.y × artworkSize`. The suffix stays vertically centered at that point; its size scales with the ring diameter. Desktop/mobile clearance keeps it outside the rim and surrounding glow. Animated and static fallbacks use the same placement. GL samples use independent CSS-to-buffer conversion on both axes, preserving the circle at any render resolution.

To add another O shader, add an enum entry with its source links, renderer identifier, screenshot measurement, center, radius, derived ring bounds, shader origin, and effect bounds. Implement its renderer, then select its enum through `activeShader` or the canvas's `data-shader` attribute. An unsupported renderer keeps the positioned poster visible. Layout and render budgets are shared across entries. CSS provides the initial/no-JavaScript fallback until the registry loads.

Run the focused geometry checks with `node --test tests/shader-layout.test.cjs`.
