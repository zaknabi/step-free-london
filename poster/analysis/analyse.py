"""Turn fetched journey times into headline numbers, per-station times and the app's dataset.

Run after fetch_journeys.py:  python poster/analysis/analyse.py
Outputs:                      poster/analysis/output/summary.json
                              poster/analysis/output/station_times.csv
                              apps/website/public/data/step-free.json (for the playground)
"""

import json
from pathlib import Path

import pandas as pd

from fetch_journeys import CACHE_DIR, DEPARTURE_DATE, DEPARTURE_TIME, ORIGINS

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE / "output"
# Compact dataset for the interactive Developer Playground version of the demo.
APP_DATA_FILE = HERE.parents[1] / "apps" / "website" / "public" / "data" / "step-free.json"

REACH_THRESHOLD_MIN = 45  # "a typical commute"


def load_times() -> pd.DataFrame:
    """One row per (origin, station): fastest time with stairs allowed, and step-free."""
    journeys = pd.read_csv(CACHE_DIR / "journeys.csv")
    stations = pd.read_csv(CACHE_DIR / "stations.csv")

    # A hub counts as reached if any of its member stations is reached: take the fastest.
    fastest = (
        journeys.groupby(["origin", "station_id", "step_free"])["duration_min"].min().unstack("step_free")
    )
    fastest.columns = ["any_min", "step_free_min"]
    times = fastest.reset_index().merge(stations, on="station_id")

    # Drop each origin's own station (including the hub it belongs to).
    own = journeys.loc[journeys["destination"] == journeys["origin"], ["origin", "station_id"]]
    times = times.merge(own.drop_duplicates(), how="left", indicator=True)
    times = times[times["_merge"] == "left_only"].drop(columns="_merge")

    times["penalty_min"] = times["step_free_min"] - times["any_min"]
    times["origin_name"] = times["origin"].map(ORIGINS)
    return times.sort_values(["origin", "station_id"]).reset_index(drop=True)


def summarise(times: pd.DataFrame) -> dict:
    per_origin = {}
    # Keep the ORIGINS order so South Kensington (Imperial's station) always comes first.
    for origin in ORIGINS:
        group = times[times["origin"] == origin]
        reachable_any = group["any_min"].notna()
        per_origin[ORIGINS[origin]] = {
            "stations": int(len(group)),
            f"reach_{REACH_THRESHOLD_MIN}_any": int((group["any_min"] <= REACH_THRESHOLD_MIN).sum()),
            f"reach_{REACH_THRESHOLD_MIN}_step_free": int((group["step_free_min"] <= REACH_THRESHOLD_MIN).sum()),
            "median_penalty_min": float(group["penalty_min"].median()),
            "no_step_free_route": int((reachable_any & group["step_free_min"].isna()).sum()),
        }
    return {
        "departure": f"{DEPARTURE_DATE} {DEPARTURE_TIME}",
        "reach_threshold_min": REACH_THRESHOLD_MIN,
        "origins": per_origin,
    }


def group_origin_station(origin: str, stations: pd.DataFrame) -> str:
    """The station row for an origin: itself, or failing that the hub that contains it."""
    if origin in set(stations["station_id"]):
        return origin
    journeys = pd.read_csv(CACHE_DIR / "journeys.csv")
    return journeys.loc[journeys["destination"] == origin, "station_id"].iloc[0]


def export_app_data(times: pd.DataFrame, stations: pd.DataFrame) -> None:
    """Write stations plus per-origin minute arrays aligned to the station list.

    Arrays (not one object per station) keep the file small; null means no journey found.
    """
    stations = stations.sort_values("station_id").reset_index(drop=True)
    index_of = {station_id: i for i, station_id in enumerate(stations["station_id"])}

    def minutes(group: pd.DataFrame, column: str) -> list:
        by_station = group.set_index("station_id")[column]
        values = [by_station.get(station_id) for station_id in stations["station_id"]]
        return [None if v is None or pd.isna(v) else int(v) for v in values]

    origins = []
    for origin, name in ORIGINS.items():
        group = times[times["origin"] == origin]
        origins.append({
            "id": origin,
            "name": name,
            "stationIndex": index_of[group_origin_station(origin, stations)],
            "any": minutes(group, "any_min"),
            "stepFree": minutes(group, "step_free_min"),
        })

    payload = {
        "departure": f"{DEPARTURE_DATE} {DEPARTURE_TIME}",
        "reachThresholdMin": REACH_THRESHOLD_MIN,
        "stations": [
            {"id": row.station_id, "name": row.name, "lon": round(row.lon, 5), "lat": round(row.lat, 5)}
            for row in stations.itertuples()
        ],
        "origins": origins,
    }
    APP_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    APP_DATA_FILE.write_text(json.dumps(payload, separators=(",", ":")) + "\n")


def main() -> None:
    times = load_times()
    stations = pd.read_csv(CACHE_DIR / "stations.csv")
    summary = summarise(times)

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=4) + "\n")
    times.to_csv(OUTPUT_DIR / "station_times.csv", index=False, float_format="%.0f")
    export_app_data(times, stations)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
