/**
 * MCP Server: Component Database
 *
 * Provides access to HVAC component catalogs and selection data.
 * This simulates a real component database that would be populated
 * with manufacturer data for fans, coils, filters, etc.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";

// Sample component data (would be from real database)
interface FanData {
  model: string;
  manufacturer: string;
  type: string;
  wheel_diameter_in: number;
  max_cfm: number;
  max_sp_in_wg: number;
  peak_efficiency: number;
  rpm_range: [number, number];
  motor_hp_options: number[];
  sound_data: { [hz: string]: number };
}

interface CoilData {
  model: string;
  manufacturer: string;
  type: string;
  rows: number;
  fpi: number;
  tube_od: number;
  face_heights: number[];
  face_widths: number[];
  connection_sizes: string[];
}

// Sample fan catalog
const fanCatalog: FanData[] = [
  {
    model: "PLR-18",
    manufacturer: "Greenheck",
    type: "plenum",
    wheel_diameter_in: 18,
    max_cfm: 12000,
    max_sp_in_wg: 4.0,
    peak_efficiency: 0.72,
    rpm_range: [800, 2400],
    motor_hp_options: [5, 7.5, 10, 15],
    sound_data: { "63": 88, "125": 85, "250": 81, "500": 77, "1000": 73, "2000": 69, "4000": 65, "8000": 61 }
  },
  {
    model: "PLR-24",
    manufacturer: "Greenheck",
    type: "plenum",
    wheel_diameter_in: 24,
    max_cfm: 25000,
    max_sp_in_wg: 5.0,
    peak_efficiency: 0.74,
    rpm_range: [600, 1800],
    motor_hp_options: [10, 15, 20, 25, 30],
    sound_data: { "63": 92, "125": 89, "250": 85, "500": 81, "1000": 77, "2000": 73, "4000": 69, "8000": 65 }
  },
  {
    model: "PLR-30",
    manufacturer: "Greenheck",
    type: "plenum",
    wheel_diameter_in: 30,
    max_cfm: 40000,
    max_sp_in_wg: 6.0,
    peak_efficiency: 0.76,
    rpm_range: [500, 1400],
    motor_hp_options: [20, 25, 30, 40, 50],
    sound_data: { "63": 95, "125": 92, "250": 88, "500": 84, "1000": 80, "2000": 76, "4000": 72, "8000": 68 }
  },
  {
    model: "BIDW-15",
    manufacturer: "Greenheck",
    type: "centrifugal_bi",
    wheel_diameter_in: 15,
    max_cfm: 8000,
    max_sp_in_wg: 3.5,
    peak_efficiency: 0.78,
    rpm_range: [1000, 3000],
    motor_hp_options: [3, 5, 7.5, 10],
    sound_data: { "63": 85, "125": 82, "250": 78, "500": 74, "1000": 70, "2000": 66, "4000": 62, "8000": 58 }
  },
  {
    model: "BIDW-20",
    manufacturer: "Greenheck",
    type: "centrifugal_bi",
    wheel_diameter_in: 20,
    max_cfm: 18000,
    max_sp_in_wg: 4.5,
    peak_efficiency: 0.80,
    rpm_range: [800, 2200],
    motor_hp_options: [7.5, 10, 15, 20],
    sound_data: { "63": 88, "125": 85, "250": 81, "500": 77, "1000": 73, "2000": 69, "4000": 65, "8000": 61 }
  }
];

// Sample coil catalog
const coilCatalog: CoilData[] = [
  {
    model: "CW-4R",
    manufacturer: "Heatcraft",
    type: "chilled_water",
    rows: 4,
    fpi: 12,
    tube_od: 0.625,
    face_heights: [24, 30, 36, 42, 48, 60, 72],
    face_widths: [24, 30, 36, 42, 48, 60, 72, 84, 96],
    connection_sizes: ["1\"", "1-1/4\"", "1-1/2\"", "2\"", "2-1/2\""]
  },
  {
    model: "CW-6R",
    manufacturer: "Heatcraft",
    type: "chilled_water",
    rows: 6,
    fpi: 12,
    tube_od: 0.625,
    face_heights: [24, 30, 36, 42, 48, 60, 72],
    face_widths: [24, 30, 36, 42, 48, 60, 72, 84, 96],
    connection_sizes: ["1-1/4\"", "1-1/2\"", "2\"", "2-1/2\"", "3\""]
  },
  {
    model: "CW-8R",
    manufacturer: "Heatcraft",
    type: "chilled_water",
    rows: 8,
    fpi: 10,
    tube_od: 0.625,
    face_heights: [24, 30, 36, 42, 48, 60, 72],
    face_widths: [24, 30, 36, 42, 48, 60, 72, 84, 96],
    connection_sizes: ["1-1/2\"", "2\"", "2-1/2\"", "3\""]
  },
  {
    model: "HW-1R",
    manufacturer: "Heatcraft",
    type: "hot_water",
    rows: 1,
    fpi: 10,
    tube_od: 0.625,
    face_heights: [24, 30, 36, 42, 48, 60, 72],
    face_widths: [24, 30, 36, 42, 48, 60, 72, 84, 96],
    connection_sizes: ["3/4\"", "1\"", "1-1/4\""]
  },
  {
    model: "HW-2R",
    manufacturer: "Heatcraft",
    type: "hot_water",
    rows: 2,
    fpi: 10,
    tube_od: 0.625,
    face_heights: [24, 30, 36, 42, 48, 60, 72],
    face_widths: [24, 30, 36, 42, 48, 60, 72, 84, 96],
    connection_sizes: ["1\"", "1-1/4\"", "1-1/2\""]
  }
];

// Fan selection algorithm
function selectFan(cfm: number, tsp: number, fanType?: string) {
  const candidates = fanCatalog.filter(f => {
    const typeMatch = !fanType || f.type === fanType;
    const cfmOk = f.max_cfm >= cfm * 0.8;
    const spOk = f.max_sp_in_wg >= tsp;
    return typeMatch && cfmOk && spOk;
  });

  if (candidates.length === 0) {
    throw new Error("No suitable fan found for requirements");
  }

  // Select smallest adequate fan
  candidates.sort((a, b) => a.wheel_diameter_in - b.wheel_diameter_in);
  const selected = candidates[0];

  // Calculate operating point (simplified)
  const operatingRatio = cfm / selected.max_cfm;
  const rpm = selected.rpm_range[0] + (selected.rpm_range[1] - selected.rpm_range[0]) * operatingRatio;
  const efficiency = selected.peak_efficiency * (1 - Math.pow(operatingRatio - 0.7, 2) * 0.5);
  const bhp = (cfm * tsp) / (6356 * efficiency);

  // Select motor
  const motorHp = selected.motor_hp_options.find(hp => hp >= bhp * 1.15) ||
                  selected.motor_hp_options[selected.motor_hp_options.length - 1];

  return {
    model: selected.model,
    manufacturer: selected.manufacturer,
    type: selected.type,
    wheel_diameter_in: selected.wheel_diameter_in,
    operating_point: {
      cfm,
      tsp_in_wg: tsp,
      rpm: Math.round(rpm),
      bhp: Math.round(bhp * 100) / 100,
      efficiency_percent: Math.round(efficiency * 100)
    },
    motor_hp: motorHp,
    sound_power_db: selected.sound_data
  };
}

// Coil selection algorithm
function selectCoil(
  service: string,
  faceAreaSqft: number,
  capacityMbh: number,
  deltaT: number
) {
  const coilType = service === "cooling" ? "chilled_water" : "hot_water";

  // Estimate rows needed
  let rowsNeeded: number;
  if (service === "cooling") {
    rowsNeeded = Math.ceil(capacityMbh / (faceAreaSqft * 15)); // Rough estimate
    rowsNeeded = Math.max(4, Math.min(8, rowsNeeded));
  } else {
    rowsNeeded = Math.ceil(deltaT / 40);
    rowsNeeded = Math.max(1, Math.min(2, rowsNeeded));
  }

  // Find matching coil
  const candidates = coilCatalog.filter(c =>
    c.type === coilType && c.rows >= rowsNeeded
  );

  if (candidates.length === 0) {
    throw new Error("No suitable coil found");
  }

  // Select coil with minimum adequate rows
  candidates.sort((a, b) => a.rows - b.rows);
  const selected = candidates[0];

  // Calculate dimensions
  const aspectRatio = 1.2;
  const width = Math.sqrt(faceAreaSqft * aspectRatio) * 12;
  const height = faceAreaSqft * 144 / width;

  // Find nearest standard sizes
  const stdWidth = selected.face_widths.find(w => w >= width) ||
                   selected.face_widths[selected.face_widths.length - 1];
  const stdHeight = selected.face_heights.find(h => h >= height) ||
                    selected.face_heights[selected.face_heights.length - 1];

  // Calculate water flow
  const gpm = capacityMbh * 1000 / (500 * deltaT);

  return {
    model: selected.model,
    manufacturer: selected.manufacturer,
    type: selected.type,
    rows: selected.rows,
    fpi: selected.fpi,
    dimensions: {
      face_width_in: stdWidth,
      face_height_in: stdHeight,
      face_area_sqft: (stdWidth * stdHeight) / 144
    },
    performance: {
      capacity_mbh: capacityMbh,
      gpm: Math.round(gpm * 10) / 10,
      estimated_water_pd_ft: Math.round(gpm * 0.15 * 10) / 10,
      estimated_air_pd_in_wg: Math.round(selected.rows * 0.08 * 100) / 100
    },
    connection_size: selected.connection_sizes[
      Math.min(Math.floor(gpm / 30), selected.connection_sizes.length - 1)
    ]
  };
}

// MCP Server setup
const server = createServer("component-db");

const componentType = z.enum(["fan", "coil", "filter", "damper"]);

defineTool(
  server,
  "lookup",
  "Look up component by model number",
  { component_type: componentType, model: z.string() },
  ({ component_type, model }) => {
    const component =
      component_type === "fan" ? fanCatalog.find(f => f.model === model) :
      component_type === "coil" ? coilCatalog.find(c => c.model === model) :
      undefined;
    if (!component) throw new Error(`Component not found: ${component_type} ${model}`);
    return component;
  }
);

defineTool(
  server,
  "fans",
  "Select a fan for given requirements",
  {
    cfm: z.number().positive().describe("Required airflow (CFM)"),
    tsp_in_wg: z.number().positive().describe("Total static pressure (in. w.g.)"),
    fan_type: z.enum(["plenum", "centrifugal_bi", "centrifugal_af"]).optional()
  },
  ({ cfm, tsp_in_wg, fan_type }) => selectFan(cfm, tsp_in_wg, fan_type)
);

defineTool(
  server,
  "coils",
  "Select a coil for given requirements",
  {
    service: z.enum(["cooling", "heating"]),
    face_area_sqft: z.number().positive().describe("Required face area (sq ft)"),
    capacity_mbh: z.number().positive().describe("Required capacity (MBH)"),
    delta_t: z.number().positive().describe("Water temperature rise/drop (°F)")
  },
  ({ service, face_area_sqft, capacity_mbh, delta_t }) =>
    selectCoil(service, face_area_sqft, capacity_mbh, delta_t)
);

defineTool(
  server,
  "list",
  "List available components of a type",
  { component_type: componentType },
  ({ component_type }) => {
    if (component_type === "fan") {
      return fanCatalog.map(f => ({ model: f.model, type: f.type, max_cfm: f.max_cfm }));
    }
    if (component_type === "coil") {
      return coilCatalog.map(c => ({ model: c.model, type: c.type, rows: c.rows }));
    }
    return [];
  }
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
