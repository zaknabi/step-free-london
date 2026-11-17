# Step-free London: core narrative

Following the Data Observatory Content Planner. Built as a poster in Vizzy Studio; the analysis
behind every number is in [scripts/step_free/](../scripts/step_free/README.md).

## Core narrative

- **Key message:** If you can't use stairs, London becomes a smaller and slower city. From
  Imperial's own station, South Kensington, a weekday-morning journey to Bank takes 22 minutes by
  Tube, or 54 minutes step-free. Within 45 minutes, everyone else can reach 418 stations; a
  step-free traveller can reach 93.
- **Audience:** People who visit the Data Observatory: Imperial staff and students, visiting
  partners and policymakers. Most of them use the Tube without thinking about stairs. They care
  about London working well and working fairly, and some of them make decisions that shape it.
- **Takeaway:**
    - _Learn:_ step-free access is not a yes/no label on a station map. It changes how far you
      can get in a given time, and how much you lose depends on where you start.
    - _Feel:_ surprise that the same city shrinks so much for some people, and a sense that the
      gap can be measured, so it can be closed.
- **Evidence & visuals:**
    - Two travel-time maps side by side from South Kensington: _everyone_ vs _step-free_.
    - The same comparison from Wembley Park, Stratford and Brixton.
    - Reach comparison: stations within 45 minutes for each group, from all four origins.

## Story arc (left to right across the wall)

| Section             | Content                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**           | _Step-free London: who can get where?_ Zak Nabi, Imperial College London. Powered by the Transport for London Journey Planner API.                                                        |
| **Problem/context** | Hook: South Kensington to Bank, 22 vs 54 minutes. Who needs step-free journeys: wheelchair users, people with pushchairs, heavy luggage or an injury, and many older people.              |
| **Exploration**     | The two South Kensington maps: London lit up within 45 minutes for everyone, and for step-free travellers.                                                                                |
| **Insight**         | From South Kensington, step-free travellers reach 93 stations in 45 minutes against 418 for everyone else: under a quarter. From Stratford they keep 224 of 366. Where you start matters. |
| **Implications**    | A median 26 extra minutes per journey from Imperial's station; fewer places within reach for work, study and care. Lift outages make real journeys worse than these planned ones.         |
| **Future**          | Next step: rank which station upgrades would close the most gap, by re-running the analysis with each candidate station made step-free.                                                   |

## Data sources

| Data             | Source                                                                                                   | Use                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| Journey times    | TfL Unified API `/Journey/JourneyResults`, with and without `accessibilityPreference=StepFreeToPlatform` | Maps, reach, extra time |
| Station topology | `api.tfl.gov.uk/stationdata/tfl-stationdata-detailed.zip` (509 stations)                                 | Station list, locations |

## Method decisions

- **When:** Tuesday 24 November 2026, 09:00, so results are reproducible and reflect a normal
  weekday morning.
- **Where to:** all 508 other stations in TfL's topology data. Origins: South Kensington, Wembley
  Park, Stratford and Brixton.
- **Reach threshold:** 45 minutes, a typical commute.
- **Caveats to state on the wall:** these are TfL's _planned_ step-free routes, and for stations
  without step-free access they end at the street entrance. Real journeys can be worse. Full
  method and caveats: [scripts/step_free/README.md](../scripts/step_free/README.md).
