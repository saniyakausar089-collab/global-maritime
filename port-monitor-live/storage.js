import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { isNavigableWater } from "./maritimeRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "vessels.sqlite");

export class VesselStore {
  constructor() {
    this.memoryMap = new Map();
    this.dirtyMmsis = new Set();
    this.initDatabase();
  }

  initDatabase() {
    try {
      this.db = new DatabaseSync(DB_PATH);

      // Schema for persistent vessel states
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS vessels (
          mmsi INTEGER PRIMARY KEY,
          name TEXT,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          sog REAL,
          cog REAL,
          hdg REAL,
          type INTEGER DEFAULT 0,
          destination TEXT,
          eta TEXT,
          length REAL DEFAULT 0,
          beam REAL DEFAULT 0,
          last_seen INTEGER NOT NULL,
          first_seen INTEGER NOT NULL,
          source TEXT DEFAULT 'live',
          confidence REAL DEFAULT 1.0
        );

        CREATE TABLE IF NOT EXISTS breadcrumbs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mmsi INTEGER NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          t INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_vessels_last_seen ON vessels(last_seen);
        CREATE INDEX IF NOT EXISTS idx_breadcrumbs_mmsi ON breadcrumbs(mmsi, t);
      `);

      // Prepare statements
      this.stmtUpsert = this.db.prepare(`
        INSERT INTO vessels (
          mmsi, name, lat, lon, sog, cog, hdg, type, destination, eta, length, beam, last_seen, first_seen, source, confidence
        ) VALUES (
          @mmsi, @name, @lat, @lon, @sog, @cog, @hdg, @type, @destination, @eta, @length, @beam, @last_seen, @first_seen, @source, @confidence
        )
        ON CONFLICT(mmsi) DO UPDATE SET
          name = COALESCE(NULLIF(excluded.name, ''), vessels.name),
          lat = excluded.lat,
          lon = excluded.lon,
          sog = excluded.sog,
          cog = excluded.cog,
          hdg = excluded.hdg,
          type = CASE WHEN excluded.type > 0 THEN excluded.type ELSE vessels.type END,
          destination = COALESCE(NULLIF(excluded.destination, ''), vessels.destination),
          eta = COALESCE(NULLIF(excluded.eta, ''), vessels.eta),
          length = CASE WHEN excluded.length > 0 THEN excluded.length ELSE vessels.length END,
          beam = CASE WHEN excluded.beam > 0 THEN excluded.beam ELSE vessels.beam END,
          last_seen = excluded.last_seen,
          source = excluded.source,
          confidence = excluded.confidence;
      `);

      this.stmtInsertBreadcrumb = this.db.prepare(`
        INSERT INTO breadcrumbs (mmsi, lat, lon, t) VALUES (?, ?, ?, ?);
      `);

      this.stmtGetBreadcrumbs = this.db.prepare(`
        SELECT lat, lon, t FROM breadcrumbs
        WHERE mmsi = ?
        ORDER BY t DESC
        LIMIT 25;
      `);

      this.stmtPruneVessels = this.db.prepare(`
        DELETE FROM vessels WHERE last_seen < ?;
      `);

      this.stmtPruneBreadcrumbs = this.db.prepare(`
        DELETE FROM breadcrumbs WHERE t < ?;
      `);

      this.loadActiveVesselsFromDb();
      console.log(`[Storage] SQLite initialized at ${DB_PATH}. Loaded ${this.memoryMap.size} vessels from database.`);
    } catch (err) {
      console.error("[Storage] Database initialization error:", err);
    }
  }

  loadActiveVesselsFromDb() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const query = this.db.prepare(`
      SELECT * FROM vessels WHERE last_seen >= ?
    `);
    const rows = query.all(cutoff);

    const toDelete = [];
    for (const row of rows) {
      if (row.source === "estimated" && !isNavigableWater(row.lon, row.lat)) {
        toDelete.push(row.mmsi);
        continue;
      }

      this.memoryMap.set(row.mmsi, {
        id: row.mmsi,
        mmsi: row.mmsi,
        name: row.name || `VESSEL-${row.mmsi}`,
        lat: row.lat,
        lon: row.lon,
        sog: row.sog ?? 0,
        cog: row.cog ?? 0,
        hdg: row.hdg ?? row.cog ?? 0,
        type: row.type || 0,
        destination: row.destination || null,
        eta: row.eta || null,
        length: row.length || 0,
        beam: row.beam || 0,
        last_seen: row.last_seen,
        first_seen: row.first_seen,
        seen: row.last_seen,
        source: row.source || "live",
        confidence: row.confidence ?? 1.0,
      });
    }

    if (toDelete.length > 0) {
      const del = this.db.prepare("DELETE FROM vessels WHERE mmsi = ?");
      for (const mmsi of toDelete) {
        del.run(mmsi);
      }
      console.log(`[Storage] Purged ${toDelete.length} stale estimated vessels colliding with land.`);
    }
  }

  /**
   * Updates or inserts a real AIS position report
   */
  updatePosition({ mmsi, lat, lon, sog, cog, hdg, name, time_utc }) {
    const now = Date.now();
    const existing = this.memoryMap.get(mmsi);

    const first_seen = existing?.first_seen || now;
    const finalName = name || existing?.name || `VESSEL-${mmsi}`;
    const finalType = existing?.type || 0;
    const destination = existing?.destination || null;
    const eta = existing?.eta || null;
    const length = existing?.length || 0;
    const beam = existing?.beam || 0;

    const vessel = {
      id: mmsi,
      mmsi,
      name: finalName,
      lat,
      lon,
      sog: sog ?? existing?.sog ?? 0,
      cog: cog ?? existing?.cog ?? 0,
      hdg: hdg ?? cog ?? existing?.hdg ?? 0,
      type: finalType,
      destination,
      eta,
      length,
      beam,
      last_seen: now,
      first_seen,
      seen: now,
      source: "live",
      confidence: 1.0,
    };

    this.memoryMap.set(mmsi, vessel);
    this.dirtyMmsis.add(mmsi);

    // Save to SQLite
    try {
      this.stmtUpsert.run({
        mmsi,
        name: finalName,
        lat,
        lon,
        sog: vessel.sog,
        cog: vessel.cog,
        hdg: vessel.hdg,
        type: finalType,
        destination,
        eta,
        length,
        beam,
        last_seen: now,
        first_seen,
        source: "live",
        confidence: 1.0,
      });

      // Sample breadcrumb every ~2 minutes or if moved > 500m
      if (
        !existing ||
        Math.abs(existing.lat - lat) > 0.005 ||
        Math.abs(existing.lon - lon) > 0.005 ||
        now - (existing.lastBreadcrumb || 0) > 120000
      ) {
        this.stmtInsertBreadcrumb.run(mmsi, lat, lon, now);
        vessel.lastBreadcrumb = now;
      }
    } catch (e) {
      console.warn("[Storage] Failed to persist vessel position to SQLite:", e.message);
    }

    return vessel;
  }

  /**
   * Updates ship static info (Type, Name, Destination, ETA, Dimension)
   */
  updateStatic({ mmsi, name, type, destination, eta, length, beam }) {
    const existing = this.memoryMap.get(mmsi);
    const now = Date.now();

    if (!existing) {
      // Create skeleton record
      const vessel = {
        id: mmsi,
        mmsi,
        name: name || `VESSEL-${mmsi}`,
        lat: 0,
        lon: 0,
        sog: 0,
        cog: 0,
        hdg: 0,
        type: type || 0,
        destination: destination || null,
        eta: eta || null,
        length: length || 0,
        beam: beam || 0,
        last_seen: now,
        first_seen: now,
        seen: now,
        source: "live",
        confidence: 1.0,
      };
      this.memoryMap.set(mmsi, vessel);
      return;
    }

    if (name) existing.name = name;
    if (type) existing.type = type;
    if (destination) existing.destination = destination;
    if (eta) existing.eta = eta;
    if (length) existing.length = length;
    if (beam) existing.beam = beam;

    this.dirtyMmsis.add(mmsi);

    try {
      this.stmtUpsert.run({
        mmsi,
        name: existing.name,
        lat: existing.lat,
        lon: existing.lon,
        sog: existing.sog,
        cog: existing.cog,
        hdg: existing.hdg,
        type: existing.type,
        destination: existing.destination,
        eta: existing.eta,
        length: existing.length,
        beam: existing.beam,
        last_seen: existing.last_seen,
        first_seen: existing.first_seen,
        source: existing.source,
        confidence: existing.confidence,
      });
    } catch (e) {
      // Ignored
    }
  }

  getBreadcrumbs(mmsi) {
    try {
      return this.stmtGetBreadcrumbs.all(mmsi);
    } catch (e) {
      return [];
    }
  }

  /**
   * Prunes records older than 24h
   */
  pruneStale() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const gone = [];

    for (const [mmsi, v] of this.memoryMap) {
      if (v.last_seen < cutoff) {
        this.memoryMap.delete(mmsi);
        gone.push(mmsi);
      }
    }

    try {
      this.stmtPruneVessels.run(cutoff);
      this.stmtPruneBreadcrumbs.run(cutoff);
    } catch (e) {
      console.warn("[Storage] Error pruning stale entries:", e.message);
    }

    return gone;
  }

  getAll() {
    return this.memoryMap;
  }

  get(mmsi) {
    return this.memoryMap.get(mmsi);
  }

  getDirtyAndClear() {
    const dirty = [...this.dirtyMmsis];
    this.dirtyMmsis.clear();
    return dirty;
  }
}

