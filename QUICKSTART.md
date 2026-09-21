# RWS Quick Start Guide

Setup for the demonstration: Claude Code, a subscription, Node.js, this repository.

---

## Step 1: Install Prerequisites

### Install Claude Code CLI

Claude Code is Anthropic's command-line interface for Claude. Install it:

**macOS/Linux:**
```bash
npm install -g @anthropic-ai/claude-code
```

**Windows (PowerShell as Admin):**
```powershell
npm install -g @anthropic-ai/claude-code
```

Verify installation:
```bash
claude --version
```

### Get a Claude Subscription

You need a Claude Pro ($20/month) or Claude Max ($100/month) subscription:

1. Go to [claude.ai](https://claude.ai)
2. Sign up or log in
3. Subscribe to Pro or Max

**No API key needed** - Claude Code uses your subscription directly.

### Install Node.js (for MCP servers)

Download from [nodejs.org](https://nodejs.org) - version 18 or higher.

Verify:
```bash
node --version  # Should show v18.x.x or higher
```

---

## Step 2: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/toneron2/RWS.git

# Navigate to project
cd RWS

# Install dependencies
npm install
```

---

## Step 3: Run Your First Design

Start Claude Code in the project directory:

```bash
claude
```

The first run asks for an Anthropic account login.

Once in the Claude Code prompt, try this:

```
Design an AHU: 10,000 CFM, 55°F supply, Houston TX,
chilled water cooling, hot water heating, MERV 13 filters
```

The conductor sequences the agents and returns a complete design.

---

## Step 4: Explore the Results

The agents will:

1. **Parse your request** into structured requirements
2. **Calculate psychrometrics** - air properties and thermal loads
3. **Select components** - coils, fans, filters
4. **Generate pricing** - complete BOM with costs
5. **Validate the design** - check against constraints

The reasoning is printed at each step.

---

## Demo Scenarios to Try

### Basic Office AHU
```
Design a simple office AHU: 5,000 CFM, 55°F supply,
Dallas TX, 30% outdoor air, MERV 10 filters
```

### Hospital Critical Care
```
Design an AHU using examples/hospital-surgery-suite.json
```

### Data Center (High Sensible)
```
Design a data center AHU: 20,000 CFM, 65°F supply,
high sensible ratio, N+1 fan redundancy, Phoenix AZ
```

### Show Iteration
```
Redesign the last unit to fit in 7 ft ceiling height
```

---

## Understanding the Output

### Agent Flow

Output resembles:
```
[ahu-conductor] Starting design pipeline...
[ahu-design] Configuration: horizontal, draw-through
[ahu-psychro] Mixed air: 82°F DB, 68°F WB
[ahu-thermal] Cooling coil: 6-row, 450 MBH
[ahu-airflow] Fan: 25 HP plenum, 3.5" TSP
[ahu-cost] Sell price: $52,850
[ahu-qa] Status: PASS - all checks passed
```

Each line shows which agent is working and what it determined.

### Final Output

The complete design includes:
- Unit configuration and dimensions
- Component selections with specifications
- Performance data (CFM, capacity, pressure)
- Bill of materials with pricing
- Validation status

---

## Troubleshooting

### "Claude command not found"

Ensure npm bin is in your PATH:
```bash
export PATH="$PATH:$(npm bin -g)"
```

### "Not logged in"

Run `claude` and follow the authentication prompts to log in with your Anthropic account.

### MCP servers not loading

Check Node.js version:
```bash
node --version  # Need 18+
```

Reinstall dependencies:
```bash
rm -rf node_modules
npm install
```

### Design seems incomplete

Try being more specific:
```
Design an AHU with these requirements:
- Supply: 10,000 CFM at 55°F
- Location: Houston, TX
- Cooling: Chilled water (44°F entering)
- Heating: Hot water
- Filters: MERV 13
- External static: 2.5 in. w.g.
```

---

## Next Steps

### Explore the Architecture

- Read skill documents in `.claude/skills/` to see how expertise is encoded
- Examine schemas in `schemas/` to understand data structures
- Look at MCP servers in `mcp-servers/` for calculation logic

### Run the Full Demo

See [examples/demo-workflow.md](examples/demo-workflow.md) for a comprehensive demonstration script.

### Review the Business Case

See [docs/BUSINESS_CASE.md](docs/BUSINESS_CASE.md) for ROI analysis and implementation planning.

---

## Getting Help

- **Claude Code Documentation**: [docs.anthropic.com/claude-code](https://docs.anthropic.com/claude-code)
- **Issues**: Open an issue on GitHub
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

*Ready to see agentic AI in action? Start with the basic office AHU example above.*
