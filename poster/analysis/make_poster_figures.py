"""Individual figures for the South Kensington Vizzy Studio poster, to arrange by hand.

Run after analyse.py:  python poster/analysis/make_poster_figures.py
Outputs:               poster/figures/*.svg and *.png

- sk_map_with_stairs / sk_map_step_free: identically framed, so they line up side by side
- key: the map colour key on its own
- sk_reach_curve: stations reachable within t minutes, with stairs vs step-free
- sk_extra_minutes: how much longer each journey takes step-free

Everything is sized for the Data Observatory: text and dots are fractions of one screen's
height, assuming each figure is placed at the size noted for it in poster/README.md.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # render to files only, no window
matplotlib.rcParams["svg.hashsalt"] = "step-free-london"  # reproducible SVG ids
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D

from analyse import REACH_THRESHOLD_MIN, group_origin_station, load_times
from fetch_journeys import CACHE_DIR

HERE = Path(__file__).resolve().parent
FIGURES_DIR = HERE.parent / "figures"

# Colours validated for colour-blind separation and contrast on the dark wall surface.
SURFACE = "#1f2029"
TEXT_PRIMARY = "#f0efec"
TEXT_SECONDARY = "#c3c2b7"
NO_ROUTE = "#8a8984"
# TfL calls this "no requirements": the fastest route when stairs are fine.
WITH_STAIRS = "#3987e5"
STEP_FREE = "#d95926"
# Travel-time bands: brightest = closest, so what you can reach "glows" against the dark wall,
# and everything past the reach threshold drops to a dim grey so the 45-minute line is obvious.
TIME_BINS = [0, 15, 30, REACH_THRESHOLD_MIN, np.inf]
TIME_LABELS = ["≤15 min", "15–30", f"30–{REACH_THRESHOLD_MIN}", f"over {REACH_THRESHOLD_MIN}"]
TIME_COLOURS = ["#cde2fb", "#86b6ef", "#3987e5", "#4a4c5c"]
ORIGIN = "940GZZLUSKS"  # South Kensington, Imperial's station
ORIGIN_NAME = "South Kensington"

# One DO screen is 1920 × 1080 px. Figures are drawn at 1 inch = 1/4 screen height, so a figure
# 16 in tall fills the wall's 4 rows; PNGs are rendered at native wall resolution.
SCREEN_IN = 4.0
PNG_DPI = 1080 / SCREEN_IN
SCREEN_PT = SCREEN_IN * 72

# Sizes as fractions of one screen's height, so they read from ~10 m on the wall.
DOT_DIAMETER = 0.035
TITLE = 0.22  # primary text: at least 20% of screen height (BEST_PRACTICES.md §6)
LABEL = 0.13
TICK = 0.10
LINE_WIDTH_PT = SCREEN_PT * 0.008
GRID = "#383a48"
# Frame on the bulk of the network: a few outliers (Reading, Amersham, Shenfield) would
# otherwise shrink central London.
BOUNDS_TRIM_FRACTION = 0.03
COS_LAT = np.cos(np.radians(51.5))


def pt(fraction_of_screen: float) -> float:
    return SCREEN_PT * fraction_of_screen


def save(fig, name: str) -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIGURES_DIR / f"{name}.svg", facecolor=SURFACE, metadata={"Date": None})
    fig.savefig(FIGURES_DIR / f"{name}.png", facecolor=SURFACE, dpi=PNG_DPI)
    plt.close(fig)


def style_chart(ax, xlabel: str, ylabel: str) -> None:
    ax.set_facecolor(SURFACE)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID)
        ax.spines[side].set_linewidth(LINE_WIDTH_PT / 2)
    ax.grid(axis="y", color=GRID, linewidth=LINE_WIDTH_PT / 2)
    ax.set_axisbelow(True)
    ax.tick_params(colors=TEXT_SECONDARY, labelsize=pt(TICK), length=0, pad=pt(0.05))
    ax.set_xlabel(xlabel, color=TEXT_SECONDARY, fontsize=pt(LABEL), labelpad=pt(0.08))
    ax.set_ylabel(ylabel, color=TEXT_SECONDARY, fontsize=pt(LABEL), labelpad=pt(0.08))


def chart_label(fig, text: str) -> None:
    """Descriptive label above a chart: what is plotted, scope, unit, timeframe. The takeaway
    belongs in the poster headline, so this carries no figures."""
    fig.text(0.01, 0.985, text, ha="left", va="top", color=TEXT_SECONDARY, fontsize=pt(TICK),
             linespacing=1.25)


# ---- maps -------------------------------------------------------------------------------------


def map_figure(group: pd.DataFrame, column: str, origin_row: pd.Series, stations: pd.DataFrame):
    lat_lo, lat_hi = stations["lat"].quantile([BOUNDS_TRIM_FRACTION, 1 - BOUNDS_TRIM_FRACTION])
    lon_lo, lon_hi = stations["lon"].quantile([BOUNDS_TRIM_FRACTION, 1 - BOUNDS_TRIM_FRACTION])
    pad_lat, pad_lon = (lat_hi - lat_lo) * 0.06, (lon_hi - lon_lo) * 0.06
    lat_lo, lat_hi, lon_lo, lon_hi = lat_lo - pad_lat, lat_hi + pad_lat, lon_lo - pad_lon, lon_hi + pad_lon
    # Figure shaped to the map: full wall height (4 screens), width from the map's true aspect.
    height_in = 4 * SCREEN_IN
    width_in = height_in * (lon_hi - lon_lo) * COS_LAT / (lat_hi - lat_lo)
    fig = plt.figure(figsize=(width_in, height_in), facecolor=SURFACE)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    ax.set_xlim(lon_lo, lon_hi)
    ax.set_ylim(lat_lo, lat_hi)
    ax.set_aspect(1 / COS_LAT)

    size = pt(DOT_DIAMETER) ** 2  # scatter sizes are in points²
    missing = group[group[column].isna()]
    ax.scatter(missing["lon"], missing["lat"], s=size, facecolors="none", edgecolors=NO_ROUTE,
               linewidths=LINE_WIDTH_PT / 2)
    reached = group[group[column].notna()]
    bands = pd.cut(reached[column], TIME_BINS, labels=False, include_lowest=True)
    # Far stations first so the bright, near ones sit on top.
    for band in reversed(range(len(TIME_COLOURS))):
        subset = reached[bands == band]
        ax.scatter(subset["lon"], subset["lat"], s=size, color=TIME_COLOURS[band], linewidths=0)
    ax.scatter([origin_row["lon"]], [origin_row["lat"]], s=size * 9, facecolors="none",
               edgecolors=TEXT_PRIMARY, linewidths=LINE_WIDTH_PT, zorder=5)
    return fig


def key_figure():
    size = pt(LABEL)
    handles = [Line2D([], [], marker="o", linestyle="", markersize=size, color=colour, label=label)
               for colour, label in zip(TIME_COLOURS, TIME_LABELS)]
    handles.append(Line2D([], [], marker="o", linestyle="", markersize=size, markerfacecolor="none",
                          markeredgecolor=NO_ROUTE, markeredgewidth=LINE_WIDTH_PT / 2,
                          label="no step-free route"))
    handles.append(Line2D([], [], marker="o", linestyle="", markersize=size, markerfacecolor="none",
                          markeredgecolor=TEXT_PRIMARY, markeredgewidth=LINE_WIDTH_PT,
                          label=ORIGIN_NAME))
    fig = plt.figure(figsize=(1.8 * SCREEN_IN, 2 * SCREEN_IN), facecolor=SURFACE)
    fig.legend(handles=handles, loc="center", frameon=False, fontsize=size,
               labelcolor=TEXT_SECONDARY, handletextpad=0.7, labelspacing=1.0,
               title="Journey time", title_fontsize=size, alignment="left")
    fig.legends[0].get_title().set_color(TEXT_PRIMARY)
    return fig


# ---- charts -----------------------------------------------------------------------------------


def reach_curve_figure(group: pd.DataFrame):
    minutes = np.arange(0, 91)
    curves = {
        "With stairs": ([(group["any_min"] <= m).sum() for m in minutes], WITH_STAIRS),
        "Step-free": ([(group["step_free_min"] <= m).sum() for m in minutes], STEP_FREE),
    }
    fig, ax = plt.subplots(figsize=(4 * SCREEN_IN, 2.25 * SCREEN_IN), facecolor=SURFACE)
    style_chart(ax, "Journey time (minutes)", "")
    for label, (counts, colour) in curves.items():
        ax.plot(minutes, counts, color=colour, linewidth=LINE_WIDTH_PT)
    # Direct labels instead of a legend, placed where the two lines are far apart (both lines
    # end near the top, so end labels would collide): with stairs up-left of its steep rise,
    # step-free down-right of its own.
    stairs, step_free = curves["With stairs"][0], curves["Step-free"][0]
    ax.text(27, stairs[27] + 70, "With stairs", ha="right", va="bottom", color=TEXT_PRIMARY,
            fontsize=pt(LABEL))
    ax.text(64, step_free[64] - 70, "Step-free", ha="left", va="top", color=TEXT_PRIMARY,
            fontsize=pt(LABEL))
    # Mark the 45-minute threshold and the two values it produces: the poster's headline numbers.
    ax.axvline(REACH_THRESHOLD_MIN, color=TEXT_SECONDARY, linewidth=LINE_WIDTH_PT / 2, linestyle="--")
    for label, (counts, colour) in curves.items():
        value = counts[REACH_THRESHOLD_MIN]
        ax.scatter([REACH_THRESHOLD_MIN], [value], s=pt(0.06) ** 2, color=colour, zorder=5,
                   edgecolors=SURFACE, linewidths=LINE_WIDTH_PT / 2)
        ax.annotate(f"{value}", (REACH_THRESHOLD_MIN, value), xytext=(pt(0.06), 0),
                    textcoords="offset points", va="center", color=TEXT_PRIMARY,
                    fontsize=pt(LABEL), fontweight="bold")
    ax.text(REACH_THRESHOLD_MIN, ax.get_ylim()[1], f" {REACH_THRESHOLD_MIN} min", va="top",
            color=TEXT_SECONDARY, fontsize=pt(TICK))
    ax.set_xlim(0, 90)
    ax.set_ylim(0, len(group) * 1.02)
    chart_label(fig, "Stations reachable from South Kensington\nby journey time, weekday 9am")
    fig.tight_layout(pad=pt(0.003), rect=(0, 0, 1, 0.84))
    return fig


def extra_minutes_figure(group: pd.DataFrame):
    penalty = group["penalty_min"].dropna()
    median = penalty.median()
    fig, ax = plt.subplots(figsize=(4 * SCREEN_IN, 2.25 * SCREEN_IN), facecolor=SURFACE)
    style_chart(ax, "Extra minutes step-free", "Stations")
    # 5-minute bins with a thin surface-coloured gap between bars.
    ax.hist(penalty, bins=np.arange(0, penalty.max() + 5, 5), color=STEP_FREE,
            edgecolor=SURFACE, linewidth=LINE_WIDTH_PT / 2)
    # Headroom above the tallest bar so the median label never touches it.
    ax.set_ylim(0, ax.get_ylim()[1] * 1.18)
    ax.axvline(median, color=TEXT_PRIMARY, linewidth=LINE_WIDTH_PT / 2, linestyle="--")
    ax.text(median, ax.get_ylim()[1], f"  median +{median:.0f} min", va="top",
            color=TEXT_PRIMARY, fontsize=pt(LABEL), fontweight="bold")
    chart_label(fig, "Extra journey time step-free\nSouth Kensington to each station, weekday 9am")
    fig.tight_layout(pad=pt(0.003), rect=(0, 0, 1, 0.84))
    return fig


def main() -> None:
    times = load_times()
    stations = pd.read_csv(CACHE_DIR / "stations.csv")
    group = times[times["origin"] == ORIGIN]
    origin_row = stations.loc[stations["station_id"] == group_origin_station(ORIGIN, stations)].iloc[0]

    save(map_figure(group, "any_min", origin_row, stations), "sk_map_with_stairs")
    save(map_figure(group, "step_free_min", origin_row, stations), "sk_map_step_free")
    save(key_figure(), "key")
    save(reach_curve_figure(group), "sk_reach_curve")
    save(extra_minutes_figure(group), "sk_extra_minutes")
    print("wrote", sorted(p.stem for p in FIGURES_DIR.glob("*.svg")))


if __name__ == "__main__":
    main()
