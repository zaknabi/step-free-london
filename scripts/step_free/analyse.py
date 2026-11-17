"""Turn fetched journey times into headline numbers and wall-ready figures.

Run after fetch_journeys.py:  python scripts/step_free/analyse.py
Outputs (committed, small):   scripts/step_free/output/summary.json
                              scripts/step_free/output/station_times.csv
                              scripts/step_free/output/figures/*.svg and *.png
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # render to files only, no window
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D

from fetch_journeys import CACHE_DIR, DEPARTURE_DATE, DEPARTURE_TIME, ORIGINS

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE / "output"
FIGURES_DIR = OUTPUT_DIR / "figures"

REACH_THRESHOLD_MIN = 45  # "a typical commute"

# Colours validated for colour-blind separation and contrast on the dark wall surface.
SURFACE = "#1f2029"
TEXT_PRIMARY = "#f0efec"
TEXT_SECONDARY = "#c3c2b7"
NO_ROUTE = "#8a8984"
EVERYONE = "#3987e5"
STEP_FREE = "#d95926"
# Travel-time bands: brightest = closest, so what you can reach "glows" against the dark wall,
# and everything past the reach threshold drops to a dim grey so the 45-minute line is obvious.
TIME_BINS = [0, 15, 30, REACH_THRESHOLD_MIN, np.inf]
TIME_LABELS = ["≤15 min", "15–30", f"30–{REACH_THRESHOLD_MIN}", f"over {REACH_THRESHOLD_MIN}"]
TIME_COLOURS = ["#cde2fb", "#86b6ef", "#3987e5", "#4a4c5c"]
MAP_PADDING_DEG = 0.02

# PNG size: a 16:9 figure at 240 dpi is ~3840 px wide, a 2×2 block of DO screens at native resolution.
FIG_SIZE = (16, 9)
PNG_DPI = 240


def load_times() -> pd.DataFrame:
    """One row per (origin, station): fastest time for everyone and for step-free travellers."""
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


def style_axes(ax) -> None:
    ax.set_facecolor(SURFACE)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)


def save(fig, name: str) -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    # Crop empty margins so the image drops into the poster at any size without dead space.
    crop = {"bbox_inches": "tight", "pad_inches": 0.4}
    fig.savefig(FIGURES_DIR / f"{name}.svg", facecolor=SURFACE, **crop)
    fig.savefig(FIGURES_DIR / f"{name}.png", facecolor=SURFACE, dpi=PNG_DPI, **crop)
    plt.close(fig)


def plot_station_map(ax, group: pd.DataFrame, column: str, origin_row: pd.Series, title: str) -> None:
    style_axes(ax)
    # Longitude degrees are shorter than latitude degrees at London's latitude (~51.5°N).
    ax.set_aspect(1 / np.cos(np.radians(51.5)))
    # Crop tightly to the stations so the network fills the panel.
    ax.set_xlim(group["lon"].min() - MAP_PADDING_DEG, group["lon"].max() + MAP_PADDING_DEG)
    ax.set_ylim(group["lat"].min() - MAP_PADDING_DEG, group["lat"].max() + MAP_PADDING_DEG)

    unreachable = group[group[column].isna()]
    ax.scatter(unreachable["lon"], unreachable["lat"], s=46, facecolors="none",
               edgecolors=NO_ROUTE, linewidths=1.2, zorder=1)

    reachable = group[group[column].notna()]
    bands = pd.cut(reachable[column], TIME_BINS, labels=False, include_lowest=True)
    # Draw far stations first so the near, brightest ones sit on top.
    for band in reversed(range(len(TIME_COLOURS))):
        subset = reachable[bands == band]
        ax.scatter(subset["lon"], subset["lat"], s=46, color=TIME_COLOURS[band],
                   edgecolors=SURFACE, linewidths=0.6, zorder=2)

    ax.scatter([origin_row["lon"]], [origin_row["lat"]], s=420, facecolors="none",
               edgecolors=TEXT_PRIMARY, linewidths=2.5, zorder=3)

    reach = int((group[column] <= REACH_THRESHOLD_MIN).sum())
    ax.set_title(title, color=TEXT_PRIMARY, fontsize=30, fontweight="bold", loc="left", pad=34)
    ax.text(0, 1.012, f"{reach} stations within {REACH_THRESHOLD_MIN} minutes", transform=ax.transAxes,
            color=TEXT_SECONDARY, fontsize=20, va="bottom")


def plot_origin_maps(times: pd.DataFrame, stations: pd.DataFrame) -> None:
    for origin, group in times.groupby("origin"):
        name = ORIGINS[origin]
        origin_row = stations.loc[stations["station_id"] == group_origin_station(origin, stations)].iloc[0]

        fig, (left, right) = plt.subplots(1, 2, figsize=FIG_SIZE, facecolor=SURFACE)
        plot_station_map(left, group, "any_min", origin_row, "Everyone")
        plot_station_map(right, group, "step_free_min", origin_row, "Step-free")

        handles = [Line2D([], [], marker="o", linestyle="", markersize=14, color=colour, label=label)
                   for colour, label in zip(TIME_COLOURS, TIME_LABELS)]
        handles.append(Line2D([], [], marker="o", linestyle="", markersize=14, markerfacecolor="none",
                              markeredgecolor=NO_ROUTE, label="no route found"))
        handles.append(Line2D([], [], marker="o", linestyle="", markersize=18, markerfacecolor="none",
                              markeredgecolor=TEXT_PRIMARY, markeredgewidth=2.5, label=name))
        fig.legend(handles=handles, loc="lower center", ncol=len(handles), frameon=False,
                   fontsize=18, labelcolor=TEXT_SECONDARY, handletextpad=0.3, columnspacing=1.4)
        fig.subplots_adjust(left=0.03, right=0.97, top=0.86, bottom=0.1, wspace=0.08)
        save(fig, f"map_{slug(name)}")


def group_origin_station(origin: str, stations: pd.DataFrame) -> str:
    """The station row for an origin: itself, or failing that the hub that contains it."""
    if origin in set(stations["station_id"]):
        return origin
    journeys = pd.read_csv(CACHE_DIR / "journeys.csv")
    return journeys.loc[journeys["destination"] == origin, "station_id"].iloc[0]


def plot_reach_bars(summary: dict) -> None:
    origins = list(summary["origins"])
    any_key = f"reach_{REACH_THRESHOLD_MIN}_any"
    sf_key = f"reach_{REACH_THRESHOLD_MIN}_step_free"
    any_values = [summary["origins"][o][any_key] for o in origins]
    sf_values = [summary["origins"][o][sf_key] for o in origins]

    fig, ax = plt.subplots(figsize=FIG_SIZE, facecolor=SURFACE)
    style_axes(ax)
    y = np.arange(len(origins))[::-1]
    bar_height = 0.36
    # The 0.02 offset leaves a thin surface-coloured gap between each pair of bars.
    ax.barh(y + bar_height / 2 + 0.02, any_values, height=bar_height, color=EVERYONE, label="Everyone")
    ax.barh(y - bar_height / 2 - 0.02, sf_values, height=bar_height, color=STEP_FREE, label="Step-free")

    for yi, a, s in zip(y, any_values, sf_values):
        ax.text(a + 4, yi + bar_height / 2 + 0.02, str(a), va="center", color=TEXT_PRIMARY, fontsize=22)
        ax.text(s + 4, yi - bar_height / 2 - 0.02, str(s), va="center", color=TEXT_PRIMARY, fontsize=22)
    ax.set_yticks(y, origins)
    ax.tick_params(axis="y", length=0, labelsize=24, labelcolor=TEXT_PRIMARY, pad=14)
    ax.set_xlim(0, max(any_values) * 1.12)
    ax.set_title(f"Stations reachable within {REACH_THRESHOLD_MIN} minutes", color=TEXT_PRIMARY,
                 fontsize=30, fontweight="bold", loc="left", pad=60)
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.0), ncol=2, frameon=False, fontsize=20,
              labelcolor=TEXT_SECONDARY)
    fig.subplots_adjust(left=0.2, right=0.97, top=0.82, bottom=0.06)
    save(fig, "reach_bars")


def slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def main() -> None:
    times = load_times()
    stations = pd.read_csv(CACHE_DIR / "stations.csv")
    summary = summarise(times)

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    times.to_csv(OUTPUT_DIR / "station_times.csv", index=False, float_format="%.0f")

    plot_origin_maps(times, stations)
    plot_reach_bars(summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
