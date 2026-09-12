---
owner: ignored-frontmatter
---

# English heading

This paragraph is entirely English and must fail deterministically.

## Requirement: English requirement name

### Scenario: English scenario name

- **WHEN** the request contains only English prose
- 中文 This is a long English sentence disguised by one Chinese token

| 中文列 | English table cell |
| --- | --- |
| 值 | value |

<p>Visible English HTML prose must also fail.</p>
