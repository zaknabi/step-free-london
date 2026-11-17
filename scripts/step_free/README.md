# Step-free London: data pipeline

Compares how far you can travel across London's rail network in a weekday morning with and
without step-free access, using TfL's Journey Planner API. The outputs feed the Data
Observatory poster described in [docs/NARRATIVE.md](../../docs/NARRATIVE.md).

## Results (Tuesday 24 Nov 2026, 09:00 departure)

| From             | Stations within 45 min: everyone | Step-free | Median extra time step-free |
| ---------------- | -------------------------------- | --------- | --------------------------- |
| South Kensington | 418                              | 93        | 26 min                      |
| Wembley Park     | 280                              | 119       | 14 min                      |
| Stratford        | 366                              | 224       | 13 min                      |
| Brixton          | 397                              | 174       | 14 min                      |

Out of 508 destination stations. Full numbers: [output/summary.json](output/summary.json);
per-station times: [output/station_times.csv](output/station_times.csv); figures:
[output/figures/](output/figures/).

## Method

1. **Stations:** TfL's station topology data (509 stations, published 20 Oct 2026). Each station's
   location is the mean of its entrance and platform coordinates.
2. **Journeys:** for each origin and destination, the Journey Planner is asked for the fastest
   journey departing Tuesday 24 Nov 2026 at 09:00, by Tube, DLR, Overground, Elizabeth line, tram,
   National Rail, bus and walking. It is asked twice: with no restriction, and with
   `accessibilityPreference=StepFreeToPlatform`.
3. **Hubs:** 92 stations are TfL "hubs" that group several stations (e.g. Bank = Bank Underground +
   Bank DLR). Each member station is queried and the fastest time is kept: a hub counts as reached
   if any part of it is.
4. **Reach:** a station is "within reach" if the fastest journey takes 45 minutes or less.

### Caveats

- **What "step-free" means here.** For a destination station that is not itself step-free, TfL's
  planner returns a step-free route to the station's street entrance, often by bus. So the
  step-free times measure how long it takes to reach that part of London, not that station's
  platforms. The true gap for someone who needs to board a train there is larger.
- **Planned, not real, journeys.** Lifts that are out of service make real journeys worse.
- **One moment in time.** Results are for a single weekday-morning departure; timetables vary.
- Three hub member stops (Heathrow T4 rail, New Cross, New Cross Gate) can't be resolved by the
  planner; their hubs are still covered by their other member stations, so no station is lost.
- For 5 stations the planner returns no step-free route at all; these show as "no route found".

## Regenerate

Requires a free TfL API key from <https://api-portal.tfl.gov.uk/>, saved in `.env.local` at the
repo root as `TFL_APP_KEY=...`.

```bash
conda create -n dfh python=3.12 -y && conda activate dfh
pip install -r scripts/step_free/requirements.txt

python scripts/step_free/fetch_journeys.py   # ~4,800 API calls, ~15 min; cached in scripts/step_free/cache/
cd scripts/step_free && python analyse.py    # writes output/
```

Raw API responses are cached under `scripts/step_free/cache/` (not committed), so re-running only
fetches what is missing.

Powered by the Transport for London Journey Planner API. Data provided by Transport for London.
