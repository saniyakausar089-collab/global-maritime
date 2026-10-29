"""Unit tests for maritime metrics, congestion index calculation, and alerting logic.

Uses isolated temporary SQLite databases to verify calculations deterministically.
"""

import sys
from pathlib import Path
import pytest

# Ensure port_monitor is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alerts import check_port_congestion, log_alert, send_alert_email
from metrics import (
    get_congestion_index,
    get_hourly_stationary_history,
    init_db,
    insert_ais_record,
    migrate_db,
    get_connection,
)


@pytest.fixture
def temp_db(tmp_path):
    """Fixture providing a fresh, isolated temporary database."""
    db_file = tmp_path / "test_ais.db"
    init_db(db_file)
    return db_file


def test_db_initialization_and_migration(temp_db):
    """Verify that tables and migrated columns exist in the database."""
    with get_connection(temp_db) as conn:
        cursor = conn.execute("PRAGMA table_info(ais_records)")
        cols = {row["name"] for row in cursor.fetchall()}
        assert "cog" in cols
        assert "true_heading" in cols
        assert "zone_type" in cols
        assert "mmsi" in cols

        # Check alerts table
        cur_alerts = conn.execute("PRAGMA table_info(alerts)")
        alert_cols = {row["name"] for row in cur_alerts.fetchall()}
        assert "congestion_index" in alert_cols
        assert "message" in alert_cols


def test_congestion_index_insufficient_data(temp_db):
    """When fewer than 2 hours of data exist, congestion index should return None."""
    ci = get_congestion_index("rotterdam", db_path=temp_db)
    assert ci is None

    # Insert only 1 record (1 hour)
    insert_ais_record(
        mmsi=123456789,
        ship_name="TestShip1",
        lat=51.95,
        lon=4.05,
        sog=0.2,
        cog=90.0,
        true_heading=90.0,
        port_id="rotterdam",
        zone_type="anchorage",
        timestamp="2026-10-29 10:00:00",
        db_path=temp_db,
    )
    ci_one = get_congestion_index("rotterdam", db_path=temp_db)
    assert ci_one is None


def test_congestion_index_calculation(temp_db):
    """Test congestion index calculation with known hourly stationary distributions."""
    port_id = "rotterdam"

    # Hour 1: 10 stationary ships
    for i in range(10):
        insert_ais_record(
            mmsi=1000 + i,
            ship_name=f"Ship-{i}",
            lat=51.95,
            lon=4.05,
            sog=0.1,
            port_id=port_id,
            zone_type="anchorage",
            timestamp="2026-10-29 10:15:00",
            db_path=temp_db,
        )

    # Hour 2: 10 stationary ships
    for i in range(10):
        insert_ais_record(
            mmsi=2000 + i,
            ship_name=f"Ship-{i}",
            lat=51.95,
            lon=4.05,
            sog=0.1,
            port_id=port_id,
            zone_type="anchorage",
            timestamp="2026-10-29 11:15:00",
            db_path=temp_db,
        )

    # Hour 3: 15 stationary ships (Congested: 15 / 10 = 1.50)
    for i in range(15):
        insert_ais_record(
            mmsi=3000 + i,
            ship_name=f"Ship-{i}",
            lat=51.95,
            lon=4.05,
            sog=0.1,
            port_id=port_id,
            zone_type="anchorage",
            timestamp="2026-10-29 12:15:00",
            db_path=temp_db,
        )

    ci = get_congestion_index(port_id, db_path=temp_db)
    assert ci is not None
    # Historical counts = [10, 10, 15], median = 10. Latest = 15. Index = 15 / 10 = 1.50
    assert pytest.approx(ci, 0.01) == 1.50


def test_alert_consecutive_hours_logic(temp_db):
    """Verify that alerts are only triggered when CI > 1.2 for 3 consecutive hours."""
    port_id = "singapore"

    # Generate baseline: 4 hours with 10 stationary ships
    for h in [8, 9, 10, 11]:
        for i in range(10):
            insert_ais_record(
                mmsi=1000 * h + i,
                ship_name="Ship",
                lat=1.27,
                lon=103.78,
                sog=0.2,
                port_id=port_id,
                zone_type="anchorage",
                timestamp=f"2026-10-29 {h:02d}:15:00",
                db_path=temp_db,
            )

    # Hours 12 & 13: 15 ships (CI = 15/10 = 1.5 > 1.2, but only 2 hours)
    for h in [12, 13]:
        for i in range(15):
            insert_ais_record(
                mmsi=1000 * h + i,
                ship_name="Ship",
                lat=1.27,
                lon=103.78,
                sog=0.2,
                port_id=port_id,
                zone_type="anchorage",
                timestamp=f"2026-10-29 {h:02d}:15:00",
                db_path=temp_db,
            )

    res_2h = check_port_congestion(port_id, db_path=temp_db)
    assert res_2h["consecutive_hours"] == 2
    assert res_2h["is_alert"] is False, "Alert should NOT fire for only 2 consecutive hours"

    # Hour 14: 15 ships (CI = 1.5 > 1.2, now 3 consecutive hours!)
    for i in range(15):
        insert_ais_record(
            mmsi=14000 + i,
            ship_name="Ship",
            lat=1.27,
            lon=103.78,
            sog=0.2,
            port_id=port_id,
            zone_type="anchorage",
            timestamp="2026-10-29 14:15:00",
            db_path=temp_db,
        )

    res_3h = check_port_congestion(port_id, db_path=temp_db)
    assert res_3h["consecutive_hours"] >= 3
    assert res_3h["is_alert"] is True, "Alert MUST fire for 3 consecutive hours of CI > 1.2"


def test_log_alert_persists_to_db(temp_db):
    """Test that log_alert persists records to the alerts table."""
    alert_id = log_alert(
        port_id="rotterdam",
        port_name="Rotterdam",
        congestion_index=1.45,
        message="Test alert message",
        db_path=temp_db,
    )
    assert alert_id > 0

    with get_connection(temp_db) as conn:
        row = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
        assert row is not None
        assert row["port_id"] == "rotterdam"
        assert row["congestion_index"] == 1.45
        assert "Test alert" in row["message"]


def test_optional_email_skips_silently_when_unconfigured():
    """Verify that send_alert_email returns False and does not raise an exception without SMTP."""
    result = send_alert_email("Test Subject", "Test Body")
    assert result is False
