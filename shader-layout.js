/* Shared circle geometry for all O shaders. Units are normalized square artwork
 * coordinates; CSS pixels are used only after applying artwork.size. */
(function (root) {
  function ringAnchor(ring, artwork, clearance) {
    var radius = ring.radius * artwork.size;
    var centerX = artwork.left + ring.center.x * artwork.size;
    var centerY = artwork.top + ring.center.y * artwork.size;
    return {
      centerX: centerX, centerY: centerY, radius: radius,
      x: centerX + radius + clearance * artwork.size,
      y: centerY
    };
  }
  var api = { ringAnchor: ringAnchor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShaderLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
