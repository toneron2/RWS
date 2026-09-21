# The case for an in-house design agent

**An equipment manufacturer or representative can encode its own air-handler design method
and pricing as an agent system it owns, instead of licensing a vendor's.** This page sets
out the problem, the shape of the system, an estimate of cost and return, and the risks.
The figures are assumptions for a ten-engineer application group and should be replaced
with the reader's own before any decision.

## The problem

Custom air-handler design draws on psychrometrics, coil and fan selection, acoustics, codes
and cost engineering. That competence takes five to ten years to build and it sits with
senior engineers, so the group's throughput is bounded by them.

| Symptom | Consequence |
|---|---|
| quote backlog | opportunities lost |
| senior-engineer bottleneck | turnaround varies with who is free |
| quality variance | rework and complaints |
| long onboarding | six to twelve months before a new engineer produces alone |
| departures | the method leaves with the person |

## The system

Seven agents, each a written statement of one part of the method, over four calculation
servers ([README](../README.md)). A request in plain language ("10,000 CFM, 55 °F supply,
hospital application") becomes a design with a bill of materials and a price. The method
is a set of text files the firm edits itself; the arithmetic is code; every result is
validated against a schema before it is returned.

What a firm supplies: its component catalogue, its pricing and margins, its design rules.
What stays with the firm: all of it.

## Cost and return, illustrative

| Assumption | Value |
|---|---|
| application engineers | 10 |
| designs per engineer per day today | 1.5 |
| with the system | 6 |
| loaded cost per engineer | $80,000 |
| capacity gained | equivalent to 30 engineers, about $2.4 M a year |

| Phase | Weeks | Delivers | Estimate |
|---|---|---|---|
| 1 Foundation | 1–4 | skills for AHU design, servers connected to component data, the basic workflow | $40 K |
| 2 Integration | 5–8 | the firm's catalogue, pricing and ERP connected; more applications | $30 K |
| 3 Refinement | 9–14 | full workflow coverage, QA automation, document generation | $30 K |
| ongoing | | model usage $5–15 K a month by volume; maintenance about $2 K a month | |

First-year cost about $130–150 K against the capacity figure above. Quality and speed
effects expected but not measured: design errors from 5–8 % toward under 1 %; an initial
quote the same day instead of two to five days; a complex application in days instead of
weeks; new-hire time to productivity roughly halved.

## Risks

| Risk | Treatment |
|---|---|
| the model produces an error | schema validation for completeness; the calculations are done by deterministic servers, not by the model |
| the service is unavailable | the provider's published availability; the method files are portable to another model |
| the technology changes | the architecture is skills plus MCP servers, both open formats |
| adoption | the system produces the draft; engineers review and sign |
| leakage of pricing or method | nothing leaves the firm's own deployment |

## Build or buy

A vendor product is available now with no development, is generic, holds the firm's
pricing data, and is sold to competitors too. Building on this architecture costs the
development above and needs someone to maintain text files and a small codebase; in return
the catalogue, pricing, rules and any extension to other product lines (rooftop units,
chillers) are the firm's own. The recommendation here is to build, starting with one
product line as a pilot.

## A pilot

Pick one product line. Inventory the component catalogue, pricing and engineering
standards. Name an owner. Success: a complete design in under ten minutes, accuracy judged
equal to a senior engineer's, BOM and price ready for the quote, and the application
engineers willing to keep using it.
