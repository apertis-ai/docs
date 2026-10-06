## ADDED Requirements

### Requirement: Model catalog page
`/models/` SHALL list the public Apertis model catalog from `https://api.apertis.ai/api/v2/models/`, every page of it, with exactly the filtering that apertis.ai applies before rendering its own catalog: hidden model IDs, disabled models, and anything else it excludes. For each model it shows:
- the display name;
- the copyable model ID;
- the provider and category;
- the context length;
- the prices, with the units and charge type that apertis.ai's catalog list shows for that model.

apertis.ai excludes deprecated models from its catalog, so `/models/` excludes them too and shows no deprecation label (packet E finding).

Readers can filter by text, provider and category. Without JavaScript, the full table is shown.

The page renders from a build-time snapshot, and then swaps in the edge-cached live data from `/_nimbus/catalog`. An upstream failure answers 502 and is not cached, and the page then keeps the snapshot. Models that apertis.ai excludes SHALL NOT appear in any catalog output: `/models/`, its snapshot, `/_nimbus/catalog`, the search index, `llms*` or MCP. Release-note text is apertis.ai's public changelog reproduced as published, so it may name models the catalog no longer lists.

#### Scenario: Prices match apertis.ai
- **WHEN** a model in the snapshot is compared with `https://apertis.ai/models/<model id>`
- **THEN** the prices, units and charge type are the same

#### Scenario: Hidden model
- **WHEN** a model ID is in the catalog's `hidden_model_ids`, or is otherwise excluded by apertis.ai
- **THEN** no catalog output contains it

### Requirement: Changelog page and feed
`/changelog/` SHALL list the public release notes (`https://apertis.ai/api/changelog`), newest first. Each note shows its version, date, category tag, title and description; its items are rendered as text, never as raw HTML. Readers can filter by category. Without JavaScript, all notes are listed.

`/changelog/rss.xml` SHALL be a live RSS 2.0 feed of the same notes, edge-cached for ten minutes. Each note is an item with a guid made of its version, a link to `/changelog/#<version>`, and a category. An upstream failure answers 503 with `Retry-After`, and that response is not cached. `/changelog/` advertises the feed with `<link rel="alternate" type="application/rss+xml">`.

The navbar's Release Notes item SHALL point to `/changelog/`.

#### Scenario: Feed is valid
- **WHEN** `/changelog/rss.xml` is fetched
- **THEN** it parses as RSS 2.0, and its items are the release notes newest first, each with a unique guid

#### Scenario: Category filter
- **WHEN** the reader selects the category `fix`
- **THEN** only notes with the category `fix` remain listed
