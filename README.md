# RWS: Rapid HVAC Workflow System

**Agentic AI for Air Handler Design & Estimation**

---

## What Is This?

RWS demonstrates how **agentic AI** can transform HVAC equipment design. Instead of simple chatbots or black-box predictions, agentic AI uses specialized "agents" that collaborate like a team of engineers—each with distinct expertise, working together to solve complex problems.

This isn't a toy. It's a functional architecture for designing custom air handling units, complete with:
- Psychrometric analysis
- Coil and fan selection
- Cost estimation
- Quality assurance

**Built on Anthropic's Claude with Model Context Protocol (MCP) - December 2025**

---

## Why Agentic AI Matters for HVAC

### The Problem

Designing a custom air handler requires expertise across multiple domains:
- Thermodynamics and psychrometrics
- Component selection (coils, fans, filters)
- Acoustic analysis
- Code compliance
- Cost estimation

This knowledge typically lives in the heads of senior engineers. It's hard to transfer, inconsistent across individuals, and doesn't scale.

### The Agentic Solution

Instead of trying to replace engineers, agentic AI **encodes their expertise** into specialized agents:

```
Customer Request
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                     CONDUCTOR AGENT                          │
│            Orchestrates the design pipeline                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   DESIGN    │    │   PSYCHRO   │    │   THERMAL   │
│   AGENT     │    │   AGENT     │    │   AGENT     │
│             │    │             │    │             │
│ Layout &    │    │ Air states  │    │ Coil        │
│ sizing      │    │ & loads     │    │ selection   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   AIRFLOW   │    │    COST     │    │     QA      │
│   AGENT     │    │    AGENT    │    │    AGENT    │
│             │    │             │    │             │
│ Fan curves  │    │ BOM &       │    │ Validation  │
│ & acoustics │    │ pricing     │    │ & codes     │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                  Complete Design
```

Each agent:
- Has **specific expertise** encoded in plain language
- Uses **real calculations** via MCP servers
- **Explains its reasoning** at every step
- Can be **updated independently** as practices change

---

## Business Value

### For Engineering Teams

| Before | After |
|--------|-------|
| Senior engineer required for every design | Junior staff produces senior-quality work |
| 2-5 days per custom quote | Complete design in minutes |
| Knowledge lives in people's heads | Expertise encoded and preserved |
| Inconsistent approaches across team | Every design follows best practices |

### For Operations

| Before | After |
|--------|-------|
| Bottleneck on experienced engineers | Parallel processing at scale |
| Training takes 6-12 months | New hires productive in weeks |
| Quality varies with workload | Consistent output regardless of volume |
| Tribal knowledge lost when people leave | Institutional memory preserved |

### For the Business

| Before | After |
|--------|-------|
| Quote volume limited by headcount | Respond to every opportunity |
| Engineering costs grow linearly | Capability grows exponentially |
| Competitive advantage is people-dependent | Advantage is systematized |
| Innovation requires retraining everyone | Update once, deploy everywhere |

---

## How It Works

### 1. Skills (Engineering Expertise)

Skills are plain-language documents that encode domain knowledge:

```markdown
# ahu-thermal: Coil Selection Agent

You are an expert in heat exchanger design...

## Selection Methodology
1. Establish requirements from psychrometric analysis
2. Calculate face area from CFM and velocity
3. Determine rows needed for delta-T
4. Select from component catalog
5. Verify water-side hydraulics
...
```

No machine learning required. No training data. Just written expertise that Claude can apply.

### 2. MCP Servers (Computational Engines)

Model Context Protocol servers provide real calculations:

- **Psychrometrics**: Air property calculations
- **Component Database**: Fan curves, coil performance data
- **Simulation**: Sizing algorithms, pressure drop analysis
- **Estimation**: Cost rollup, BOM generation

These connect to your actual data sources—your catalog, your pricing.

### 3. Schemas (Quality Assurance)

JSON schemas ensure every design is complete and valid:

```json
{
  "supply_cfm": 10000,      // Validated: 500-100,000 range
  "supply_temp_f": 55,      // Validated: reasonable HVAC range
  "components": { ... },    // Validated: all required fields
  "pricing": { ... }        // Validated: complete BOM
}
```

No hallucinated specifications. No missing fields.

---

## Quick Demo

### Prerequisites

1. **Claude Code CLI** - [Install guide](https://docs.anthropic.com/claude-code)
2. **Claude Pro or Max subscription** - $20-100/month, no API key needed
3. **Node.js 18+** - For MCP servers

### Run Your First Design

```bash
# Clone the repository
git clone https://github.com/toneron2/RWS.git
cd RWS

# Install dependencies
npm install

# Run Claude Code
claude

# Ask for a design
> Design an AHU: 10,000 CFM, 55°F supply, Houston TX,
  chilled water cooling, MERV 13 filters
```

Watch the agents collaborate to produce a complete design with BOM and pricing.

---

## Project Structure

```
RWS/
├── .claude/
│   └── skills/           # Agent expertise definitions
│       ├── ahu-conductor/    # Pipeline orchestration
│       ├── ahu-design/       # Configuration & sizing
│       ├── ahu-psychro/      # Psychrometric analysis
│       ├── ahu-thermal/      # Coil selection
│       ├── ahu-airflow/      # Fan selection
│       ├── ahu-cost/         # Pricing & BOM
│       └── ahu-qa/           # Validation
│
├── mcp-servers/          # Computational engines
│   ├── psychrometrics/       # Air properties
│   ├── component-db/         # Equipment catalog
│   ├── simulation/           # Performance calcs
│   └── estimation/           # Cost engine
│
├── schemas/              # Data validation
│   ├── request.schema.json
│   ├── constraint.schema.json
│   └── result.schema.json
│
├── examples/             # Demo scenarios
│   ├── hospital-surgery-suite.json
│   └── demo-workflow.md
│
└── docs/                 # Additional documentation
    └── BUSINESS_CASE.md
```

---

## What Makes This Different

### vs. ChatGPT/Generic AI

| Generic AI | RWS Agentic System |
|------------|-------------------|
| "Here's a rough estimate..." | Complete BOM with validated pricing |
| Single response | Multi-agent collaboration |
| May hallucinate specs | Schema-validated outputs |
| No real calculations | MCP servers do actual math |
| Conversation ends | Pipeline continues until complete |

### vs. Traditional Software

| Traditional Software | RWS Agentic System |
|---------------------|-------------------|
| Rigid input forms | Natural language requests |
| Fixed logic paths | Adaptive reasoning |
| Change requires developers | Update skill documents |
| Binary pass/fail | Explains tradeoffs |
| One-size-fits-all | Context-aware decisions |

### vs. Custom ML Models

| Custom ML | RWS Agentic System |
|-----------|-------------------|
| Requires training data | Works from first principles |
| 12-24 month development | Operational in weeks |
| Black box predictions | Explainable reasoning |
| Expensive to modify | Edit text files |
| Accuracy depends on data | Accuracy depends on engineering |

---

## Extending the System

### Add a New Component Type

1. Create a skill document describing selection methodology
2. Add component data to the MCP server
3. Update schemas for new fields
4. Test with example requests

### Connect Your Catalog

The `component-db` MCP server is designed to connect to real data sources:
- ERP systems
- Vendor databases
- Pricing sheets
- Performance curves

### Add New Applications

The architecture handles any equipment type:
- Rooftop units
- Chillers
- Boilers
- Custom air handling configurations

---

## Technology Foundation

Built on Anthropic's latest capabilities (December 2025):

- **Claude Code**: CLI-native AI development environment
- **Model Context Protocol (MCP)**: Standardized tool integration
- **Skills**: Domain expertise as natural language specifications
- **Multi-agent orchestration**: Specialized agents working in concert

---

## Getting Started

See [QUICKSTART.md](QUICKSTART.md) for step-by-step setup instructions.

See [examples/demo-workflow.md](examples/demo-workflow.md) for detailed demonstration scenarios.

See [docs/BUSINESS_CASE.md](docs/BUSINESS_CASE.md) for ROI analysis and implementation planning.

---

## License

MIT - Use freely, modify as needed, keep the attribution.

---

*Built with Anthropic Claude and Model Context Protocol*
*Architecture: December 2025 patterns for 2026 and beyond*
