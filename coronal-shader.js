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
  // Match the thin white rim on the SDR WebGL fallback.
  float rimDistance = abs(length(uv) - 0.57857143);
  float rimWidth = max(0.0035, 1.4 * max(uSurfaceSize.x / uBufferSize.x,
    uSurfaceSize.y / uBufferSize.y) / uDiameter);
  float core = exp(-pow(rimDistance / rimWidth, 2.));
  float halo = 0.06 * exp(-pow(rimDistance / 0.025, 2.));
  color = mix(color, vec3(1.5), core) + vec3(halo * (1. - core));
  float alpha = 1. - smoothstep(1.1, 1.5, length(uv));
  // Feather every crop edge, including edges clipped by the mobile viewport.
  vec2 edge = min(pixel, uSurfaceSize - pixel);
  float edgeStart = max(1., max(uSurfaceSize.x / uBufferSize.x, uSurfaceSize.y / uBufferSize.y));
  float feather = max(edgeStart + 1., clamp(uDiameter * 0.08, 12., 48.));
  alpha *= smoothstep(edgeStart, feather, edge.x) * smoothstep(edgeStart, feather, edge.y);
  gl_FragColor = vec4(color * alpha, alpha);
}`;
