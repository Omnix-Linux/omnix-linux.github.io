# omnix-linux.github.io

The Omnix website, served at https://www.omnix-linux.com.

A static page (`index.html`) with a three.js shader in `coronal.js`. The oversized O uses [Coronal](https://fragcoord.xyz/s/3otcb9tt) by [@Xor](https://fragcoord.xyz/u/Xor), derived from [3D Fire](https://fragcoord.xyz/s/3zoe0vgo). The shader is expanded from Golf syntax into GLSL and rendered as a full-page background anchored to the oversized O, with adaptive resolution and a 30fps cap. The smaller `mnix` lettering is persistent white text.

`coronal-poster.png` is a static render at shader time 6 seconds. It supplies the initial image and the fallback for reduced motion, unavailable WebGL, or context loss. To refresh it, render the shader at that time with a centered O in a square viewport and export the O against a transparent background. The logo and lettering resize with the layout.

Link previews use Open Graph and Twitter Card metadata in the static HTML head. `social-preview.png` is the public 1200 × 630 preview image; `social-preview.svg` is its editable source. After editing the SVG, render it to an opaque PNG at the same dimensions and update both files.
