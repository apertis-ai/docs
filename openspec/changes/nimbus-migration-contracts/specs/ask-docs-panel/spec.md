## MODIFIED Requirements

### Requirement: Current Page Context
Ask Docs SHALL expose the current documentation page as user-visible context and SHALL keep that context in step with the page the reader is on.

#### Scenario: Panel opens while reading a docs page
- WHEN Ask Docs opens
- THEN the panel SHALL show a context chip based on the current page title
- AND submitted questions SHALL include the current page URL and title in the client request payload

#### Scenario: Reader navigates while the panel is open
- WHEN the reader moves to another page while Ask Docs stays open
- THEN the context chip SHALL show the new page
- AND the next submitted question SHALL carry the new page URL and title, never the previous page's context
