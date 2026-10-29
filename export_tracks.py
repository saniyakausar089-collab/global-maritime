"""Root runner for exporting vessel tracks to web/data/tracks.json."""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "port_monitor"
sys.path.insert(0, str(BASE))

import export_tracks

if __name__ == "__main__":
    export_tracks.main()
