/**
 * Estimation calculations: cabinet, component and quote pricing. Kept
 * separate from the server entry point so they can be unit tested.
 *
 * Pricing data is illustrative and would come from a cost database.
 */

export interface CabinetPricing {
  face_area_sqft: number;
  length_ft: number;
  material: "galvanized" | "stainless" | "aluminum";
  insulation_in: number;
}

export const COMPONENT_TYPES = [
  "cooling_coil", "heating_coil", "fan", "motor", "vfd",
  "filter_prefilter", "filter_final", "filter_hepa",
  "damper_outdoor_air", "damper_return_air"
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export interface ComponentPricing {
  component_type: ComponentType;
  fan_type?: "plenum" | "centrifugal";
  merv?: number;
  model?: string;
  quantity?: number;
  capacity_mbh?: number;
  motor_hp?: number;
  rows?: number;
  face_area_sqft?: number;
}

export interface BOMItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  extended: number;
}

export interface QuoteResult {
  bom: BOMItem[];
  subtotals: { [category: string]: number };
  material_cost: number;
  labor_cost: number;
  overhead: number;
  total_cost: number;
  margin_percent: number;
  sell_price: number;
}

// Pricing data (simplified - would come from actual cost database)
export const pricingData = {
  cabinet: {
    base_per_sqft: {
      galvanized: 45,
      stainless: 95,
      aluminum: 75
    },
    insulation_per_sqft: {
      1: 8,
      2: 14,
      3: 22
    },
    base_frame_per_ft: 85,
    access_door: 450,
    roof_panel_per_sqft: 35
  },

  coils: {
    chilled_water: {
      base_per_row_sqft: 85,
      connection_kit: 250
    },
    hot_water: {
      base_per_row_sqft: 65,
      connection_kit: 180
    },
    steam: {
      base_per_row_sqft: 95,
      connection_kit: 350
    },
    electric: {
      per_kw: 45
    }
  },

  fans: {
    plenum: {
      per_hp: 180,
      base: 800
    },
    centrifugal: {
      per_hp: 220,
      base: 1200
    }
  },

  motors: {
    premium_eff_per_hp: 85,
    base: 350
  },

  vfd: {
    per_hp: 95,
    base: 450
  },

  filters: {
    frame_per_sqft: 12,
    merv8_24x24x2: 15,
    merv13_24x24x12: 85,
    merv14_24x24x12: 125,
    hepa_24x24x12: 450
  },

  dampers: {
    outdoor_air_per_sqft: 28,
    return_air_per_sqft: 22,
    actuator_modulating: 185,
    actuator_2pos: 125
  },

  controls: {
    panel_base: 1800,
    sensors: 350,
    safeties: 450
  },

  labor: {
    rate_per_hour: 75,
    base_hours: 24,
    hours_per_1000cfm: 2.5,
    complexity_multipliers: {
      standard: 1.0,
      custom: 1.3,
      hospital: 1.5,
      hazardous: 2.0
    }
  }
};

/**
 * Calculate cabinet cost
 */
export function priceCabinet(input: CabinetPricing): { items: BOMItem[], total: number } {
  const items: BOMItem[] = [];

  const surfaceArea = input.face_area_sqft * 2 + (input.face_area_sqft * input.length_ft / 6);

  // Panels
  const panelCost = surfaceArea * pricingData.cabinet.base_per_sqft[input.material];
  items.push({
    category: "Cabinet",
    description: `${input.material} panels, ${input.insulation_in}" insulated`,
    quantity: 1,
    unit: "lot",
    unit_cost: panelCost,
    extended: panelCost
  });

  // Insulation
  const insulKey = input.insulation_in as 1 | 2 | 3;
  const insulCost = surfaceArea * pricingData.cabinet.insulation_per_sqft[insulKey];
  items.push({
    category: "Cabinet",
    description: `${input.insulation_in}" foam insulation`,
    quantity: 1,
    unit: "lot",
    unit_cost: insulCost,
    extended: insulCost
  });

  // Base frame
  const frameCost = input.length_ft * pricingData.cabinet.base_frame_per_ft;
  items.push({
    category: "Cabinet",
    description: "Structural base frame",
    quantity: 1,
    unit: "lot",
    unit_cost: frameCost,
    extended: frameCost
  });

  // Access doors (estimate 3-4 per unit)
  const numDoors = Math.ceil(input.length_ft / 5);
  items.push({
    category: "Cabinet",
    description: "Access doors with hardware",
    quantity: numDoors,
    unit: "ea",
    unit_cost: pricingData.cabinet.access_door,
    extended: numDoors * pricingData.cabinet.access_door
  });

  const total = items.reduce((sum, item) => sum + item.extended, 0);
  return { items, total };
}

/**
 * Calculate component cost
 */
export function priceComponent(input: ComponentPricing): { items: BOMItem[], total: number } {
  const items: BOMItem[] = [];
  const qty = input.quantity || 1;

  switch (input.component_type) {
    case "cooling_coil": {
      const rows = input.rows || 6;
      const area = input.face_area_sqft || 40;
      const coilCost = rows * area * pricingData.coils.chilled_water.base_per_row_sqft;
      items.push({
        category: "Coils",
        description: `Cooling coil, ${rows}-row, ${area} sqft`,
        quantity: qty,
        unit: "ea",
        unit_cost: coilCost,
        extended: coilCost * qty
      });
      items.push({
        category: "Coils",
        description: "CHW connection kit",
        quantity: qty,
        unit: "ea",
        unit_cost: pricingData.coils.chilled_water.connection_kit,
        extended: pricingData.coils.chilled_water.connection_kit * qty
      });
      break;
    }

    case "heating_coil": {
      const rows = input.rows || 1;
      const area = input.face_area_sqft || 40;
      const coilCost = rows * area * pricingData.coils.hot_water.base_per_row_sqft;
      items.push({
        category: "Coils",
        description: `Heating coil, ${rows}-row, ${area} sqft`,
        quantity: qty,
        unit: "ea",
        unit_cost: coilCost,
        extended: coilCost * qty
      });
      items.push({
        category: "Coils",
        description: "HW connection kit",
        quantity: qty,
        unit: "ea",
        unit_cost: pricingData.coils.hot_water.connection_kit,
        extended: pricingData.coils.hot_water.connection_kit * qty
      });
      break;
    }

    case "fan": {
      const hp = input.motor_hp || 25;
      const fanType = input.fan_type ?? "plenum";
      const fanPrice = pricingData.fans[fanType];
      const fanCost = fanPrice.base + hp * fanPrice.per_hp;
      items.push({
        category: "Fans",
        description: `${fanType === "plenum" ? "Plenum" : "Centrifugal"} fan, ${input.model || 'sized for application'}`,
        quantity: qty,
        unit: "ea",
        unit_cost: fanCost,
        extended: fanCost * qty
      });
      break;
    }

    case "motor": {
      const hp = input.motor_hp || 25;
      const motorCost = pricingData.motors.base + hp * pricingData.motors.premium_eff_per_hp;
      items.push({
        category: "Fans",
        description: `Motor, ${hp} HP premium efficiency`,
        quantity: qty,
        unit: "ea",
        unit_cost: motorCost,
        extended: motorCost * qty
      });
      break;
    }

    case "vfd": {
      const hp = input.motor_hp || 25;
      const vfdCost = pricingData.vfd.base + hp * pricingData.vfd.per_hp;
      items.push({
        category: "Controls",
        description: `VFD, ${hp} HP`,
        quantity: qty,
        unit: "ea",
        unit_cost: vfdCost,
        extended: vfdCost * qty
      });
      break;
    }

    case "filter_prefilter":
    case "filter_final":
    case "filter_hepa": {
      const area = input.face_area_sqft || 40;
      const cells = Math.ceil(area / 4); // 24x24 nominal filters
      const f = pricingData.filters;
      let unitCost: number;
      let label: string;
      if (input.component_type === "filter_hepa") {
        unitCost = f.hepa_24x24x12;
        label = "HEPA";
      } else if (input.component_type === "filter_prefilter") {
        unitCost = f.merv8_24x24x2;
        label = `MERV ${input.merv ?? 8} pleated`;
      } else {
        const merv = input.merv ?? 13;
        unitCost = merv >= 14 ? f.merv14_24x24x12 : f.merv13_24x24x12;
        label = `MERV ${merv}`;
      }
      const frameCost = area * f.frame_per_sqft;
      items.push({
        category: "Filters",
        description: `Filter frame and tracks, ${area} sqft`,
        quantity: qty,
        unit: "ea",
        unit_cost: frameCost,
        extended: frameCost * qty
      });
      items.push({
        category: "Filters",
        description: `${label} filters, 24x24, ${cells} per bank`,
        quantity: cells * qty,
        unit: "ea",
        unit_cost: unitCost,
        extended: unitCost * cells * qty
      });
      break;
    }

    case "damper_outdoor_air":
    case "damper_return_air": {
      const area = input.face_area_sqft || 20;
      const outdoor = input.component_type === "damper_outdoor_air";
      const perSqft = outdoor ? pricingData.dampers.outdoor_air_per_sqft : pricingData.dampers.return_air_per_sqft;
      const damperCost = area * perSqft;
      items.push({
        category: "Dampers",
        description: `${outdoor ? "Outdoor air" : "Return air"} damper, low leakage, ${area} sqft`,
        quantity: qty,
        unit: "ea",
        unit_cost: damperCost,
        extended: damperCost * qty
      });
      items.push({
        category: "Dampers",
        description: "Modulating actuator",
        quantity: qty,
        unit: "ea",
        unit_cost: pricingData.dampers.actuator_modulating,
        extended: pricingData.dampers.actuator_modulating * qty
      });
      break;
    }

    default: {
      const unknown: never = input.component_type;
      throw new Error(`Unknown component type "${unknown}". Known types: ${COMPONENT_TYPES.join(", ")}`);
    }
  }

  const total = items.reduce((sum, item) => sum + item.extended, 0);
  return { items, total };
}

/**
 * Generate complete quote from design
 */
export function generateQuote(
  cfm: number,
  components: ComponentPricing[],
  complexity: string = "standard"
): QuoteResult {
  const bom: BOMItem[] = [];
  const subtotals: { [key: string]: number } = {};

  // Estimate cabinet sizing
  const faceAreaSqft = cfm / 500;
  const lengthFt = 20; // Estimate

  // Add cabinet costs
  const cabinetResult = priceCabinet({
    face_area_sqft: faceAreaSqft,
    length_ft: lengthFt,
    material: "galvanized",
    insulation_in: 2
  });
  bom.push(...cabinetResult.items);
  subtotals["Cabinet"] = cabinetResult.total;

  // Add component costs
  for (const comp of components) {
    const compResult = priceComponent(comp);
    bom.push(...compResult.items);
    for (const item of compResult.items) {
      subtotals[item.category] = (subtotals[item.category] || 0) + item.extended;
    }
  }

  // Add standard items
  bom.push({
    category: "Controls",
    description: "Control panel, NEMA 1",
    quantity: 1,
    unit: "ea",
    unit_cost: pricingData.controls.panel_base,
    extended: pricingData.controls.panel_base
  });
  subtotals["Controls"] = (subtotals["Controls"] || 0) + pricingData.controls.panel_base;

  // Calculate totals
  const materialCost = Object.values(subtotals).reduce((sum, val) => sum + val, 0);

  // Labor calculation
  const complexityMult = pricingData.labor.complexity_multipliers[
    complexity as keyof typeof pricingData.labor.complexity_multipliers
  ] || 1.0;
  const laborHours = (pricingData.labor.base_hours + (cfm / 1000) * pricingData.labor.hours_per_1000cfm) * complexityMult;
  const laborCost = laborHours * pricingData.labor.rate_per_hour;

  // Overhead
  const overhead = (materialCost + laborCost) * 0.18;

  // Total cost
  const totalCost = materialCost + laborCost + overhead;

  // Margin (25% standard)
  const marginPercent = 25;
  const sellPrice = totalCost / (1 - marginPercent / 100);

  return {
    bom,
    subtotals,
    material_cost: Math.round(materialCost),
    labor_cost: Math.round(laborCost),
    overhead: Math.round(overhead),
    total_cost: Math.round(totalCost),
    margin_percent: marginPercent,
    sell_price: Math.round(sellPrice)
  };
}
