---
subject: chinese
title: Mandarin Chinese
updated: 2026-09-18
nodes:
  - id: radical
    label: Radical (部首)
    kind: unconditional-truth
    deps: []
  - id: phono-semantic-compound
    label: Phono-semantic compound
    kind: derived
    deps: [radical]
  - id: compound-word-formation
    label: Compound word formation
    kind: derived
    deps: [phono-semantic-compound]
---

# Mandarin Chinese

```mermaid
graph TD
  radical["Radical (部首)"] --> phono-semantic-compound["Phono-semantic compound"]
  phono-semantic-compound --> compound-word-formation["Compound word formation"]
```
