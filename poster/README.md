# Step-free London: Vizzy Studio poster

One poster covering the Data Observatory wall (16 columns × 4 rows of screens), focused on
Imperial's own station, South Kensington. All numbers come from the analysis in
[analysis/](analysis/README.md): TfL Journey Planner, departing Tuesday 24 November 2026 at
09:00. The story behind it is in [NARRATIVE.md](NARRATIVE.md).

| Folder                 | Contents                                                       |
| ---------------------- | -------------------------------------------------------------- |
| [figures/](figures/)   | The five figures to arrange in Vizzy                           |
| [analysis/](analysis/) | Python pipeline that fetches the journeys and draws everything |

The figures are individual pieces to arrange in Vizzy. Upload the **SVG** files from `figures/`
to the Media panel (they stay sharp at any size); each has a PNG fallback.

## Figures

The "native size" is what each figure was designed for: placed at that size, its text meets the
wall legibility rules. Going bigger is fine; going much smaller makes text too small to read
from across the room.

| File                 | What it shows                                                       | Native size (screens, w × h) |
| -------------------- | ------------------------------------------------------------------- | ---------------------------- |
| `sk_map_with_stairs` | London from South Kensington with stairs, stations coloured by time | 3 × 4                        |
| `sk_map_step_free`   | The same, step-free. Identical framing: place them side by side     | 3 × 4                        |
| `key`                | Colour key for both maps                                            | 1 × 2                        |
| `sk_reach_curve`     | Stations reachable within t minutes; marks 418 vs 93 at 45 min      | 2.25 × 2.25                  |
| `sk_extra_minutes`   | How many minutes longer each journey is step-free; median +26       | 2.25 × 2.25                  |

The maps have no titles, so you can label them in Vizzy, e.g. **With stairs: 418 stations within
45 min** and **Step-free: 93 stations within 45 min**.

## Sections

Five sections left to right, following the DO Content Planner.

| Section         | Headline                                                                    | Evidence                                          |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| 1. Title        | Step-free London: who can get where?                                        | Name, logo, who needs step-free, TfL credit       |
| 2. Exploration  | Step-free, South Kensington to Bank takes 54 minutes instead of 22          | `sk_reach_curve`                                  |
| 3. Insight      | Within 45 minutes, step-free travellers reach 93 stations; with stairs, 418 | `sk_map_with_stairs`, `key`, `sk_map_step_free`   |
| 4. Implications | Step-free journeys from South Kensington take a median 26 minutes longer    | `sk_extra_minutes`, Barons Court                  |
| 5. Future       | Key insights · Recommendations · Future vision                              | Text, following the Content Planner's Future page |

Read top to bottom, the headlines alone make the argument: 54 minutes instead of 22, 93
stations instead of 418, 26 minutes longer, then what to do about it. Keep both maps the same
size so their stations line up.

## Text to add in Vizzy

Headlines in off-white. Orange only for step-free numbers and the word "step-free", blue for
with-stairs numbers, so each colour means the same thing on the poster as in the charts. Body
text in light grey.

**1. Title**

- **Step-free London: who can get where?**
- Zak Nabi, Imperial College London
- Who needs step-free journeys: wheelchair users, people with pushchairs or heavy luggage, people
  with an injury, many older people.
- Bottom: Imperial logo, and **Powered by the Transport for London Journey Planner API**
  (required by TfL's terms).

**2. Exploration**

- Headline: **Step-free, South Kensington to Bank takes 54 minutes instead of 22**
- South Kensington has **no lifts** (TfL station data, October 2026), so the step-free route
  starts with a bus to another station.
- Figure: `sk_reach_curve`

**3. Insight**

- Headline: **Within 45 minutes, step-free travellers reach 93 stations; with stairs, 418**
- One line under it: **22%** of the stations reachable with stairs.
- Figures: `sk_map_with_stairs` (label **With stairs**), `key`, `sk_map_step_free` (label
  **Step-free**)

**4. Implications**

- Headline: **Step-free journeys from South Kensington take a median 26 minutes longer**
- **Barons Court**, nearest station to Imperial's Reynolds campus: 6 minutes with stairs. With
  any accessibility setting, **TfL's Journey Planner finds no journey at all**, even to the street
  outside. (Without one it offers a 31-minute bus and walk, which suggests it does not count that
  walk as step-free.)
- No step-free route found to five stations: Barons Court, Bethnal Green, Covent Garden,
  Croxley and Moor Park.
- Figure: `sk_extra_minutes`

**5. Future**

Three blocks, top to bottom, following the Content Planner's Future page. Small off-white
sub-headings.

- **Key insights**
    - From Imperial's station, step-free travellers reach **22%** of the stations reachable with
      stairs within 45 minutes.
    - A typical step-free journey takes **26 minutes longer**.
    - South Kensington has **no lifts**, so every step-free journey from it starts with a bus.
- **Recommendations**
    - Measure accessibility by **reach** (stations within 45 minutes), not by how many stations
      are step-free.
    - Rank station upgrades by how much of the gap each would close; this analysis can do that.
    - Next research steps: repeat from every station, and add live lift outages.
- **Future vision**
    - A live step-free reach map for every London station, updated as lifts go out of service.
    - Built with TfL and disability organisations, and tested with the people who need it. The
      code is open: github.com/zaknabi/do-starter-playground
- Footnotes along the bottom, small:
    - Method: 509 TfL stations, 4,800 Journey Planner queries with and without stairs, departing
      Tuesday 24 November 2026 at 09:00.
    - "No step-free route": TfL's Journey Planner returned no journey to that station with
      step-free access requested. It is the planner's answer, not proof the place is unreachable.
    - Step-free journeys count a station as reached at its street entrance, and assume every lift
      works. So the real difference is larger than shown. Data: TfL (October 2026).

## Design rules

| Rule        | Value                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| Background  | `#1f2029` (matches the figures)                                                            |
| Font        | Imperial Sans Display (already in Vizzy Media)                                             |
| Headlines   | Off-white `#f0efec`                                                                        |
| Body text   | Light grey `#c3c2b7`                                                                       |
| With stairs | Blue `#3987e5` for "with stairs" numbers                                                   |
| Step-free   | Orange `#d95926` for "step-free" numbers                                                   |
| Text size   | Headlines at least 20% of one screen's height (a capital about a fifth of a grid row tall) |
| Bezels      | Keep text off the grid lines between screens where possible                                |

The figures are generated by `analysis/make_poster_figures.py`; see
[analysis/README.md](analysis/README.md).
