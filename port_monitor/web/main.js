// Main viewer: loads data/tracks.json (made by export_tracks.py) and animates it.

const cfg = window.APP_CONFIG || {};
if (!cfg.CESIUM_ION_TOKEN) {
  const stEl = document.getElementById("status");
  if (stEl) {
    stEl.textContent =
      "Notice: Add CESIUM_ION_TOKEN in config.local.js or .env for high-res terrain.";
  }
}
Cesium.Ion.defaultAccessToken = cfg.CESIUM_ION_TOKEN || "";

const viewer = new Cesium.Viewer("globe", {
  baseLayerPicker: false,
  geocoder: false,
  timeline: true,
  animation: false,
  shouldAnimate: true
});

function addPorts(ports) {
  if (!ports) return;
  ports.forEach(p => {
    const colour = congestionColour(p.index);
    viewer.entities.add({
      name: p.name + " (congestion index: " + (p.index !== null && p.index !== undefined ? p.index : "n/a") + ")",
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
      point: { pixelSize: 14, color: colour, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
      label: { text: p.name, font: "14px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -22),
               fillColor: Cesium.Color.WHITE, showBackground: true }
    });

    // Pulsing red ring on congested ports
    if (p.index !== null && p.index !== undefined && p.index > 1.2) {
      viewer.entities.add({
        name: p.name + " Congestion Alert",
        position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => 8000 + 4000 * Math.sin(Date.now() / 400), false),
          semiMinorAxis: new Cesium.CallbackProperty(() => 8000 + 4000 * Math.sin(Date.now() / 400), false),
          material: Cesium.Color.RED.withAlpha(0.25),
          outline: true,
          outlineColor: Cesium.Color.RED,
          height: 0
        }
      });
    }
  });
}

function addVessels(vessels) {
  if (!vessels) return;
  vessels.slice(0, cfg.MAX_VESSELS || 1000).forEach(v => {
    // Build a position-over-time property from the vessel's recent track
    const position = new Cesium.SampledPositionProperty();
    position.setInterpolationOptions({
      interpolationDegree: 1,
      interpolationAlgorithm: Cesium.LinearApproximation
    });
    position.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
    position.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

    if (v.track && v.track.length) {
      v.track.forEach(([time, lon, lat]) => {
        try {
          position.addSample(Cesium.JulianDate.fromIso8601(time), Cesium.Cartesian3.fromDegrees(lon, lat));
        } catch (e) {}
      });
    }

    const type = v.stationary ? "stationary" : "moving";
    viewer.entities.add({
      name: (v.name || "Unknown") + " (MMSI " + v.mmsi + ")",
      description: "Speed: " + v.sog + " knots<br>Heading: " + v.heading + "&deg;",
      position: position,
      billboard: {
        image: ICONS[type],
        scale: 0.7,
        rotation: headingToRotation(v.heading)
      },
      // fading trail behind moving ships
      path: v.stationary ? undefined : {
        leadTime: 0,
        trailTime: 1800,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25, color: Cesium.Color.fromCssColorString("#26c6da").withAlpha(0.7)
        })
      }
    });
  });
}

function setupControls() {
  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.onclick = () => {
      viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate;
      playBtn.textContent = viewer.clock.shouldAnimate ? "Pause" : "Play";
    };
  }
  document.querySelectorAll("[data-speed]").forEach(btn => {
    btn.onclick = () => {
      viewer.clock.multiplier = Number(btn.dataset.speed);
      document.querySelectorAll("[data-speed]").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
    };
  });
  viewer.clock.multiplier = 10;
}

async function start() {
  try {
    const res = await fetch(cfg.DATA_URL || "data/tracks.json");
    if (!res.ok) {
      throw new Error("HTTP error " + res.status);
    }
    const data = await res.json();

    if (data.start && data.end) {
      const startTime = Cesium.JulianDate.fromIso8601(data.start);
      const stopTime = Cesium.JulianDate.fromIso8601(data.end);
      viewer.clock.startTime = startTime.clone();
      viewer.clock.stopTime = stopTime.clone();
      viewer.clock.currentTime = startTime.clone();
      viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      viewer.timeline.zoomTo(startTime, stopTime);
    }

    addPorts(data.ports);
    addVessels(data.vessels);
    setupControls();

    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(60, 25, 22000000) });
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent =
        (data.vessels ? data.vessels.length : 0) + " vessels, " +
        (data.ports ? data.ports.length : 0) + " ports loaded.";
    }
  } catch (err) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent =
        "Could not load data. Run export_tracks.py first.";
    }
    console.error("Error loading tracks:", err);
  }
}

start();
