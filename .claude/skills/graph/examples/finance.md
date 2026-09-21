---
subject: finance
title: Quantitative Finance
updated: 2026-09-18
nodes:
  - id: time-value-of-money
    label: Time value of money
    kind: unconditional-truth
    deps: []
  - id: discount-factor
    label: Discount factor
    kind: derived
    deps: [time-value-of-money]
  - id: present-value
    label: Present value
    kind: derived
    deps: [discount-factor]
---

# Quantitative Finance

```mermaid
graph TD
  time-value-of-money["Time value of money"] --> discount-factor["Discount factor"]
  discount-factor --> present-value["Present value"]
```
