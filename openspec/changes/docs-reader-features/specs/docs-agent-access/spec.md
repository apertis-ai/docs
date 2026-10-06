## ADDED Requirements

### Requirement: llms.txt index
The candidate SHALL serve `/llms.txt` (text/plain, UTF-8) following the llmstxt.org layout:
- an H1 `Apertis Documentation`;
- a one-paragraph blockquote summary;
- one H2 section per top-level sidebar category, in sidebar order, then an `Other` section for unlisted pages;
- one entry per manifest document whose eligibility has both `publish` and `agent`, written `- [<title>](<absolute URL of its Markdown artifact>): <description>`.

The description is the page header's one-sentence description: the front-matter `description` if present, else the first paragraph. It is collapsed to a single line. No entry SHALL lack a description. No other document, draft, unpublished, internal or non-agent-eligible material SHALL appear. The file is generated at build time from the manifest and is byte-identical across rebuilds of the same source.

#### Scenario: Every eligible page, nothing else
- **WHEN** the candidate is built
- **THEN** the set of URLs in `/llms.txt` equals the set of Markdown artifact URLs of the documents that are both `publish`- and `agent`-eligible
- **AND** `page:index`, every retired row and every draft article are absent

#### Scenario: Entry has a description
- **WHEN** any entry of `/llms.txt` is read
- **THEN** it has a non-empty description after `: `

### Requirement: llms-full.txt corpus
The candidate SHALL serve `/llms-full.txt` (text/plain, UTF-8). It holds the clean Markdown artifact of every `/llms.txt` entry, in the same order. Each artifact is preceded by a line `Source: <absolute canonical URL>`, and the artifacts are separated by a line `---`. Its content SHALL derive only from those artifacts.

#### Scenario: Corpus matches the artifacts
- **WHEN** the candidate is built
- **THEN** the body under each `Source:` line equals the bytes of that page's `.md` artifact

### Requirement: Docs MCP endpoint
`POST /mcp` SHALL implement a stateless MCP server over Streamable HTTP with JSON responses (JSON-RPC 2.0). It needs no key or session, and it supports:
- `initialize`;
- `notifications/initialized`, answered 202 with no body;
- `ping`;
- `tools/list`;
- `tools/call`.

It SHALL expose two tools:
- `search_docs` with `{query: string, limit?: 1..10}`. It returns ranked pages, each with its title, URL and a text snippet.
- `get_page` with `{url: string}`. It accepts a page URL or path on docs.apertis.ai and returns that page's Markdown artifact.

Both tools read only `/llms.txt` and `/llms-full.txt` from the deployment's own static assets, so their content is exactly the agent-eligible content. `get_page` for a page not listed in `/llms.txt` SHALL return a tool error and no content. Malformed JSON-RPC SHALL get a JSON-RPC error. Every other method SHALL answer 405 with `Allow: POST`. `/mcp` is recorded in the route inventory as a runtime route.

#### Scenario: Agent searches and reads
- **WHEN** a client calls `search_docs` with `{"query":"prompt caching"}` and then `get_page` with the first result's URL
- **THEN** it receives a ranked list with titles, URLs and snippets, then that page's Markdown

#### Scenario: Unlisted path
- **WHEN** `get_page` is called with `/openspec/` or with any path not in `/llms.txt`
- **THEN** the result is a tool error with no document content

#### Scenario: Wrong method
- **WHEN** `GET /mcp` is requested
- **THEN** the response is 405 with `Allow: POST`
