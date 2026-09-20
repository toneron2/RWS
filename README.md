# RWS: Rapid HVAC Workflow System

**Custom air-handling-unit design and estimation as seven cooperating agents over four
calculation servers.** The engineering method is written in plain language; the arithmetic
is done by code. Built on Claude Code and the Model Context Protocol, December 2025.

| | |
|---|---|
| **Status** | Specification, four MCP servers and a scripted demonstration, December 2025. |
| **Agents** | 7 Claude Code skills: conductor, psychrometrics, airflow, thermal, design, cost, QA |
| **Servers** | 4 MCP servers, TypeScript, 1,481 lines: `psychrometrics`, `component-db`, `simulation`, `estimation` |
| **Contracts** | 3 JSON schemas: request, constraint, result |
| **Demonstration** | [`examples/demo-workflow.md`](examples/demo-workflow.md): a hospital surgery suite (100 % outdoor air, HEPA, NC 35, Houston climate). The script is here; no run is recorded |
| **Licence** | MIT |

A standalone project on this account: the agent-and-tool pattern from the governance
architecture, applied to a regulated engineering discipline.

## The problem

A custom air handler needs psychrometrics, coil and fan selection, acoustics, code
compliance and cost estimation, and that knowledge sits with senior engineers. Encoding it
as documents an agent applies, with the calculations done by deterministic servers, makes
it reviewable, repeatable and transferable.

## How it works

```
 request (CFM, supply temperature, climate, filtration, coil type)
     │
     ▼
 ahu-conductor ── validates the request, derives constraints, sequences the agents
     ├── ahu-design    conceptual design: unit arrangement and casing
     ├── ahu-psychro   mixed-air and coil-leaving states            → psychrometrics
     ├── ahu-thermal   coil selection, rows, water-side hydraulics  → component-db, simulation
     ├── ahu-airflow   face velocity, static pressure, fan selection → component-db, simulation
     ├── ahu-cost      bill of materials and price roll-up           → estimation
     └── ahu-qa        checks the result against the schema and the constraints
     │
     ▼
 result: a complete design with BOM and pricing, and the reasoning at each step
```

| Server | Tools | Purpose |
|---|---|---|
| `psychrometrics` | `calculate`, `mix`, `process` | air properties, mixing, cooling and heating processes |
| `component-db` | `lookup`, `list`, `coils`, `fans` | fan curves and coil performance data; designed to connect to a real catalogue |
| `simulation` | `size`, `airflow`, `thermal` | sizing, airflow and thermal calculations, pressure drop |
| `estimation` | `price`, `component_price` | cost roll-up and bill of materials |

Every design passes schema validation before it is returned: supply airflow within range,
every required component present, a complete BOM. A skill is a text file; changing the
selection method is an edit, not a retraining.

## Running the demonstration

Requires Claude Code and Node.js 18+.

```bash
git clone https://github.com/toneron2/RWS.git && cd RWS
npm install
claude
> Design an AHU: 10,000 CFM, 55°F supply, Houston TX, chilled water cooling, MERV 13 filters
```

[`QUICKSTART.md`](QUICKSTART.md) has the step-by-step setup;
[`docs/BUSINESS_CASE.md`](docs/BUSINESS_CASE.md) the cost case for an engineering team.

## Extending it

Add an equipment type by writing a skill for its selection method, adding its data to
`component-db`, and extending the schemas. The `component-db` server is the intended seam
to an ERP, a vendor database or a pricing sheet.

## Contact

Tony Slosar · TODOMODO.IO AGENCY LLC · anthonyslosar@gmail.com · [t.me/toneron2](https://t.me/toneron2) · [slosars.me](https://slosars.me)
