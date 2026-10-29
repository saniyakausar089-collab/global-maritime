"""Unit tests for spatial polygon geofencing and zone classification.

Tests point-in-polygon containment against berth, anchorage, and port boundary polygons
defined in data/ports.geojson.
"""

import sys
from pathlib import Path
import pytest

# Ensure port_monitor is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from metrics import classify_zone, load_geofences


def test_geofences_file_loads():
    """Verify that ports.geojson is present and can be parsed into a GeoDataFrame."""
    gdf = load_geofences()
    assert gdf is not None, "Failed to load geofences GeoDataFrame"
    assert not gdf.empty, "Geofences GeoDataFrame is empty"
    assert "port_id" in gdf.columns
    assert "zone_type" in gdf.columns


def test_classify_rotterdam_berth():
    """Test point located in Rotterdam container berth returns 'berth'."""
    # Coords inside Rotterdam berth polygon
    lat, lon = 51.90, 4.20
    zone = classify_zone(lat, lon, "rotterdam")
    assert zone == "berth", f"Expected 'berth', got {zone}"


def test_classify_rotterdam_anchorage():
    """Test point located in Rotterdam offshore anchorage holding area returns 'anchorage'."""
    # Coords inside Rotterdam anchorage polygon
    lat, lon = 51.995, 3.865
    zone = classify_zone(lat, lon, "rotterdam")
    assert zone == "anchorage", f"Expected 'anchorage', got {zone}"


def test_classify_outside_subzones():
    """Test point located outside specific berth or anchorage returns 'port_boundary'."""
    # Point outside specific berths/anchorages
    lat, lon = 51.85, 4.45
    zone = classify_zone(lat, lon, "rotterdam")
    assert zone == "port_boundary", f"Expected 'port_boundary', got {zone}"


def test_classify_singapore_zones():
    """Test Singapore berth and anchorage zone classification."""
    # Singapore Tuas / Pasir Panjang container terminal
    lat_berth, lon_berth = 1.23, 103.75
    zone_b = classify_zone(lat_berth, lon_berth, "singapore")
    assert zone_b == "berth", f"Expected 'berth', got {zone_b}"

    # Singapore Eastern Anchorage
    lat_anch, lon_anch = 1.217, 103.96
    zone_a = classify_zone(lat_anch, lon_anch, "singapore")
    assert zone_a == "anchorage", f"Expected 'anchorage', got {zone_a}"


def test_classify_unknown_port_graceful():
    """Test that an unknown port id falls back to 'port_boundary' without throwing."""
    zone = classify_zone(0.0, 0.0, "unknown_port_id")
    assert zone == "port_boundary"
