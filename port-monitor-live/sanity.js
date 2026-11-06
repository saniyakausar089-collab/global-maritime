/**
 * AIS Sanity Filters
 * Drops corrupt packets, invalid coordinates, impossible speeds, and normalizes unavailable codes.
 */

export const filterMetrics = {
  totalReceived: 0,
  invalidMmsi: 0,
  missingCoords: 0,
  outOfBounds: 0,
  zeroCoords: 0,
  excessiveSpeed: 0,
  staleRecord: 0,
  validPositionIngested: 0,
  validStaticIngested: 0,
};

/**
 * Validates and sanitizes a position report packet.
 */
export function sanitizePosition(msg, meta = {}) {
  filterMetrics.totalReceived++;

  const mmsi = Number(meta.MMSI || msg.MMSI || msg.UserID);
  // Rule: Non-9-digit MMSI
  if (!mmsi || mmsi < 100000000 || mmsi > 999999999) {
    filterMetrics.invalidMmsi++;
    return null;
  }

  const rawLat = msg.Latitude ?? meta.latitude;
  const rawLon = msg.Longitude ?? meta.longitude;

  if (rawLat == null || rawLon == null || Number.isNaN(rawLat) || Number.isNaN(rawLon)) {
    filterMetrics.missingCoords++;
    return null;
  }

  const lat = Number(rawLat);
  const lon = Number(rawLon);

  // Rule: invalid lat/lon (lat > 90, lon > 180)
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    filterMetrics.outOfBounds++;
    return null;
  }

  // Rule: exactly (0, 0)
  if (lat === 0 && lon === 0) {
    filterMetrics.zeroCoords++;
    return null;
  }

  // Rule: SOG > 50 kn (AIS unavailable code = 102.3 kn)
  let rawSog = msg.Sog ?? msg.SpeedOverGround;
  let sog = null;
  if (rawSog != null) {
    const s = Number(rawSog);
    if (s >= 102.3 || s > 50) {
      filterMetrics.excessiveSpeed++;
      sog = 0; // Handled as unavailable/stationary rather than corrupting kinematics
    } else if (s >= 0) {
      sog = s;
    }
  }

  // Rule: COG 'not available' (360) handled as null
  let rawCog = msg.Cog ?? msg.CourseOverGround;
  let cog = null;
  if (rawCog != null) {
    const c = Number(rawCog);
    if (c >= 0 && c < 360) {
      cog = c;
    }
  }

  // Rule: Heading 'not available' (511 or >= 360) handled as null
  let rawHdg = msg.TrueHeading ?? msg.Heading;
  let hdg = null;
  if (rawHdg != null) {
    const h = Number(rawHdg);
    if (h >= 0 && h < 360 && h !== 511) {
      hdg = h;
    }
  }

  filterMetrics.validPositionIngested++;

  return {
    mmsi,
    lat,
    lon,
    sog: sog ?? 0,
    cog,
    hdg,
    name: (meta.ShipName || msg.ShipName || "").trim(),
    time_utc: meta.time_utc || new Date().toISOString(),
  };
}

/**
 * Validates and sanitizes a ShipStaticData packet.
 */
export function sanitizeStatic(msg, meta = {}) {
  const mmsi = Number(meta.MMSI || msg.MMSI || msg.UserID);
  if (!mmsi || mmsi < 100000000 || mmsi > 999999999) {
    return null;
  }

  const name = (msg.Name || meta.ShipName || "").trim();
  const type = Number(msg.Type) || 0;
  const destination = (msg.Destination || "").trim();

  let eta = null;
  if (msg.Eta) {
    const { Month, Day, Hour, Minute } = msg.Eta;
    if (Month > 0 && Day > 0) {
      eta = `${String(Month).padStart(2, "0")}-${String(Day).padStart(2, "0")} ${String(Hour).padStart(2, "0")}:${String(Minute).padStart(2, "0")} UTC`;
    }
  }

  let length = 0;
  let beam = 0;
  if (msg.Dimension) {
    const { A = 0, B = 0, C = 0, D = 0 } = msg.Dimension;
    length = A + B;
    beam = C + D;
  }

  filterMetrics.validStaticIngested++;

  return {
    mmsi,
    name,
    type,
    destination: destination || null,
    eta,
    length,
    beam,
  };
}

