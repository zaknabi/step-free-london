"""Fetch journey times from a few origin stations to every TfL station, with and without
step-free access, using the TfL Journey Planner API.

Run from anywhere:  python scripts/step_free/fetch_journeys.py
Output:             scripts/step_free/cache/journeys.csv (one row per origin, destination, mode)

Every API response is cached as a small JSON file, so re-running only fetches what is missing.
"""

import json
import os
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
CACHE_DIR = HERE / "cache"
RESPONSES_DIR = CACHE_DIR / "responses"
HUBS_DIR = CACHE_DIR / "hubs"

TOPOLOGY_URL = "https://api.tfl.gov.uk/stationdata/tfl-stationdata-detailed.zip"
JOURNEY_URL = "https://api.tfl.gov.uk/Journey/JourneyResults/{origin}/to/{destination}"
STOPPOINT_URL = "https://api.tfl.gov.uk/StopPoint/{stop_id}"

# A fixed, ordinary weekday morning so results are reproducible and comparable.
DEPARTURE_DATE = "20261124"  # Tuesday 24 November 2026
DEPARTURE_TIME = "0900"
MODES = "tube,dlr,overground,elizabeth-line,tram,bus,walking,national-rail"

ORIGINS = {
    "940GZZLUSKS": "South Kensington",
    "940GZZLUWYP": "Wembley Park",
    "940GZZLUSTD": "Stratford",
    "940GZZLUBXN": "Brixton",
}

# Parallel requests: step-free queries take up to ~5 s each, and the API key allows 500/min.
MAX_WORKERS = 8
MAX_RETRIES = 5
# 200 = journey found, 404 = no journey exists, 300 = TfL can't resolve the stop.
DEFINITIVE_STATUSES = (200, 300, 404)


def load_api_key() -> str:
    load_dotenv(REPO_ROOT / ".env.local")
    key = os.environ.get("TFL_APP_KEY")
    if not key:
        raise SystemExit("TFL_APP_KEY missing: add it to .env.local in the repo root")
    return key


def load_stations() -> pd.DataFrame:
    """Station list with one averaged coordinate per station."""
    CACHE_DIR.mkdir(exist_ok=True)
    topology_zip = CACHE_DIR / "tfl-stationdata-detailed.zip"
    if not topology_zip.exists():
        response = requests.get(TOPOLOGY_URL, timeout=60)
        response.raise_for_status()
        topology_zip.write_bytes(response.content)

    with zipfile.ZipFile(topology_zip) as z:
        stations = pd.read_csv(z.open("Stations.csv"))
        points = pd.read_csv(z.open("StationPoints.csv"))

    # StationPoints holds entrances, platforms etc.; their mean is a good station centre.
    centres = points.groupby("StationUniqueId")[["Lat", "Lon"]].mean()
    stations = stations.join(centres, on="UniqueId")
    return stations[["UniqueId", "Name", "FareZones", "Lat", "Lon"]].rename(
        columns={"UniqueId": "station_id", "Name": "name", "FareZones": "zones", "Lat": "lat", "Lon": "lon"}
    )


def get_json(url: str, params: dict) -> tuple[int, dict]:
    """GET with retries on rate limiting and server errors. Returns (status, body)."""
    for attempt in range(MAX_RETRIES):
        response = requests.get(url, params=params, timeout=90)
        if response.status_code in (429, 500, 502, 503, 504):
            time.sleep(2**attempt)
            continue
        try:
            return response.status_code, response.json()
        except ValueError:
            return response.status_code, {}
    return response.status_code, {}


def hub_children(hub_id: str, key: str) -> list[str]:
    """A hub (e.g. Bank) groups several stations; return their station-level IDs."""
    HUBS_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = HUBS_DIR / f"{hub_id}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    _, body = get_json(STOPPOINT_URL.format(stop_id=hub_id), {"app_key": key})
    children = sorted(
        child["naptanId"]
        for child in body.get("children", [])
        if child["stopType"] in ("NaptanMetroStation", "NaptanRailStation")
    )
    cache_file.write_text(json.dumps(children))
    return children


def fetch_journey(origin: str, destination: str, step_free: bool, key: str) -> dict:
    """Fastest journey duration in minutes, or None when no journey exists. Cached on disk."""
    mode = "step_free" if step_free else "any"
    cache_file = RESPONSES_DIR / origin / mode / f"{destination}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    params = {
        "date": DEPARTURE_DATE,
        "time": DEPARTURE_TIME,
        "timeIs": "Departing",
        "mode": MODES,
        "app_key": key,
    }
    if step_free:
        params["accessibilityPreference"] = "StepFreeToPlatform"

    status, body = get_json(JOURNEY_URL.format(origin=origin, destination=destination), params)
    journeys = body.get("journeys") or []
    fastest = min(journeys, key=lambda j: j["duration"], default=None)
    result = {
        "status": status,
        "duration_min": fastest["duration"] if fastest else None,
        "modes": [leg["mode"]["name"] for leg in fastest["legs"]] if fastest else [],
    }
    # Only cache definitive answers, so transient failures are retried on the next run.
    # 300 means TfL can't resolve that stop; it is always a hub member with working siblings.
    if status in DEFINITIVE_STATUSES:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(result))
    return result


def main() -> None:
    key = load_api_key()
    stations = load_stations()

    # Expand hubs into their member stations; ordinary stations map to themselves.
    targets = []
    for station_id in stations["station_id"]:
        if station_id.startswith("HUB"):
            targets += [(station_id, child) for child in hub_children(station_id, key)]
        else:
            targets.append((station_id, station_id))

    tasks = [
        (origin, station_id, destination, step_free)
        for origin in ORIGINS
        for station_id, destination in targets
        for step_free in (False, True)
    ]
    print(f"{len(stations)} stations -> {len(targets)} destinations -> {len(tasks)} journeys")

    def run(task):
        origin, station_id, destination, step_free = task
        result = fetch_journey(origin, destination, step_free, key)
        return {"origin": origin, "station_id": station_id, "destination": destination,
                "step_free": step_free, **result}

    rows = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for i, row in enumerate(pool.map(run, tasks), start=1):
            rows.append(row)
            if i % 250 == 0:
                print(f"  {i}/{len(tasks)}")

    journeys = pd.DataFrame(rows)
    journeys["modes"] = journeys["modes"].str.join(">")
    journeys.to_csv(CACHE_DIR / "journeys.csv", index=False)
    stations.to_csv(CACHE_DIR / "stations.csv", index=False)
    failed = journeys[~journeys["status"].isin(DEFINITIVE_STATUSES)]
    print(f"done: {len(journeys)} rows, {len(failed)} failed (re-run to retry those)")


if __name__ == "__main__":
    main()
