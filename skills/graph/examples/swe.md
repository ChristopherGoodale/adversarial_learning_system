---
subject: swe
title: Software Engineering
updated: 2026-09-18
nodes:
  - id: namespace
    label: Namespace
    kind: unconditional-truth
    deps: []
  - id: qualified-name
    label: Qualified name
    kind: derived
    deps: [namespace]
---

# Software Engineering

```mermaid
graph TD
  namespace["Namespace"] --> qualified-name["Qualified name"]
```
