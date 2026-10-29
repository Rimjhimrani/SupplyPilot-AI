# SupplyPilot AI

A small, interactive supply chain control tower where a crew of AI agents detects disruptions, compares fixes and reroutes shipments.

**Live demo:** [add your link here]

![SupplyPilot AI screenshot](screenshot.png)

> This is a personal learning project. All shipments, routes and costs are simulated, and the agents follow simple rules in the browser. No real shipping data is used.

## What it does

Trigger a disruption and watch four agents work through it:

| Agent | Job |
| --- | --- |
| Sentinel | Spots the signal (port congestion, typhoon, Red Sea closure, customs hold) |
| Analyst | Finds the affected shipments and the cargo value at risk |
| Planner | Compares three fixes by cost, delay left and confidence, and recommends one |
| Executor | Reroutes shipments, updates costs and notifies carriers once a plan is approved |

You can approve a plan yourself, or switch on **Autopilot** to let the agent approve its own recommendation. The live map, KPI strip and shipment table update after every action. You can also ask the agent what is at risk, what its actions have cost, and why it chose its recommendation.

## Run it

No install or build step is needed.

1. Download or clone this repo.
2. Open `index.html` in a browser.

Fonts load from Google Fonts, so it looks best with an internet connection.

## Project structure

```
index.html    app shell: sidebar, Overview view, Control tower view
style.css     navy and teal design tokens, layout, components
data.js       synthetic data and SPApi (the one place to swap in a real backend)
script.js     control tower: shipments, disruptions, agent flow, map, table
overview.js   Executive Dashboard: KPI cards, trends, charts, suppliers
app.js        small hash router for the sidebar views
```

## Build status

Done:
- Executive Dashboard with five KPI cards, trend indicators, sparklines, interactive charts and supplier performance
- Navy and teal theme, sidebar navigation, loading and error states
- Autopilot off by default, and every action labelled as simulated

Not built yet (so nothing here claims it works): Risk Center, Copilot chat, What-if planner, Inventory forecasting, Action Center with audit history, FastAPI and PostgreSQL backend, LLM tool calling.

Preview the error state by opening the page with `?simulateError=1` at the end of the address.

## Customize

- **Shipments:** edit the `BASE` array in `script.js`.
- **Locations:** edit `NODES`. The `x` and `y` values are positions on the 800 by 400 map.
- **Disruptions and fixes:** edit `EVENTS`. Each event lists the shipments it affects, the delay it causes and the options the Planner offers.

## Ideas for next steps

- Let a language model write the Analyst summary and choose between options (call the API from a small backend so your key stays private).
- Feed real data: a CSV upload, an ERP export, vessel tracking or weather APIs.
- Add more disruptions, such as a supplier shortage or a demand spike.
- Add a cost versus delay chart for the Planner's options.

## Tech

Plain HTML, CSS and JavaScript. The map is SVG and the animation uses `requestAnimationFrame`. No frameworks or dependencies.
