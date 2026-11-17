# Step-free London: who can get where?

How much smaller does London get if you can't use stairs? This repo holds the data analysis
behind a poster for Imperial's Data Observatory,
built in Vizzy Studio for the Data for Humanity Internship application.

![Stations reachable from South Kensington within a weekday-morning journey, for everyone and for step-free travellers](scripts/step_free/output/figures/map_south_kensington.png)

## Key findings

Journeys from four stations to every station on London's rail network, departing Tuesday
24 November 2026 at 09:00, from the TfL Journey Planner API:

| From             | Stations within 45 min: everyone | Step-free | Share of reach kept |
| ---------------- | -------------------------------- | --------- | ------------------- |
| South Kensington | 418                              | 93        | 22%                 |
| Wembley Park     | 280                              | 119       | 43%                 |
| Brixton          | 397                              | 174       | 44%                 |
| Stratford        | 366                              | 224       | 61%                 |

- From Imperial's own station, **South Kensington to Bank takes 22 minutes, or 54 minutes
  step-free**.
- The typical journey from South Kensington takes **26 minutes longer** step-free.
- **Where you start matters**: of the four origins tested, Imperial's station loses the most.

These are planned journeys, and for stations without step-free access the step-free route ends at
the street entrance, so the real gap is larger. Full method and caveats:
[scripts/step_free/README.md](scripts/step_free/README.md).

## What's in this repo

| Path                                                   | Contents                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| [docs/NARRATIVE.md](docs/NARRATIVE.md)                 | The story: key message, audience, takeaway and the poster's section layout. |
| [scripts/step_free/](scripts/step_free/README.md)      | Python pipeline: fetches journeys, computes reach, draws the figures.       |
| [scripts/step_free/output/](scripts/step_free/output/) | Results (`summary.json`, per-station times) and wall-ready SVG/PNG figures. |
| `apps/website/`                                        | Interactive wall version, built on the DSI Developer Playground (below).    |

## Interactive version for the Data Observatory wall

The same story as a live, operator-driven wall app, built on the DSI Developer Playground.

- **The wall splits in two:** columns 0–7 map travel times for everyone, columns 8–15 step-free
  travel times. Each half is one continuous map of London across its screens.
- **An operator tablet (`/control`) drives the story:** pick a starting station (South
  Kensington, Wembley Park, Stratford, Brixton) and step through three scenes: _London_ (network
  only), _Everyone_ (left half lights up), _Step-free_ (right half lights up alongside, with the
  share of reach kept).
- **Text sits on whole screens, never across a bezel,** at 20% of screen height for the
  headline. Colour changes fade slowly; nothing flashes.

Run it: `pnpm install`, `pnpm dev`, then open <http://localhost:5780>. The home page simulates
the wall at half scale (8 × 2 screens, the same 7:1 shape as the real 16 × 4) with two
tablets. On the real wall each screen loads `/screen?c=<column>&r=<row>`; without `cols`/`rows`
parameters, screens assume the full 16 × 4 wall.

How it follows the playground's [best practices](BEST_PRACTICES.md):

- Tablets send small, complete commands (`control/origin`, `control/scene`). The bus validates
  them, forwards only the validated fields, and keeps the current state for the `hello`
  snapshot, so a screen that reloads mid-story rejoins in step.
- Screens validate every message and the dataset before using them; tests cover this
  (`pnpm run ready` runs format, lint, tests and build).
- Everything a screen draws is computed from the shared state, the dataset and its own
  position, so all screens agree without talking to each other.

Known issue: the starter's luma.gl 9.2.6 throws on startup in the deck.gl renderer
("reading 'maxTextureDimension2D'"), so screens use the MapLibre renderer by default. The
deck.gl path is still available with `?renderer=deck` for testing.

## Reproduce the analysis

You need Python 3.12 and a free TfL API key from <https://api-portal.tfl.gov.uk/>, saved in
`.env.local` at the repo root as `TFL_APP_KEY=...`.

```bash
pip install -r scripts/step_free/requirements.txt
python scripts/step_free/fetch_journeys.py      # ~4,800 API calls, ~15 minutes, cached locally
cd scripts/step_free && python analyse.py       # writes output/
```

## Credits

- Analysis and poster by Zak Nabi, Imperial College London.
- Powered by the Transport for London Journey Planner API. Data provided by Transport for London.
- Built on the [Data Observatory Developer Playground](https://github.com/dsi-icl/do-starter-playground)
  by Imperial's Data Science Institute, licensed under Apache 2.0 (see [LICENSE](LICENSE)).
