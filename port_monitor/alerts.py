"""Automated maritime port congestion alerting module.

Monitors ports for sustained severe congestion (congestion index > 1.2 for 3 consecutive hours),
persists alerts to SQLite, and optionally dispatches email alerts via SMTP.
"""

import logging
import smtplib
import sqlite3
import statistics
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    ALERT_EMAIL,
    DB_PATH,
    PORTS,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from metrics import get_connection, get_hourly_stationary_history, init_db

logger = logging.getLogger("alerts")


def check_port_congestion(port_id: str, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Evaluate whether a port has experienced congestion index > 1.2 for 3 consecutive hours.

    Returns:
        dict containing:
            - is_alert (bool): True if last 3 consecutive hours had CI > 1.2
            - consecutive_hours (int): Number of consecutive hours CI > 1.2 at latest period
            - current_ci (float or None): Latest hourly congestion index
            - median_count (float): Historical median waiting vessels
            - hourly_ci_list (list): Recent hourly congestion index entries
    """
    history = get_hourly_stationary_history(port_id, db_path=db_path)
    if len(history) < 3:
        return {
            "is_alert": False,
            "consecutive_hours": 0,
            "current_ci": None,
            "median_count": 0.0,
            "hourly_ci_list": [],
        }

    counts = [h["stationary"] for h in history]
    med = statistics.median(counts)
    if med <= 0:
        return {
            "is_alert": False,
            "consecutive_hours": 0,
            "current_ci": None,
            "median_count": 0.0,
            "hourly_ci_list": [],
        }

    hourly_ci = []
    for h in history:
        ci = round(h["stationary"] / med, 2)
        hourly_ci.append({
            "hour": h["hour"],
            "stationary": h["stationary"],
            "ci": ci,
        })

    # Count consecutive hours > 1.2 from the tail
    consecutive = 0
    for entry in reversed(hourly_ci):
        if entry["ci"] > 1.2:
            consecutive += 1
        else:
            break

    is_alert = consecutive >= 3
    current_ci = hourly_ci[-1]["ci"] if hourly_ci else None

    return {
        "is_alert": is_alert,
        "consecutive_hours": consecutive,
        "current_ci": current_ci,
        "median_count": med,
        "hourly_ci_list": hourly_ci[-10:],
    }


def send_alert_email(subject: str, message_body: str) -> bool:
    """Send an alert email using smtplib if SMTP settings are present in .env.

    Skips silently if SMTP host or recipient is not configured.
    """
    if not SMTP_HOST or not ALERT_EMAIL:
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_USER or f"alerts@{SMTP_HOST}"
        msg["To"] = ALERT_EMAIL
        msg.set_content(message_body)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Alert email successfully sent to %s", ALERT_EMAIL)
        return True
    except Exception as e:
        logger.warning("Optional email dispatch skipped or failed: %s", e)
        return False


def log_alert(
    port_id: str,
    port_name: str,
    congestion_index: float,
    message: str,
    db_path: Optional[Path] = None,
) -> int:
    """Log an alert event to the SQLite alerts table."""
    init_db(db_path)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO alerts (port_id, port_name, congestion_index, message, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (port_id, port_name, congestion_index, message, now_iso),
        )
        conn.commit()
        return cursor.lastrowid


def check_and_trigger_alerts(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Scan all ports, trigger alerts for sustained congestion, and prevent duplicate spam.

    Returns:
        List of alert records triggered during this run.
    """
    init_db(db_path)
    triggered = []

    for port_id, info in PORTS.items():
        res = check_port_congestion(port_id, db_path=db_path)
        if not res["is_alert"]:
            continue

        port_name = info["name"]
        current_ci = res["current_ci"] or 0.0
        hours = res["consecutive_hours"]

        # Prevent duplicate alert logging within the same recent hour
        with get_connection(db_path) as conn:
            cur = conn.execute(
                """
                SELECT timestamp FROM alerts
                WHERE port_id = ?
                ORDER BY id DESC LIMIT 1
                """,
                (port_id,),
            )
            last_alert = cur.fetchone()

        now = datetime.now(timezone.utc)
        should_log = True
        if last_alert and last_alert["timestamp"]:
            try:
                # If alerted in last 60 minutes, suppress repeated duplicate insert
                ts_str = last_alert["timestamp"].replace("Z", "+00:00")
                last_time = datetime.fromisoformat(ts_str)
                if (now - last_time).total_seconds() < 3600:
                    should_log = False
            except Exception:
                pass

        if should_log:
            msg = (
                f"Sustained severe congestion at {port_name}! "
                f"Congestion Index has exceeded 1.2 for {hours} consecutive hours "
                f"(current index: {current_ci:.2f}). Waiting vessels elevated above historical median."
            )
            alert_id = log_alert(port_id, port_name, current_ci, msg, db_path=db_path)
            send_alert_email(
                subject=f"[PORT ALERT] High Congestion at {port_name}",
                message_body=msg,
            )
            triggered.append({
                "id": alert_id,
                "port_id": port_id,
                "port_name": port_name,
                "congestion_index": current_ci,
                "consecutive_hours": hours,
                "message": msg,
            })

    return triggered


def get_recent_alerts(limit: int = 10, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve the most recent alert records from the database."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT id, port_id, port_name, congestion_index, message, timestamp, acknowledged
            FROM alerts
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()

    return [
        {
            "id": r["id"],
            "port_id": r["port_id"],
            "port_name": r["port_name"],
            "congestion_index": float(r["congestion_index"]),
            "message": r["message"],
            "timestamp": r["timestamp"],
            "acknowledged": bool(r["acknowledged"]),
        }
        for r in rows
    ]


def get_active_congested_ports(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Check currently active port congestion conditions across all monitored ports."""
    active = []
    for port_id, info in PORTS.items():
        res = check_port_congestion(port_id, db_path=db_path)
        if res["is_alert"]:
            active.append({
                "port_id": port_id,
                "port_name": info["name"],
                "current_ci": res["current_ci"],
                "consecutive_hours": res["consecutive_hours"],
            })
    return active


if __name__ == "__main__":
    import json
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("[ALERTS] Scanning all ports for sustained congestion (> 1.2 for 3+ hours)...")
    results = check_and_trigger_alerts()
    print(f"[ALERTS] Triggered {len(results)} new alert(s).")
    active_list = get_active_congested_ports()
    print(f"[ALERTS] Currently active congested ports: {len(active_list)}")
    for a in active_list:
        print(f"  - {a['port_name']}: CI {a['current_ci']} ({a['consecutive_hours']} consecutive hours)")
