// Ship icon helpers. Icons are inline SVG, so no image files are needed.

function shipIcon(colour) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<path d="M16 2 L24 26 L16 21 L8 26 Z" fill="' + colour + '" stroke="white" stroke-width="1.5"/>' +
    '</svg>';
  return "data:image/svg+xml;base64," + btoa(svg);
}

const ICONS = {
  stationary: shipIcon("#ffa726"),
  moving: shipIcon("#26c6da")
};

// Icon points "up" (north). Cesium rotates counter-clockwise, compass headings go
// clockwise, so we negate the heading.
function headingToRotation(headingDeg) {
  return Cesium.Math.toRadians(-(headingDeg || 0));
}

// Port colour from the congestion index (same thresholds as the Python code).
function congestionColour(index) {
  if (index === null || index === undefined) return Cesium.Color.GREY;
  if (index < 0.8) return Cesium.Color.fromCssColorString("#2e9e5b");
  if (index <= 1.2) return Cesium.Color.fromCssColorString("#e0a526");
  return Cesium.Color.fromCssColorString("#d64545");
}
