---
subject: calc2
title: Calculus II
updated: 2026-09-18
nodes:
  - id: riemann-sum
    label: Riemann sum
    kind: unconditional-truth
    deps: []
  - id: definite-integral
    label: Definite integral
    kind: derived
    deps: [riemann-sum]
  - id: improper-integral
    label: Improper integral
    kind: derived
    deps: [definite-integral]
---

# Calculus II

```mermaid
graph TD
  riemann-sum["Riemann sum"] --> definite-integral["Definite integral"]
  definite-integral --> improper-integral["Improper integral"]
```
