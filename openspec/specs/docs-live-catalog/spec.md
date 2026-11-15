# docs-live-catalog Specification

## Purpose
Shows the model catalog, prices and release notes inside the docs from live sources, so `/models/`, `/changelog/` and its RSS feed do not lag the product.

## Requirements

### Requirement: Model catalog page
`/models/` SHALL list the public Apertis model catalog from `https://api.apertis.ai/api/v2/models/`, every page of it, with exactly the filtering that apertis.ai applies before rendering its own catalog: hidden model IDs, disabled models, and anything else it excludes. For each model it shows:
- the display name;
- the copyable model ID;
- the provider and category;
- the context length;
- the prices, with the units and charge type that apertis.ai's catalog list shows for that model.

apertis.ai excludes deprecated models from its catalog, so `/models/` excludes them too and shows no deprecation label (packet E finding, from the apertis.ai catalog source).

Readers can filter by text, provider and category. Without JavaScript, the full table is shown.

The page renders from a build-time snapshot, and then swaps in the edge-cached live data from `/_nimbus/catalog`. An upstream failure answers 502 and is not cached, and the page then keeps the snapshot. Models that apertis.ai excludes SHALL NOT appear in any catalog output: `/models/`, its snapshot, `/_nimbus/catalog`, the search index, `llms*` or MCP. Release-note text is apertis.ai's public changelog reproduced as published, so it may name models the catalog no longer lists.

#### Scenario: Prices match apertis.ai
- **WHEN** a model in the snapshot is compared with `https://apertis.ai/models/<model id>`
- **THEN** the prices, units and charge type are the same

#### Scenario: Hidden model
- **WHEN** a model ID is in the catalog's `hidden_model_ids`, or is otherwise excluded by apertis.ai
- **THEN** no catalog output contains it

### Requirement: Changelog page and feed
`/changelog/` SHALL list the public release notes (`https://apertis.ai/api/changelog`), newest first. Each note shows a summary (its version, date, category tag, title and description, as text, never as raw HTML) and a link to the full note on apertis.ai, which holds its body, images and demos. The page is rendered from the build's copy and refreshed after load from `/_nimbus/changelog`, the same notes served live and edge-cached for ten minutes; if that fails, the build's copy stays. Readers can filter by category. Without JavaScript, the build's copy is listed in full.

`/changelog/rss.xml` SHALL be a live RSS 2.0 feed of the same notes, edge-cached for ten minutes. Each note is an item with a guid made of its version, a link to `/changelog/#<version>`, and a category. An upstream failure answers 503 with `Retry-After`, and that response is not cached. `/changelog/` advertises the feed with `<link rel="alternate" type="application/rss+xml">`.

The navbar's Release Notes item SHALL point to `/changelog/`.

#### Scenario: Feed is valid
- **WHEN** `/changelog/rss.xml` is fetched
- **THEN** it parses as RSS 2.0, and its items are the release notes newest first, each with a unique guid

#### Scenario: Live refresh
- **WHEN** `/changelog/` loads and `/_nimbus/changelog` answers a non-empty list
- **THEN** the page lists those notes, each with its link to the full note on apertis.ai; if the request fails, the build's copy stays

#### Scenario: Category filter
- **WHEN** the reader selects the category `fix`
- **THEN** only notes with the category `fix` remain listed
