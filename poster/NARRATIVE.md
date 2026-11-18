# Step-free London: core narrative

Following the Data Observatory Content Planner. The poster tells this story from South
Kensington; the playground lets an operator compare four starting stations. The analysis behind
every number is in [analysis/](analysis/README.md).

## Core narrative

- **Key message:** If you can't use stairs, London becomes a smaller and slower city. From
  Imperial's own station, South Kensington, a weekday-morning journey to Bank takes 22 minutes by
  Tube, or 54 minutes step-free. Within 45 minutes, someone who can use stairs can reach 418
  stations; a step-free traveller can reach 93.
- **Audience:** People who visit the Data Observatory: Imperial staff and students, visiting
  partners and policymakers. Most of them use the Tube without thinking about stairs. They care
  about London working well and working fairly, and some of them make decisions that shape it.
- **Takeaway:**
    - _Learn:_ step-free access is not a yes/no label on a station map. It changes how far you
      can get in a given time.
    - _Feel:_ surprise that the same city shrinks so much for some people, and a sense that the
      gap can be measured, so it can be closed.
- **Evidence & visuals:**
    - Two travel-time maps from South Kensington: _with stairs_ and _step-free_.
    - A reach curve: stations reachable within each journey time, both ways.
    - The extra minutes per journey step-free.

## Story arc (left to right across the wall)

| Section          | Content                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**        | _Step-free London: who can get where?_ Who needs step-free journeys: wheelchair users, people with pushchairs, heavy luggage or an injury, and many older people. |
| **Exploration**  | South Kensington to Bank takes 54 minutes step-free instead of 22, because South Kensington has no lifts.                                                         |
| **Insight**      | Within 45 minutes, step-free travellers reach 93 stations; with stairs, 418. Under a quarter.                                                                     |
| **Implications** | A typical journey takes 26 minutes longer. TfL's planner finds no step-free journey at all to Barons Court, six minutes away with stairs.                         |
| **Future**       | Key insights, recommendations (measure accessibility by reach; rank upgrades by the gap they close) and a vision of a live step-free reach map.                   |

## Data sources

| Data             | Source                                                                                                   | Use                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| Journey times    | TfL Unified API `/Journey/JourneyResults`, with and without `accessibilityPreference=StepFreeToPlatform` | Maps, reach, extra time |
| Station topology | `api.tfl.gov.uk/stationdata/tfl-stationdata-detailed.zip` (509 stations)                                 | Station list, locations |

## Method decisions

- **When:** Tuesday 24 November 2026, 09:00, so results are reproducible and reflect a normal
  weekday morning.
- **Where to:** all 508 other stations in TfL's topology data.
- **Reach threshold:** 45 minutes, a typical commute.
- **Caveats to state on the wall:** step-free journeys count a station as reached at its street
  entrance and assume every lift works, so the real difference is larger. Full method and
  caveats: [analysis/README.md](analysis/README.md).
