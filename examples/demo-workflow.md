# RWS Demonstration Workflow

This document demonstrates the agentic AI workflow for air handler design. Run these examples to see the multi-agent orchestration in action.

## Demo 1: Hospital Surgery Suite (Complex)

This example demonstrates a challenging application with:
- 100% outdoor air (no recirculation)
- HEPA filtration requirements
- Strict sound requirements (NC 35)
- Humidity control
- Houston, TX climate (hot and humid)

### Invocation

```bash
claude "Design an AHU using the request in examples/hospital-surgery-suite.json"
```

### Expected Agent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ ahu-conductor starts                                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse request JSON                                           │
│ 2. Validate against schema                                      │
│ 3. Write state/request.json                                     │
│ 4. Derive constraints → state/constraints.json                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ahu-design (Phase 2)                                            │
├─────────────────────────────────────────────────────────────────┤
│ • 100% OA → No mixing section needed                           │
│ • HEPA → Two-stage filtration (MERV14 + HEPA)                  │
│ • 12,000 CFM ÷ 500 fpm = 24 sqft face                          │
│ • Select draw-through for dehumidification                      │
│ • Output: state/concept.json                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ahu-psychro (Phase 3)                                           │
├─────────────────────────────────────────────────────────────────┤
│ Houston Summer Design: 96°F DB / 78°F WB                        │
│ Outdoor Air State:                                              │
│   • h = 42.5 BTU/lb, W = 0.0175 lb/lb                          │
│ Supply Requirement: 55°F / 95% RH                               │
│   • h = 23.2 BTU/lb, W = 0.0091 lb/lb                          │
│ Cooling Load: 4.5 × 12,000 × (42.5 - 23.2) = 1,043 MBH        │
│ Output: state/psychro.json                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ ahu-thermal (Phase 4a)  │     │ ahu-airflow (Phase 4b)  │
├─────────────────────────┤     ├─────────────────────────┤
│ Cooling coil selection: │     │ System pressure drop:   │
│ • 8-row CW coil        │     │ • MERV14: 0.45"         │
│ • 10 FPI              │     │ • HEPA: 1.0"            │
│ • 165 GPM CHW         │     │ • Coils: 0.65"          │
│ • 14 ft H2O water PD  │     │ • Other: 0.40"          │
│                        │     │ • External: 3.0"        │
│ Heating coil:          │     │ Total: 5.5" TSP         │
│ • 2-row HW (preheat)  │     │                         │
│ • 1-row HW (reheat)   │     │ Fan: 40 HP, plenum      │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Integration & Validation                                        │
├─────────────────────────────────────────────────────────────────┤
│ • Merge component selections                                    │
│ • Verify fan can meet system requirement                        │
│ • Check sound → NC 42 exceeds NC 35 limit → FLAG               │
│ • Output: state/design.json                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ahu-cost (Phase 6)                                              │
├─────────────────────────────────────────────────────────────────┤
│ BOM Summary:                                                    │
│ • Cabinet (SS drain pans): $18,500                             │
│ • Coils: $24,200                                               │
│ • Fans/Motors/VFD: $12,800                                     │
│ • Filters (incl. HEPA): $8,500                                 │
│ • Controls: $4,200                                             │
│ • Humidifier: $6,500                                           │
│ Material: $74,700 | Labor: $8,400 | Overhead: $14,960          │
│ Total Cost: $98,060 | Sell @ 25%: $130,747                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ahu-qa (Phase 7)                                                │
├─────────────────────────────────────────────────────────────────┤
│ WARNINGS:                                                       │
│ • Sound level NC 42 > NC 35 limit                              │
│ RECOMMENDATION: Add discharge sound attenuator (+$3,200)       │
│                                                                 │
│ Status: CONDITIONAL PASS                                        │
│ Action: Return to conductor with sound mitigation option        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ahu-conductor: Iteration                                        │
├─────────────────────────────────────────────────────────────────┤
│ Present user with options:                                      │
│ A) Add sound attenuator (+$3,200, meets NC 35)                 │
│ B) Select lower-RPM fan (+$1,800, meets NC 38)                 │
│ C) Accept NC 42 (document variance)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Demo 2: Quick Commercial Office (Simple)

A straightforward design to show fast turnaround:

```bash
claude "Design a standard office AHU: 8,000 CFM, 55°F supply,
        30% outdoor air, MERV 13 filters, 2.0\" external SP,
        chilled water cooling, hot water heating, Dallas TX"
```

### Expected Result (< 30 seconds)

```
AHU Design Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Model: RWS-8000-H
Configuration: Horizontal, Draw-Through
Dimensions: 66"W × 60"H × 192"L

Performance:
  Supply: 8,000 CFM @ 55°F
  Cooling: 285 MBH (6-row CW coil)
  Heating: 120 MBH (1-row HW coil)
  Fan: 15 HP plenum, 3.2" TSP

Pricing:
  List Price: $42,850
  Lead Time: 6-8 weeks

Status: ✓ All checks passed
```

---

## Demo 3: Design Iteration (Showing AI Reasoning)

When constraints conflict, the agents report the trade-off:

```bash
claude "Design an AHU for a data center:
        - 25,000 CFM
        - 62°F supply (high sensible ratio)
        - Must fit in 8 ft ceiling height
        - N+1 fan redundancy required
        - Budget constraint: < $60,000"
```

### Expected Iteration Flow

**Iteration 1**: Standard design → $78,000 (over budget)

**AI Reasoning**: "Budget exceeded. Options:
1. Reduce to standard fans (lose redundancy)
2. Use fan array (4 fans, any 3 meet load)
3. Reduce cabinet gauge

Recommendation: Fan array meets redundancy with lower cost."

**Iteration 2**: Fan array configuration → $58,500 ✓

---

## Key Demonstration Points

### For Airtech Equipment Leadership

1. **Speed**: Initial design in minutes, not days
2. **Expertise Encoded**: Engineering knowledge is in the skills, not a black box
3. **Traceability**: Every decision is documented and reversible
4. **Iteration**: AI handles design conflicts automatically
5. **Your IP**: Component catalog, pricing, margins stay in-house
6. **Expandable**: Add new component types, applications, codes easily

### Comparison: This vs. Generic AI

| Generic AI Model | RWS Agentic System |
|-----------------|-------------------|
| "Here's a rough estimate..." | Complete BOM with pricing |
| Requires prompt engineering | Natural language or JSON input |
| No component database | Your catalog, your costs |
| Black box reasoning | Step-by-step documented |
| May hallucinate specs | Schema-validated outputs |
| Vendor owns improvements | You own the skills |

---

## Running the Demo

### Prerequisites

1. Claude Code CLI installed
2. Node.js 18+ (for MCP servers)
3. This project cloned

### Quick Start

```bash
# Navigate to project
cd /path/to/RWS

# Run example design
claude "Design an AHU: 10,000 CFM, 55°F supply, Houston TX,
        chilled water cooling, MERV 13 filters"
```

### Full Demo Script

```bash
# Show the architecture
claude "Explain the RWS architecture and agent roles"

# Run simple design
claude "Quick design: 5,000 CFM office AHU, standard specs"

# Run complex design
claude "Design using examples/hospital-surgery-suite.json"

# Show iteration capability
claude "Redesign the hospital unit to fit 25% smaller footprint"
```
