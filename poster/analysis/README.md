# Step-free London: data pipeline

Compares how far you can travel across London's rail network on a weekday morning with and
without step-free access, using TfL's Journey Planner API. It produces the poster's figures and
the dataset for the interactive playground version.

| Script                   | What it does                                                          | Writes                                                         |
| ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `fetch_journeys.py`      | Asks the Journey Planner for every journey, with stairs and step-free | `cache/` (not committed)                                       |
| `analyse.py`             | Fastest time per station, headline numbers, the playground's dataset  | `output/summary.json`, `output/station_times.csv`, app dataset |
| `make_poster_figures.py` | The five South Kensington poster figures                              | `../figures/`                                                  |

The app dataset is `apps/website/public/data/step-free.json`.

## Results (Tuesday 24 November 2026, 09:00 departure)

| From             | Stations within 45 min: with stairs | Step-free | Median extra time step-free |
| ---------------- | ----------------------------------- | --------- | --------------------------- |
| South Kensington | 418                                 | 93        | 26 min                      |
| Wembley Park     | 280                                 | 119       | 14 min                      |
| Stratford        | 366                                 | 224       | 13 min                      |
| Brixton          | 397                                 | 174       | 14 min                      |

Out of 508 destination stations. The poster uses South Kensington; the playground lets the
operator switch between all four. Full numbers: [output/summary.json](output/summary.json);
per-station times: [output/station_times.csv](output/station_times.csv).

## Method

1. **Stations:** TfL's station topology data (509 stations, published 20 October 2026). Each
   station's location is the mean of its entrance and platform coordinates.
2. **Journeys:** for each origin and destination, the Journey Planner is asked for the fastest
   journey departing Tuesday 24 November 2026 at 09:00, by Tube, DLR, Overground, Elizabeth line,
   tram, National Rail, bus and walking. It is asked twice: with no restriction (TfL's "no
   requirements", here "with stairs"), and with `accessibilityPreference=StepFreeToPlatform`.
3. **Hubs:** 92 stations are TfL "hubs" that group several stations (e.g. Bank = Bank Underground
   and Bank DLR). Each member station is queried and the fastest time is kept: a hub counts as
   reached if any part of it is. With 4 origins, 600 destination stops and 2 versions, that is
   4,800 queries (1,200 from South Kensington).
4. **Reach:** a station is "within reach" if the fastest journey takes 45 minutes or less.

The departure is fixed so the results are reproducible. TfL's planned status for that morning
showed good service on all Tube, Overground, Elizabeth line, DLR and tram lines.

### Caveats

- **What "step-free" means here.** For a destination station that is not itself step-free, the
  planner's step-free route ends at the street entrance, often by bus. So step-free times measure
  how long it takes to reach that part of London, not that station's platforms; the true gap for
  someone who needs to board a train there is larger.
- **Planned, not real, journeys.** Lifts that are out of service make real journeys worse.
- **One moment in time.** Results are for a single weekday-morning departure.
- **No step-free route.** For 5 stations (Barons Court, Bethnal Green, Covent Garden, Croxley,
  Moor Park) the planner returns no journey with any accessibility setting, even to the street
  outside. For Barons Court it offers a 31-minute bus and walk without one. This is the planner's
  answer, not proof a place is unreachable.
- Three hub member stops (Heathrow T4 rail, New Cross, New Cross Gate) can't be resolved by the
  planner; their hubs are still covered by their other member stations, so no station is lost.

## Regenerate

Requires a free TfL API key from <https://api-portal.tfl.gov.uk/>, saved in `.env.local` at the
repo root as `TFL_APP_KEY=...`. From the repo root:

```bash
conda create -n dfh python=3.12 -y && conda activate dfh
pip install -r poster/analysis/requirements.txt

python poster/analysis/fetch_journeys.py       # ~4,800 API calls, ~15 min; cached, so re-runs are quick
python poster/analysis/analyse.py              # output/ and the app dataset
python poster/analysis/make_poster_figures.py  # poster/figures/
```

Every output is deterministic: re-running produces byte-identical files.

Powered by the Transport for London Journey Planner API. Data provided by Transport for London.
