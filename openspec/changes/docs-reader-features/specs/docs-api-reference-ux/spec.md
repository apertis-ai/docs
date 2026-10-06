## ADDED Requirements

### Requirement: Code tab groups
In the legacy sources, two or more adjacent fenced code blocks, each with the info-string attribute `tab="<Label>"` and nothing between them but whitespace, SHALL form one tab group. Each group renders as an accessible tablist following the WAI-ARIA tabs pattern:
- arrow keys, Home and End move between tabs;
- the selected tab is `aria-selected`;
- each panel keeps its copy button.

The first tab is selected unless a persisted choice matches a label in the group.

Without JavaScript, every panel is visible, labelled with its tab name. Fences without `tab` render exactly as before. The clean Markdown artifact keeps each fence as authored.

Pages without a tab group SHALL load no tab code. On a page with one, selecting a tab SHALL cause no layout shift beyond the budgets in `migration/nimbus/budgets.json`.

#### Scenario: Group renders as tabs
- **WHEN** a page has adjacent fences tagged `tab="cURL"`, `tab="Python"` and `tab="JavaScript"`
- **THEN** one tablist with those three tabs is rendered, and only the selected panel is shown

#### Scenario: Untagged adjacent fences
- **WHEN** a request fence is followed by a response fence and neither carries `tab`
- **THEN** both render as separate code blocks, as before

### Requirement: Persisted language choice
Selecting a tab SHALL select the same label in every group on the page. The label SHALL persist in `localStorage` (key `apertis-docs:code-tab`), so that on any later page each group whose labels include it opens on it. Storage access SHALL be guarded, so that a blocked or empty storage falls back to the first tab without error.

#### Scenario: Choice follows the reader
- **WHEN** the reader selects Python on `/api/text-generation/chat-completions/` and opens `/api/text-generation/responses/`
- **THEN** every group there that has a Python tab opens on Python

### Requirement: SDK samples
The request samples of these pages SHALL become tab groups:
- `/api/text-generation/chat-completions/`, `/api/text-generation/responses/` and `/api/embeddings/embeddings-api/` each have cURL, Python (OpenAI SDK) and JavaScript (OpenAI SDK);
- `/api/text-generation/messages/` has cURL, Python (Anthropic SDK) and TypeScript (Anthropic SDK);
- `/api/utilities/models/` has cURL, Python and JavaScript.

Base URLs, header names and request shapes SHALL match the ones already documented on the Apertis API pages. Model IDs SHALL exist in the public catalog. Every sample SHALL pass a syntax check: `bash -n`, `python3 -m py_compile`, and `node --check` (JavaScript) or type-stripping (TypeScript).

#### Scenario: Samples are valid
- **WHEN** the sample check runs
- **THEN** every tab sample passes its syntax check, and every model ID it names is in the public catalog snapshot

### Requirement: Try it
Every cURL sample that sends a request to `https://api.apertis.ai/v1/…` SHALL offer a Try it control. It opens an inline panel with:
- the method and URL;
- an API-key field (type password, `autocomplete=off`);
- an editable JSON body prefilled from the sample;
- a Send button.

Sending makes one `fetch` from the reader's browser to that URL with `Authorization: Bearer <key>`. It shows the HTTP status, the elapsed time and the response body. A streamed (`text/event-stream`) response is shown as it arrives. An invalid JSON body, a network or CORS failure, and every non-2xx status SHALL be shown as visible errors. The panel states that requests run with the reader's key and are billed to their account.

The key SHALL live only in memory for the life of the panel. It SHALL never be written to storage, a URL, logs, analytics or any request to another host. Requests SHALL go only to `https://api.apertis.ai`.

The panel code SHALL load only when Try it is first opened. Pages without such a sample load nothing for it.

#### Scenario: Wrong key
- **WHEN** the reader sends with a key the gateway rejects
- **THEN** the panel shows the 401 status and the error body, and the key is not persisted anywhere

#### Scenario: Invalid body
- **WHEN** the body is not valid JSON
- **THEN** no request is sent and the panel shows the parse error

### Requirement: Choosing an API format
`/api/` SHALL have a section "Choosing an API format" comparing Chat Completions, Responses and Messages as served by the gateway: endpoint, compatible SDK, when to choose it, and the features each documents (streaming, tools, reasoning, prompt caching). It SHALL link each page. Every statement SHALL be taken from the existing Apertis API pages.

#### Scenario: Reader picks a format
- **WHEN** the reader opens `/api/#choosing-an-api-format`
- **THEN** a table compares the three formats and links `/api/text-generation/chat-completions/`, `/api/text-generation/responses/` and `/api/text-generation/messages/`
