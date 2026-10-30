// Ocean Maritime Commercial Fleet Generator
// Simulates international commercial merchant shipping along realistic oceanic corridors
// (Trans-Pacific, Trans-Atlantic, Europe-Asia Silk Road, Cape Route, Trans-Indian Ocean, Americas)

export const OCEAN_ROUTES = [
  // 1. North Pacific Great Circle: East Asia (Tokyo/Shanghai) <-> US West Coast (Seattle/LA)
  {
    name: "Trans-Pacific North",
    type: 70, // Container
    waypoints: [
      [35.0, 139.8], // Tokyo Bay
      [42.0, 146.0], // Kuril Trench
      [47.5, 165.0], // Mid North Pacific
      [50.0, -175.0], // Aleutian South Arc
      [49.0, -150.0], // Gulf of Alaska South
      [48.5, -126.0], // Juan de Fuca Approach
      [47.6, -122.4], // Seattle
    ],
  },
  {
    name: "Trans-Pacific Central",
    type: 70, // Container
    waypoints: [
      [31.2, 122.0], // Shanghai
      [32.5, 130.0], // Kyushu South
      [34.0, 150.0], // West Pacific
      [35.5, 175.0], // International Date Line West
      [35.0, -160.0], // Central North Pacific East
      [34.0, -135.0], // California Current
      [33.7, -118.2], // Los Angeles / Long Beach
    ],
  },
  {
    name: "Trans-Pacific South / Hawaii Corridor",
    type: 80, // Tanker / Bulk
    waypoints: [
      [22.3, 114.2], // Hong Kong
      [21.5, 121.0], // Luzon Strait
      [23.0, 145.0], // Philippine Sea East
      [25.0, 170.0], // Central Pacific West
      [26.0, -165.0], // North of Oahu / Hawaii
      [32.0, -135.0], // East Pacific
      [37.8, -122.4], // San Francisco Bay
    ],
  },

  // 2. North Atlantic Ocean Highway: Europe <-> North America East Coast
  {
    name: "North Atlantic Express (Rotterdam <-> New York)",
    type: 70, // Container
    waypoints: [
      [51.9, 4.0], // Rotterdam
      [50.0, -1.0], // English Channel
      [49.0, -8.0], // Celtic Sea Entry
      [46.0, -25.0], // Mid North Atlantic
      [43.0, -45.0], // Grand Banks South
      [41.0, -65.0], // Nova Scotia South
      [40.4, -73.8], // New York Harbor
    ],
  },
  {
    name: "Trans-Atlantic Southern Route (Gibraltar <-> US East Coast)",
    type: 80, // Crude Tanker
    waypoints: [
      [36.0, -5.8], // Strait of Gibraltar
      [37.5, -18.0], // Atlantic Basin
      [38.0, -32.0], // Azores South
      [35.0, -52.0], // Bermuda East
      [36.0, -68.0], // Gulf Stream
      [36.9, -76.0], // Norfolk / Chesapeake Bay
    ],
  },
  {
    name: "North Atlantic High-Latitude (Halifax / Montreal <-> UK / North Sea)",
    type: 70, // Cargo / Bulk
    waypoints: [
      [54.0, 5.0], // North Sea
      [58.5, -4.0], // Pentland Firth
      [58.0, -25.0], // South of Iceland
      [56.0, -45.0], // Cape Farewell South
      [47.0, -55.0], // Newfoundland
      [44.6, -63.5], // Halifax
    ],
  },

  // 3. Europe <-> Asia via Mediterranean, Suez Canal & Indian Ocean
  {
    name: "Mediterranean Trunk Route",
    type: 70, // Container
    waypoints: [
      [36.0, -5.5], // Gibraltar
      [36.5, 5.0], // Western Med
      [37.5, 11.5], // Sicily Channel
      [35.5, 18.0], // Ionian Sea
      [34.0, 26.0], // South of Crete
      [31.5, 32.3], // Port Said / Suez North
    ],
  },
  {
    name: "Red Sea & Gulf of Aden Corridor",
    type: 80, // Tanker
    waypoints: [
      [27.8, 34.0], // Gulf of Suez South
      [22.0, 38.0], // Central Red Sea
      [15.0, 42.0], // Red Sea South
      [12.6, 43.4], // Bab-el-Mandeb
      [12.5, 48.0], // Gulf of Aden
      [12.0, 53.0], // Socotra North
    ],
  },
  {
    name: "Indian Ocean Silk Road (Aden <-> Sri Lanka <-> Malacca)",
    type: 70, // Container
    waypoints: [
      [12.0, 53.0], // Socotra
      [10.5, 62.0], // Arabian Sea Central
      [7.5, 74.0], // Laccadive Sea
      [5.8, 80.5], // Dondra Head / Sri Lanka
      [5.5, 90.0], // Bay of Bengal South
      [5.5, 96.0], // Malacca Entrance
      [2.8, 101.2], // Port Klang Offshore
      [1.26, 103.8], // Singapore
    ],
  },
  {
    name: "Persian Gulf Oil Trunk (Hormuz <-> East Asia)",
    type: 80, // VLCC Crude Tanker
    waypoints: [
      [28.0, 50.0], // Northern Gulf / Kuwait
      [26.5, 56.5], // Strait of Hormuz
      [24.0, 58.5], // Gulf of Oman
      [18.0, 65.0], // Arabian Sea
      [10.0, 72.0], // Southwest India
      [5.8, 80.5], // Sri Lanka
      [5.5, 95.0], // Malacca West
      [1.26, 103.8], // Singapore
    ],
  },

  // 4. Trans-Indian Ocean & Cape Route (Asia <-> South Africa <-> Atlantic)
  {
    name: "Cape of Good Hope Trunk (Singapore <-> South Africa)",
    type: 70, // Bulk / Container
    waypoints: [
      [1.26, 103.8], // Singapore
      [-6.0, 105.5], // Sunda Strait
      [-12.0, 95.0], // Cocos Islands South
      [-18.0, 80.0], // Mid Indian Ocean
      [-26.0, 60.0], // Southwest Indian Ocean
      [-30.0, 45.0], // Madagascar South
      [-34.0, 28.0], // Port Elizabeth Offshore
      [-34.8, 18.5], // Cape of Good Hope
    ],
  },
  {
    name: "South Atlantic Transit (Cape Town <-> Europe / Mediterranean)",
    type: 80, // Tanker
    waypoints: [
      [-34.8, 18.5], // Cape Town
      [-28.0, 12.0], // Namibia Offshore
      [-15.0, 0.0], // South Atlantic Basin
      [-5.0, -10.0], // Ascension East
      [5.0, -18.0], // Sierra Leone Basin
      [16.0, -20.0], // Dakar / Cape Verde
      [28.0, -15.0], // Canary Islands
      [36.0, -6.0], // Gibraltar
    ],
  },

  // 5. South America <-> Europe / North America (Atlantic Corridors)
  {
    name: "South America East Coast (Santos <-> North Atlantic)",
    type: 70, // Container / Grain
    waypoints: [
      [-24.0, -45.0], // Santos / Sao Paulo
      [-18.0, -38.0], // Abrolhos Shelf
      [-8.0, -34.0], // Recife Offshore
      [-2.0, -32.0], // Fernando de Noronha
      [8.0, -35.0], // Mid-Atlantic Ridge
      [20.0, -40.0], // North Atlantic Tropical
      [35.0, -42.0], // Central Atlantic
      [48.0, -10.0], // Western Approaches Europe
    ],
  },
  {
    name: "South America Grain Route (River Plate <-> Cape Route / Asia)",
    type: 70, // Bulk Carrier
    waypoints: [
      [-35.5, -56.0], // Buenos Aires / Montevideo
      [-37.0, -40.0], // Argentine Basin
      [-36.0, -20.0], // Mid South Atlantic
      [-35.0, 0.0], // Tristan da Cunha East
      [-34.8, 18.5], // Cape of Good Hope
    ],
  },

  // 6. Trans-Panama Canal & Americas Pacific Corridors
  {
    name: "Panama Canal to US West Coast",
    type: 70, // Container
    waypoints: [
      [8.8, -79.5], // Panama Pacific
      [10.0, -87.0], // Costa Rica / Nicaragua
      [15.0, -96.0], // Gulf of Tehuantepec
      [19.0, -105.0], // Manzanillo Mexico
      [25.0, -113.0], // Baja California
      [33.7, -118.2], // Los Angeles
    ],
  },
  {
    name: "Panama Canal to US East Coast / Caribbean",
    type: 70, // Container
    waypoints: [
      [9.3, -79.9], // Colon / Panama Caribbean
      [14.0, -76.0], // Central Caribbean
      [20.0, -74.0], // Windward Passage (Haiti/Cuba)
      [25.0, -78.5], // Northwest Providence Channel (Bahamas)
      [32.0, -77.0], // Charleston Offshore
      [40.0, -73.5], // New York Approach
    ],
  },
  {
    name: "South America Pacific (Panama <-> Chile)",
    type: 80, // Tanker / Mining Bulk
    waypoints: [
      [8.0, -80.0], // Panama Bay
      [1.0, -83.0], // Ecuador Offshore
      [-10.0, -80.0], // Peru Offshore
      [-22.0, -73.0], // Antofagasta Offshore
      [-33.0, -72.5], // Valparaiso / Santiago
    ],
  },

  // 7. Australia & Oceania Mining / Commercial Highways
  {
    name: "Iron Ore Highway (Port Hedland <-> East Asia)",
    type: 70, // Capesize Bulk
    waypoints: [
      [-20.0, 118.0], // Port Hedland Australia
      [-12.0, 122.0], // Timor Sea
      [-4.0, 121.0], // Flores / Celebes Sea
      [6.0, 125.0], // Mindanao East
      [18.0, 126.0], // Philippine Sea
      [27.0, 124.0], // East China Sea
      [31.2, 122.0], // Shanghai / Zhoushan
    ],
  },
  {
    name: "Australia East Coast to Japan / Korea",
    type: 70, // Bulk / Coal
    waypoints: [
      [-33.0, 152.0], // Newcastle / Sydney
      [-22.0, 155.0], // Great Barrier Reef East
      [-10.0, 154.0], // Coral Sea
      [2.0, 148.0], // Micronesia West
      [18.0, 142.0], // Mariana Trench West
      [34.0, 140.0], // Tokyo Bay
    ],
  },
  {
    name: "Trans-South Pacific (Australia/NZ <-> Americas)",
    type: 70, // Container
    waypoints: [
      [-38.0, 148.0], // Melbourne / Bass Strait
      [-41.0, 174.0], // Cook Strait New Zealand
      [-38.0, -170.0], // South Pacific Basin
      [-32.0, -140.0], // South Pacific Central
      [-22.0, -110.0], // Easter Island North
      [-10.0, -90.0], // Galapagos South
      [7.5, -81.0], // Panama Approach
    ],
  },

  // 8. East Asia & South China Sea Transit Arteries
  {
    name: "South China Sea Superhighway (Singapore <-> Taiwan/Japan)",
    type: 70, // Container
    waypoints: [
      [1.26, 103.8], // Singapore
      [6.0, 107.0], // Anambas North
      [12.0, 112.5], // Central South China Sea
      [18.5, 116.0], // Dongsha Offshore
      [22.0, 120.5], // Taiwan Strait South
      [26.0, 122.5], // Senkaku Waters
      [32.0, 128.5], // Kyushu West
      [35.0, 139.8], // Tokyo
    ],
  },
  {
    name: "Baltic & Scandinavian Trunk Corridor",
    type: 70, // Ro-Ro / Cargo
    waypoints: [
      [51.5, 2.5], // Dover Strait
      [54.5, 6.0], // German Bight
      [57.5, 10.5], // Skagerrak / Kattegat
      [56.0, 12.5], // The Sound (Oresund)
      [57.0, 19.0], // Baltic Sea Central
      [59.5, 24.5], // Gulf of Finland / Tallinn
    ],
  },
];

// Curated authentic merchant fleet names
const SHIP_FLEET_NAMES = [
  // Container mega-ships
  "EVER GIVEN", "EVER GLORY", "EVER ACE", "EVER GOLDEN", "EVER BRAVE",
  "MSC OSCAR", "MSC GULSUN", "MSC TESSA", "MSC MICHEL CAPPELLINI", "MSC ISABELLA",
  "MAERSK MC-KINNEY MOLLER", "MAERSK MADRID", "MAERSK HANOI", "MAERSK MCALESTER",
  "COSCO SHIPPING UNIVERSE", "COSCO SHIPPING TAURUS", "COSCO SHIPPING PLANET",
  "CMA CGM ANTOINE DE SAINT EXUPERY", "CMA CGM JACQUES SAADE", "CMA CGM JEAN MERMOZ",
  "HAPAG-LLOYD HAMBURG EXPRESS", "HAPAG-LLOYD BERLIN EXPRESS", "HAPAG-LLOYD PARIS",
  "ONE APUS", "ONE STORK", "ONE INFINITY", "ONE OLYMPUS", "ONE COLUMBA",
  "OOCL HONG KONG", "OOCL SCANDINAVIA", "OOCL GERMANY", "OOCL INDONESIA",
  "YANG MING WITNESS", "YANG MING WELLHEAD", "YANG MING WONDER",
  "ZIM SAMMY OFER", "ZIM MOUNT EVEREST", "ZIM VIRGINIA",
  
  // VLCC / Suezmax Crude & Product Tankers
  "TI EUROPE", "TI OCEANIA", "FRONT ALTAIR", "FRONT RADIANCE", "FRONT EMPRESS",
  "EURONAV ALEXANDRIA", "EURONAV OCEANIA", "NORDIC PASSION", "NORDIC STAR",
  "DHT LOTUS", "DHT PEONY", "DHT EDELWEISS", "DHT JAGUAR",
  "PACIFIC VOYAGER", "ATLANTIC PIONEER", "OCEAN EMERALD", "GLOBAL SUCCESS",
  "SEAWAYS TYBEE", "SEAWAYS KILIMANJARO", "BAHRI ARAS", "BAHRI JAZAN",
  "MARAN GAS APOLLONIA", "MARAN CYGNUS", "BW LILAC", "BW TULIP",
  
  // Capesize & Panamax Bulk Carriers
  "VALE BRASIL", "VALE RIO DE JANEIRO", "VALE SOJA", "BERGE EVEREST", "BERGE OLYMPUS",
  "BERGE MAUNA KEA", "STAR POLARIS", "STAR ALTAIR", "GOLDEN HORIZON", "GOLDEN OPAL",
  "PACIFIC HORIZON", "CAPE TRADER", "AUSTRALIAN BULKER", "NEWCASTLE EXPRESS",
  "EASTERN GLORY", "SOUTHERN CROSS", "WESTERN ENTERPRISE", "ORIENTAL AMBITION",
  
  // Passenger / Cruise / Ro-Ro
  "QUEEN MARY 2", "QUEEN ANNE", "SYMPHONY OF THE SEAS", "WONDER OF THE SEAS",
  "CARNIVAL CELEBRATION", "NORWEGIAN PRIMA", "WALLENIUS TOLEDO", "WALLENIUS TITANIA",
  "HÖEGH TARGET", "HÖEGH TRIGGER", "GRIMALDI GRANDE NIGERIA"
];

// ITU MID Flag State Prefixes
const MID_CODES = [
  352, 353, 354, 355, // Panama
  636, // Liberia
  538, // Marshall Islands
  563, 564, 565, // Singapore
  412, 413, 414, // China
  211, 218, // Germany
  244, 245, // Netherlands
  431, // Japan
  228, // France
  235, // UK
  367, // USA
  219, // Denmark
  247, // Italy
  257, // Norway
  710, // Brazil
  503, // Australia
];

function calcBearing(lat1, lon1, lat2, lon2) {
  let dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distKm(lat1, lon1, lat2, lon2) {
  const k = Math.cos(((lat1 + lat2) / 2 * Math.PI) / 180);
  const dy = (lat2 - lat1) * 111.32;
  let dLon = Math.abs(lon2 - lon1);
  if (dLon > 180) dLon = 360 - dLon;
  const dx = dLon * 111.32 * k;
  return Math.sqrt(dx * dx + dy * dy);
}

// Generate an initial fleet of ~1,800 active ocean commercial vessels across all world routes
export function createOceanFleet() {
  const fleet = [];
  let mmsiCounter = 10000;

  OCEAN_ROUTES.forEach((route, routeIdx) => {
    // Calculate total route distance in km
    const segDistances = [];
    let totalKm = 0;
    for (let i = 0; i < route.waypoints.length - 1; i++) {
      const [la1, lo1] = route.waypoints[i];
      const [la2, lo2] = route.waypoints[i + 1];
      const d = distKm(la1, lo1, la2, lo2);
      segDistances.push(d);
      totalKm += d;
    }

    // Number of vessels on this route based on route length (~1 vessel every 80-120 km)
    const vesselCount = Math.max(35, Math.min(95, Math.round(totalKm / 100)));

    for (let v = 0; v < vesselCount; v++) {
      const direction = v % 2 === 0 ? 1 : -1; // Half eastbound/northbound, half westbound/southbound
      const progressFraction = (v + Math.random() * 0.4) / vesselCount;
      
      const mid = MID_CODES[(routeIdx * 11 + v) % MID_CODES.length];
      const mmsi = Number(`${mid}${String(mmsiCounter++).slice(-6)}`);
      
      const nameTemplate = SHIP_FLEET_NAMES[(routeIdx * 17 + v) % SHIP_FLEET_NAMES.length];
      const name = v > 20 ? `${nameTemplate} ${v % 5 + 1}` : nameTemplate;
      
      const baseSpeed = route.type === 70 ? 17.0 + (Math.random() * 4.5) : 13.5 + (Math.random() * 3.5);

      fleet.push({
        id: mmsi,
        mmsi,
        name,
        routeIdx,
        route,
        totalKm,
        segDistances,
        currentKm: progressFraction * totalKm,
        direction,
        sog: Number(baseSpeed.toFixed(1)),
        type: route.type,
        lat: 0,
        lon: 0,
        cog: 0,
        hdg: 0,
        seen: Date.now(),
        isOceanFleet: true,
      });
    }
  });

  return fleet;
}

// Update position of vessel along its waypoints
function advanceVessel(v, deltaSeconds) {
  const kmTraveled = (v.sog * 1.852 * deltaSeconds) / 3600;
  v.currentKm += v.direction * kmTraveled;

  // Reverse direction when reaching terminal ports
  if (v.currentKm >= v.totalKm) {
    v.currentKm = v.totalKm - 0.1;
    v.direction = -1;
  } else if (v.currentKm <= 0) {
    v.currentKm = 0.1;
    v.direction = 1;
  }

  // Find corresponding waypoint segment
  let accumulated = 0;
  let segIdx = 0;
  for (let i = 0; i < v.segDistances.length; i++) {
    const d = v.segDistances[i];
    if (accumulated + d >= v.currentKm || i === v.segDistances.length - 1) {
      segIdx = i;
      break;
    }
    accumulated += d;
  }

  const [la1, lo1] = v.route.waypoints[segIdx];
  const [la2, lo2] = v.route.waypoints[segIdx + 1];
  const segLen = v.segDistances[segIdx] || 1;
  const segProgress = Math.max(0, Math.min(1, (v.currentKm - accumulated) / segLen));

  // Compute interpolated lat/lon with Date Line wrap-around handling
  v.lat = la1 + (la2 - la1) * segProgress;
  
  let dLon = lo2 - lo1;
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  
  let targetLon = lo1 + dLon * segProgress;
  if (targetLon > 180) targetLon -= 360;
  else if (targetLon < -180) targetLon += 360;
  v.lon = targetLon;

  // Compute course heading along current segment direction
  if (v.direction === 1) {
    v.cog = Math.round(calcBearing(la1, lo1, la2, lo2));
  } else {
    v.cog = Math.round(calcBearing(la2, lo2, la1, lo1));
  }
  v.hdg = v.cog;
  v.seen = Date.now();
}

/**
 * Initializes and starts the Global Ocean Shipping Fleet simulator
 * Updates the shared `vessels` map and marks dirty IDs for WS broadcasting.
 */
export function startOceanFleet(vessels, dirty) {
  const oceanFleet = createOceanFleet();
  console.log(`Initialized Global Ocean Shipping Fleet: ${oceanFleet.length} vessels on ${OCEAN_ROUTES.length} major maritime routes.`);

  // Place initial vessels into vessels map
  for (const v of oceanFleet) {
    advanceVessel(v, 0.1);
    // Only set if not already occupied by live terrestrial AIS
    if (!vessels.has(v.id)) {
      vessels.set(v.id, v);
      dirty.add(v.id);
    }
  }

  // Update positions every 2.5 seconds
  let lastTime = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    for (const v of oceanFleet) {
      advanceVessel(v, dt);
      // Keep in vessels map and mark dirty
      const existing = vessels.get(v.id);
      // If live terrestrial AIS took over this MMSI, don't overwrite
      if (existing && !existing.isOceanFleet) continue;

      vessels.set(v.id, v);
      dirty.add(v.id);
    }
  }, 2500);

  return oceanFleet;
}
