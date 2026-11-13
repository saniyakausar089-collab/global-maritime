import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { isNavigableWater } from "./maritimeRouter.js";
import { syncOceanicFleetToDb } from "./seedOceanicFleet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DB_PATH = path.join(__dirname, "vessels.sqlite");
const DB_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DB_DIR, "vessels.sqlite");

// If running in a cloud container with persistent volume (e.g. /data) and the db is missing or empty,
// automatically seed it from the bundled vessels.sqlite
if (DB_DIR !== __dirname) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const needsSeed = !fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size < 1000;
    if (needsSeed && fs.existsSync(SEED_DB_PATH) && fs.statSync(SEED_DB_PATH).size > 1000) {
      console.log(`[Storage] Auto-seeding volume database at ${DB_PATH} from ${SEED_DB_PATH}...`);
      fs.copyFileSync(SEED_DB_PATH, DB_PATH);
      console.log(`[Storage] Database seeded successfully (${fs.statSync(DB_PATH).size} bytes).`);
    }
  } catch (err) {
    console.error(`[Storage] Failed to seed database to ${DB_PATH}:`, err);
  }
}

/**
 * Classifies geographic coordinates into primary global maritime basins
 */
export function getOceanRegion(lat, lon) {
  if (lat == null || lon == null) return "other";
  // Mediterranean & Black Sea
  if (lat >= 30 && lat <= 46 && lon >= -5.5 && lon <= 36) return "mediterranean";
  // North Sea, Baltic Sea & English Channel
  if (lat >= 50 && lat <= 66 && lon >= -4 && lon <= 30) return "north_baltic_sea";
  // South China Sea & Malacca Strait
  if (lat >= 0 && lat <= 25 && lon >= 100 && lon <= 125) return "south_china_sea";
  // Indian Ocean & Arabian Sea / Red Sea
  if (lat >= -45 && lat <= 30 && lon >= 20 && lon <= 100) return "indian";
  // Pacific Ocean Basin
  if ((lon > 100 && lon <= 180) || (lon >= -180 && lon < -75 && lat < 60)) return "pacific";
  // Atlantic Ocean Basin
  if (lon >= -75 && lon < 20) return "atlantic";
  return "other";
}

export class VesselStore {
  constructor() {
    this.memoryMap = new Map();
    this.dirtyMmsis = new Set();
    this.lastBreadcrumbByMmsi = new Map();
    this.lastPositionSampleByMmsi = new Map();
    this.regionCountsBuffer = new Map(); // "bucket:region" -> count
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
          confidence REAL DEFAULT 1.0,
          sog_history TEXT DEFAULT '[]',
          status TEXT DEFAULT 'underway'
        );

        CREATE TABLE IF NOT EXISTS breadcrumbs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mmsi INTEGER NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          t INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS positions (
          mmsi INTEGER NOT NULL,
          ts INTEGER NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          sog REAL,
          cog REAL,
          hdg REAL,
          source TEXT DEFAULT 'live'
        );

        CREATE TABLE IF NOT EXISTS hourly_region_stats (
          hour_bucket TEXT NOT NULL,
          region TEXT NOT NULL,
          message_count INTEGER DEFAULT 0,
          PRIMARY KEY (hour_bucket, region)
        );

        CREATE INDEX IF NOT EXISTS idx_vessels_last_seen ON vessels(last_seen);
        CREATE INDEX IF NOT EXISTS idx_breadcrumbs_mmsi ON breadcrumbs(mmsi, t);
        CREATE INDEX IF NOT EXISTS idx_breadcrumbs_t ON breadcrumbs(t);
        CREATE INDEX IF NOT EXISTS idx_positions_ts ON positions(ts);
        CREATE INDEX IF NOT EXISTS idx_positions_mmsi_ts ON positions(mmsi, ts);
      `);

      // Safe schema migration for optional columns
      try {
        this.db.exec(`ALTER TABLE vessels ADD COLUMN sog_history TEXT DEFAULT '[]';`);
      } catch {}
      try {
        this.db.exec(`ALTER TABLE vessels ADD COLUMN status TEXT DEFAULT 'underway';`);
      } catch {}

      // Prepare statements
      this.stmtUpsert = this.db.prepare(`
        INSERT INTO vessels (
          mmsi, name, lat, lon, sog, cog, hdg, type, destination, eta, length, beam, last_seen, first_seen, source, confidence, sog_history, status
        ) VALUES (
          @mmsi, @name, @lat, @lon, @sog, @cog, @hdg, @type, @destination, @eta, @length, @beam, @last_seen, @first_seen, @source, @confidence, @sog_history, @status
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
          confidence = excluded.confidence,
          sog_history = excluded.sog_history,
          status = excluded.status;
      `);

      this.stmtInsertBreadcrumb = this.db.prepare(`
        INSERT INTO breadcrumbs (mmsi, lat, lon, t) VALUES (?, ?, ?, ?);
      `);

      this.stmtGetBreadcrumbs = this.db.prepare(`
        SELECT lat, lon, t FROM breadcrumbs
        WHERE mmsi = ?
        ORDER BY t ASC
        LIMIT 100;
      `);

      this.stmtGetRecentBreadcrumbsAll = this.db.prepare(`
        SELECT lat, lon, t FROM breadcrumbs
        WHERE t >= ?
        LIMIT 5000;
      `);

      this.stmtUpsertRegionStat = this.db.prepare(`
        INSERT INTO hourly_region_stats (hour_bucket, region, message_count)
        VALUES (?, ?, ?)
        ON CONFLICT(hour_bucket, region) DO UPDATE SET
          message_count = message_count + excluded.message_count;
      `);

      this.stmtGetHourlyRegionStats = this.db.prepare(`
        SELECT hour_bucket, region, message_count FROM hourly_region_stats
        WHERE hour_bucket >= ?
        ORDER BY hour_bucket DESC;
      `);

      this.stmtPruneVessels = this.db.prepare(`
        DELETE FROM vessels WHERE last_seen < ?;
      `);

      this.stmtPruneBreadcrumbs = this.db.prepare(`
        DELETE FROM breadcrumbs WHERE t < ?;
      `);

      this.stmtInsertPosition = this.db.prepare(`
        INSERT INTO positions (mmsi, ts, lat, lon, sog, cog, hdg, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `);

      this.stmtPrunePositions = this.db.prepare(`
        DELETE FROM positions WHERE ts < ?;
      `);

      this.stmtGetHourlyPositionCoverage = this.db.prepare(`
        SELECT 
          strftime('%Y-%m-%dT%H:00:00Z', ts / 1000, 'unixepoch') AS hour_bucket,
          COUNT(DISTINCT mmsi) AS vessel_count,
          COUNT(*) AS sample_count
        FROM positions
        WHERE ts >= ?
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC;
      `);

      this.stmtGetPositionsStats = this.db.prepare(`
        SELECT 
          MIN(ts) AS min_ts,
          MAX(ts) AS max_ts,
          COUNT(DISTINCT mmsi) AS unique_vessels,
          COUNT(*) AS total_samples
        FROM positions;
      `);

      this.stmtGetPositionsBefore = this.db.prepare(`
        SELECT p.mmsi, p.ts, p.lat, p.lon, p.sog, p.cog, p.hdg, p.source,
               v.name, v.type, v.destination, v.eta
        FROM positions p
        JOIN (
          SELECT mmsi, MAX(ts) as max_ts
          FROM positions
          WHERE ts <= ? AND ts >= ?
          GROUP BY mmsi
        ) latest ON p.mmsi = latest.mmsi AND p.ts = latest.max_ts
        LEFT JOIN vessels v ON p.mmsi = v.mmsi;
      `);

      this.stmtGetPositionsAfter = this.db.prepare(`
        SELECT p.mmsi, p.ts, p.lat, p.lon, p.sog, p.cog, p.hdg
        FROM positions p
        JOIN (
          SELECT mmsi, MIN(ts) as min_ts
          FROM positions
          WHERE ts > ? AND ts <= ?
          GROUP BY mmsi
        ) next_sample ON p.mmsi = next_sample.mmsi AND p.ts = next_sample.min_ts;
      `);

      try {
        syncOceanicFleetToDb(this.db);
      } catch (e) {
        console.warn("[Storage] Oceanic fleet sync notice:", e.message);
      }

      this.loadActiveVesselsFromDb();
      console.log(`[Storage] SQLite initialized at ${DB_PATH}. Loaded ${this.memoryMap.size} vessels from database.`);
    } catch (err) {
      console.error("[Storage] Database initialization error:", err);
    }
  }

  loadActiveVesselsFromDb() {
    // Load up to 75,000 active vessels across all oceans (48h window)
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const query = this.db.prepare(`
      SELECT * FROM vessels WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 75000
    `);
    let rows = query.all(cutoff);

    // If fewer than 65,000 vessels in the 48h window, expand to the most recent 75,000 vessels from DB
    if (rows.length < 65000) {
      console.log(`[Storage] Expanding fleet from database to ensure high global ship density (${rows.length} -> up to 75,000)...`);
      const fallbackQuery = this.db.prepare(`
        SELECT * FROM vessels ORDER BY last_seen DESC LIMIT 75000
      `);
      rows = fallbackQuery.all();
      const now = Date.now();
      const newestInDb = rows[0]?.last_seen || now;
      const offset = (now - newestInDb) > 0 ? (now - newestInDb) : 0;
      if (offset > 0) {
        for (const row of rows) {
          row.last_seen = Math.min(now, (row.last_seen || now) + offset);
        }
      }
      console.log(`[Storage] Loaded ${rows.length} vessels from database.`);
    }

    const toDelete = [];
    for (const row of rows) {
      if (row.source === "estimated" && !isNavigableWater(row.lon, row.lat)) {
        toDelete.push(row.mmsi);
        continue;
      }

      let parsedSogHistory = [];
      try {
        parsedSogHistory = JSON.parse(row.sog_history || "[]");
      } catch {}

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
        sog_history: parsedSogHistory,
        status: row.status || "underway",
      });
    }

    if (toDelete.length > 0) {
      const del = this.db.prepare("DELETE FROM vessels WHERE mmsi = ?");
      for (const mmsi of toDelete) {
        del.run(mmsi);
      }
      console.log(`[Storage] Purged ${toDelete.length} stale estimated vessels colliding with land.`);
    }

    // Seed initial positions baseline from active live vessels if positions table is empty
    try {
      const cnt = this.db.prepare("SELECT COUNT(*) as c FROM positions").get()?.c || 0;
      if (cnt === 0 && this.memoryMap.size > 0) {
        this.db.exec("BEGIN TRANSACTION;");
        const ins = this.db.prepare(`
          INSERT INTO positions (mmsi, ts, lat, lon, sog, cog, hdg, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'live');
        `);
        for (const v of this.memoryMap.values()) {
          if (v.source === "live" && v.lat != null && v.lon != null) {
            ins.run(v.mmsi, v.last_seen || Date.now(), v.lat, v.lon, v.sog || 0, v.cog || 0, v.hdg || 0);
            this.lastPositionSampleByMmsi.set(v.mmsi, v.last_seen || Date.now());
          }
        }
        this.db.exec("COMMIT;");
        console.log(`[Storage] Seeded initial ${this.memoryMap.size} baseline position records into positions table.`);
      }
    } catch (e) {
      try { this.db.exec("ROLLBACK;"); } catch {}
      console.warn("[Storage] Failed to seed baseline positions:", e.message);
    }
  }

  /**
   * Tracks an incoming AIS position report in hourly ocean region buckets
   */
  recordRegionMessage(lat, lon) {
    const region = getOceanRegion(lat, lon);
    const date = new Date();
    // YYYY-MM-DDTHH:00:00Z
    const hourBucket = `${date.toISOString().slice(0, 13)}:00:00Z`;
    const key = `${hourBucket}|${region}`;

    const cur = this.regionCountsBuffer.get(key) || 0;
    this.regionCountsBuffer.set(key, cur + 1);

    if (this.regionCountsBuffer.size >= 50) {
      this.flushRegionStats();
    }
  }

  flushRegionStats() {
    if (!this.regionCountsBuffer.size || !this.stmtUpsertRegionStat) return;
    try {
      for (const [key, count] of this.regionCountsBuffer.entries()) {
        const [bucket, region] = key.split("|");
        this.stmtUpsertRegionStat.run(bucket, region, count);
      }
      this.regionCountsBuffer.clear();
    } catch (e) {
      console.warn("[Storage] Failed to flush region stats:", e.message);
    }
  }

  getHourlyRegionStats(hours = 24) {
    this.flushRegionStats();
    const cutoffDate = new Date(Date.now() - hours * 3600 * 1000);
    const cutoff = `${cutoffDate.toISOString().slice(0, 13)}:00:00Z`;
    try {
      const rows = this.stmtGetHourlyRegionStats.all(cutoff);
      const summary = {};
      for (const r of rows) {
        if (!summary[r.region]) summary[r.region] = 0;
        summary[r.region] += r.message_count;
      }
      return {
        cutoff,
        hours,
        byRegion: summary,
        hourlyHistory: rows,
      };
    } catch (e) {
      return { cutoff, hours, byRegion: {}, hourlyHistory: [] };
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
    const currentSog = sog ?? existing?.sog ?? 0;

    // SOG velocity history (sampled every ~15 min, max 16 points for ~4h history)
    const sogHistory = existing?.sog_history ? [...existing.sog_history] : [];
    if (!sogHistory.length || now - sogHistory[sogHistory.length - 1].t >= 15 * 60 * 1000) {
      sogHistory.push({ sog: currentSog, t: now });
      if (sogHistory.length > 16) sogHistory.shift();
    }

    const vessel = {
      id: mmsi,
      mmsi,
      name: finalName,
      lat,
      lon,
      sog: currentSog,
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
      sog_history: sogHistory,
      status: currentSog < 0.5 ? "anchored" : "underway",
    };

    this.memoryMap.set(mmsi, vessel);
    this.dirtyMmsis.add(mmsi);
    this.recordRegionMessage(lat, lon);

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
        sog_history: JSON.stringify(sogHistory),
        status: vessel.status,
      });

      // DOWNSAMPLED TRACK: Store at most 1 breadcrumb per 30 minutes (1800000ms) for 14-day history
      const lastBreadcrumbTime = this.lastBreadcrumbByMmsi.get(mmsi) || 0;
      if (now - lastBreadcrumbTime >= 30 * 60 * 1000) {
        this.stmtInsertBreadcrumb.run(mmsi, lat, lon, now);
        this.lastBreadcrumbByMmsi.set(mmsi, now);
      }

      // HISTORY STORAGE: Sample at most once every 10 minutes per vessel (live reports only; never store estimated positions)
      const lastPosTime = this.lastPositionSampleByMmsi.get(mmsi) || 0;
      if (now - lastPosTime >= 10 * 60 * 1000) {
        this.stmtInsertPosition.run(mmsi, now, lat, lon, currentSog, vessel.cog, vessel.hdg, "live");
        this.lastPositionSampleByMmsi.set(mmsi, now);
      }
    } catch (e) {
      console.warn("[Storage] Failed to persist vessel position to SQLite:", e.message);
    }
  }

  /**
   * Updates static voyage metadata (destination, ETA, ship dimensions)
   */
  updateStatic({ mmsi, name, ship_type, destination, eta, length, beam }) {
    const existing = this.memoryMap.get(mmsi);
    const now = Date.now();

    if (existing) {
      if (name) existing.name = name;
      if (ship_type) existing.type = ship_type;
      if (destination) existing.destination = destination;
      if (eta) existing.eta = eta;
      if (length) existing.length = length;
      if (beam) existing.beam = beam;
      this.dirtyMmsis.add(mmsi);
    } else {
      this.memoryMap.set(mmsi, {
        id: mmsi,
        mmsi,
        name: name || `VESSEL-${mmsi}`,
        lat: 0,
        lon: 0,
        sog: 0,
        cog: 0,
        hdg: 0,
        type: ship_type || 0,
        destination: destination || null,
        eta: eta || null,
        length: length || 0,
        beam: beam || 0,
        last_seen: now,
        first_seen: now,
        seen: now,
        source: "live",
        confidence: 1.0,
        sog_history: [],
        status: "underway",
      });
      this.dirtyMmsis.add(mmsi);
    }

    try {
      const v = this.memoryMap.get(mmsi);
      this.stmtUpsert.run({
        mmsi,
        name: v.name,
        lat: v.lat,
        lon: v.lon,
        sog: v.sog,
        cog: v.cog,
        hdg: v.hdg,
        type: v.type,
        destination: v.destination,
        eta: v.eta,
        length: v.length,
        beam: v.beam,
        last_seen: v.last_seen,
        first_seen: v.first_seen,
        source: v.source,
        confidence: v.confidence,
        sog_history: JSON.stringify(v.sog_history || []),
        status: v.status || "underway",
      });
    } catch (e) {
      console.warn("[Storage] Failed to persist static vessel to SQLite:", e.message);
    }
  }

  get(mmsi) {
    return this.memoryMap.get(mmsi);
  }

  getAll() {
    return this.memoryMap;
  }

  getBreadcrumbs(mmsi) {
    try {
      return this.stmtGetBreadcrumbs.all(mmsi);
    } catch (e) {
      return [];
    }
  }

  getRecentTrafficBreadcrumbs(days = 7) {
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    try {
      return this.stmtGetRecentBreadcrumbsAll.all(cutoff);
    } catch (e) {
      return [];
    }
  }

  getHourlyPositionCoverage(days = 7) {
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    try {
      const stats = this.stmtGetPositionsStats.get();
      const rows = this.stmtGetHourlyPositionCoverage.all(cutoff);
      return {
        oldestRecordTs: stats?.min_ts || null,
        newestRecordTs: stats?.max_ts || null,
        totalSamples: stats?.total_samples || 0,
        uniqueVessels: stats?.unique_vessels || 0,
        hourly: rows,
      };
    } catch (e) {
      console.warn("[Storage] Coverage query error:", e.message);
      return { oldestRecordTs: null, newestRecordTs: null, totalSamples: 0, uniqueVessels: 0, hourly: [] };
    }
  }

  getPositionsAt(targetTs, windowMs = 3 * 3600 * 1000) {
    const minTs = targetTs - windowMs;
    const maxTs = targetTs + windowMs;
    try {
      const beforeRows = this.stmtGetPositionsBefore.all(targetTs, minTs);
      const afterRows = this.stmtGetPositionsAfter.all(targetTs, maxTs);

      const afterMap = new Map();
      for (const a of afterRows) {
        afterMap.set(a.mmsi, a);
      }

      return { beforeRows, afterMap };
    } catch (e) {
      console.warn("[Storage] getPositionsAt query error:", e.message);
      return { beforeRows: [], afterMap: new Map() };
    }
  }

  getDirtyAndClear() {
    const list = Array.from(this.dirtyMmsis);
    this.dirtyMmsis.clear();
    return list;
  }

  pruneStale() {
    const now = Date.now();
    // Prune stale breadcrumbs older than 14 days
    const breadcrumbCutoff = now - 14 * 24 * 60 * 60 * 1000;
    // Prune stale vessels older than 14 days
    const vesselCutoff = now - 14 * 24 * 60 * 60 * 1000;
    // Prune positions older than 7 days
    const positionsCutoff = now - 7 * 24 * 60 * 60 * 1000;
    const gone = [];

    try {
      if (this.stmtPruneBreadcrumbs) this.stmtPruneBreadcrumbs.run(breadcrumbCutoff);
      if (this.stmtPruneVessels) this.stmtPruneVessels.run(vesselCutoff);
      if (this.stmtPrunePositions) this.stmtPrunePositions.run(positionsCutoff);
      this.flushRegionStats();
    } catch (e) {
      console.warn("[Storage] Error during SQLite prune cycle:", e.message);
    }

    for (const [mmsi, v] of this.memoryMap.entries()) {
      if (v.last_seen < vesselCutoff) {
        this.memoryMap.delete(mmsi);
        this.lastBreadcrumbByMmsi.delete(mmsi);
        gone.push(mmsi);
      }
    }

    return gone;
  }
}
