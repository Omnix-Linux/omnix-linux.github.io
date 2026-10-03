# omnix-linux.github.io

The Omnix website, served at https://www.omnix-linux.com.

A static page (`index.html`) with a three.js shader in `coronal.js`. The oversized O uses [Coronal](https://fragcoord.xyz/s/3otcb9tt) by [@Xor](https://fragcoord.xyz/u/Xor), derived from [3D Fire](https://fragcoord.xyz/s/3zoe0vgo). The shader is expanded from Golf syntax into GLSL and rendered as a full-page background anchored to the oversized O, using a cropped WebGL surface, CSS-pixel coordinates, a 320k desktop / 160k mobile render-pixel budget, and adaptive quality. It runs at up to 30fps in the hero and 15fps with half the pixel budget below it. The smaller `mnix` lettering is persistent white text.

`coronal-poster.png` is a static render at shader time 6 seconds. It supplies the initial image and the fallback for reduced motion, unavailable WebGL, or context loss. To refresh it, render the shader at that time with a centered O in a square viewport and export the O against a transparent background. The logo and lettering resize with the layout.

Link previews use Open Graph and Twitter Card metadata in the static HTML head. `social-preview.png` is the public 1200 × 630 preview image; `social-preview.svg` is its editable source. After editing the SVG, render it to an opaque PNG at the same dimensions and update both files.

`shader-profile.json` is the geometry and layout contract for the O. Coordinates are normalized to a square reference artwork (560 × 560 for Coronal), with the origin at the top left. `geometry.letter.center` anchors the O, `geometry.letter.bounds` describes its main circular body, and `geometry.effectBounds` includes the animated plumes/glow. The letter bounds are authored conservative bounds; they deliberately exclude transient plumes. Suffix placement uses the letter's right bound plus the configured gap; font size scales with the letter's height. The GL surface is the effect bounds intersected with the viewport, with independent CSS-to-buffer conversion on both axes to preserve the circle at any render resolution.

When substituting another O shader, supply its center, letter bounds, effect bounds and shader origin in a matching profile, update the canvas's `data-shader-profile` path, and port its GLSL. Placement and render budgets come from the JSON. CSS provides the initial/no-JavaScript fallback; the profile takes over as soon as it loads.
