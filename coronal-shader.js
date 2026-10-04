/* Coronal by @Xor: https://fragcoord.xyz/s/3otcb9tt
 * Derived from 3D Fire: https://fragcoord.xyz/s/3zoe0vgo
 * Expanded from Golf into GLSL. Shared by the worker renderer.
 */
self.CoronalShader = `uniform vec2 uCenter, uSurfaceSize, uBufferSize; uniform float uDiameter, uTime;
void main() {
  vec2 pixel = gl_FragCoord.xy / uBufferSize * uSurfaceSize;
  vec2 uv = 2. * (pixel - uCenter) / uDiameter;
  if (length(uv) > 1.5) { gl_FragColor = vec4(0.); return; }
  vec3 ray = normalize(vec3(uv, -1.));
  vec3 glow = vec3(0.);
  float z = 2.;
  for (int i = 0; i < 40; i++) {
    vec3 p = z * ray, original = p;
    float frequency = 2.;
    for (int j = 0; j < 6; j++) {
      frequency *= 2.;
      p += sin(p.zxy * frequency + z - uTime) / frequency;
    }
    z += abs(1. - length(p.xy)) / 3.;
    glow += (1.1 - cos(p)) / (z * z * max(abs(length(original.xy) - 1.), 0.001));
  }
  vec3 color = 1. - 2. / (exp(2. * min(glow / 30., vec3(10.))) + 1.);
  // A quiet white rim keeps the O readable through the moving corona.
  float rimDistance = abs(length(uv) - 0.57857143);
  float rim = 3.0 * exp(-pow(rimDistance / 0.0035, 2.))
    + 0.24 * exp(-pow(rimDistance / 0.025, 2.));
  // Add overbright white light before the display clamps the thin core.
  // The wider halo preserves its bloom on standard SDR browser canvases.
  color += vec3(rim);
  float alpha = 1. - smoothstep(1.1, 1.5, length(uv));
  gl_FragColor = vec4(color * alpha, alpha);
}`;
