"""Live AIS data ingestion module from AISStream WebSocket.

Subscribes to AISStream (wss://stream.aisstream.io/v0/stream) filtered by port
bounding boxes, parses PositionReport messages, and stores rows into ais.db.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import websockets
from dotenv import load_dotenv

from config import (
    BASE_DIR,
    PROJECT_ROOT,
    DB_PATH,
    get_aisstream_bounding_boxes,
    get_port_for_coords,
    STATIONARY_SPEED_KNOTS,
)
from metrics import init_db, insert_ais_record

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ingest")

AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"


def get_latest_api_key() -> str:
    """Reload environment and return AISSTREAM_API_KEY dynamically."""
    import os
    for p in [BASE_DIR / ".env", PROJECT_ROOT / ".env", Path(".env")]:
        if p.is_file():
            load_dotenv(dotenv_path=p, override=True)
            break
    return os.getenv("AISSTREAM_API_KEY", "").strip()


def parse_timestamp(raw_ts: str | None) -> str:
    """Normalize various timestamp formats from AISStream to ISO string."""
    if not raw_ts:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Common AISStream format: '2026-10-29 16:15:23.123456 +0000 UTC'
    clean = raw_ts.strip()
    if "UTC" in clean:
        clean = clean.replace("UTC", "").strip()
    try:
        # Handle fractional seconds and offset
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        # If any parsing issue arises, fallback to clean prefix or current UTC
        if len(clean) >= 19:
            return clean[:19]
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def stream_ais():
    """Connect to AISStream WebSocket and stream position reports into SQLite."""
    init_db(DB_PATH)

    api_key = get_latest_api_key()
    if not api_key:
        logger.warning(
            "AISSTREAM_API_KEY is not set in .env! "
            "Please paste your key into port_monitor/.env or run `seed_demo.py` for synthetic data."
        )
        logger.info("ingest.py is idling and watching for your API key in .env...")
        while not api_key:
            await asyncio.sleep(5)
            api_key = get_latest_api_key()

    subscription_message = {
        "APIKey": api_key,
        "BoundingBoxes": get_aisstream_bounding_boxes(),
        "FilterMessageTypes": ["PositionReport"],
    }

    retry_delay = 5
    while True:
        try:
            logger.info("Connecting to AISStream WebSocket...")
            async with websockets.connect(AISSTREAM_URL, ping_interval=20, ping_timeout=20) as ws:
                await ws.send(json.dumps(subscription_message))
                logger.info("Connected and subscribed to port bounding boxes. Listening for messages...")
                retry_delay = 5

                async for message in ws:
                    try:
                        data = json.loads(message)
                        msg_type = data.get("MessageType")

                        if msg_type != "PositionReport":
                            continue

                        meta = data.get("MetaData", {})
                        pos_msg = data.get("Message", {}).get("PositionReport", {})

                        mmsi = meta.get("MMSI") or pos_msg.get("UserID")
                        if not mmsi:
                            continue

                        lat = meta.get("latitude")
                        if lat is None:
                            lat = pos_msg.get("Latitude")

                        lon = meta.get("longitude")
                        if lon is None:
                            lon = pos_msg.get("Longitude")

                        if lat is None or lon is None or (lat == 0 and lon == 0):
                            continue

                        # Check if coordinate is in one of our ports
                        port_id = get_port_for_coords(float(lat), float(lon))
                        if not port_id:
                            continue

                        sog = float(pos_msg.get("Sog", 0.0))
                        cog = float(pos_msg.get("Cog", 0.0))
                        ship_name = (meta.get("ShipName") or "").strip()
                        raw_ts = meta.get("time_utc")
                        ts = parse_timestamp(raw_ts)

                        insert_ais_record(
                            mmsi=int(mmsi),
                            ship_name=ship_name or f"VESSEL-{mmsi}",
                            lat=float(lat),
                            lon=float(lon),
                            sog=sog,
                            cog=cog,
                            port_id=port_id,
                            timestamp=ts,
                            is_demo=0,
                            db_path=DB_PATH,
                        )

                        state = "Stationary" if sog < STATIONARY_SPEED_KNOTS else "Moving"
                        logger.info(
                            "[%s] MMSI %s (%s): %.4f, %.4f | SOG: %.1f kn (%s)",
                            port_id.title(),
                            mmsi,
                            ship_name or "Unknown",
                            lat,
                            lon,
                            sog,
                            state,
                        )

                    except json.JSONDecodeError:
                        logger.warning("Received invalid JSON payload.")
                    except Exception as e:
                        logger.error("Error processing AIS message: %s", e)

        except (websockets.exceptions.ConnectionClosedError, websockets.exceptions.WebSocketException) as ws_err:
            logger.warning("WebSocket connection dropped (%s). Reconnecting in %ds...", ws_err, retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)
        except Exception as err:
            logger.error("Unexpected connection error: %s. Reconnecting in %ds...", err, retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)


def main():
    """Main entrypoint for ingest script."""
    try:
        asyncio.run(stream_ais())
    except KeyboardInterrupt:
        logger.info("Ingest service stopped by user.")


if __name__ == "__main__":
    main()
