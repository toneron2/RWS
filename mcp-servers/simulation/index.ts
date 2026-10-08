/**
 * MCP Server: Simulation
 *
 * Provides simulation capabilities for AHU design validation.
 * Includes sizing calculations, thermal performance, and airflow analysis.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";

interface SizingInput {
  cfm: number;
  face_velocity_fpm?: number;
  aspect_ratio?: number;
}

interface SizingResult {
  face_area_sqft: number;
  width_in: number;
  height_in: number;
  actual_velocity_fpm: number;
}

interface ThermalInput {
  cfm: number;
  entering_db_f: number;
  entering_wb_f: number;
  leaving_db_f: number;
  leaving_wb_f?: number;
}

interface ThermalResult {
  total_mbh: number;
  sensible_mbh: number;
  latent_mbh: number;
  sensible_heat_ratio: number;
  mass_flow_lb_hr: number;
  coil_rows_estimate: number;
}

interface AirflowInput {
  cfm: number;
  components: {
    type: string;
    rows?: number;
    merv?: number;
  }[];
  external_sp_in_wg: number;
}

interface AirflowResult {
  internal_sp_in_wg: number;
  external_sp_in_wg: number;
  total_sp_in_wg: number;
  component_pd: { [key: string]: number };
  fan_bhp_estimate: number;
  fan_motor_hp_estimate: number;
}

/**
 * Calculate cabinet sizing from CFM requirements
 */
function calculateSizing(input: SizingInput): SizingResult {
  const faceVelocity = input.face_velocity_fpm || 500;
  const aspectRatio = input.aspect_ratio || 1.2; // W:H

  const faceAreaSqft = input.cfm / faceVelocity;
  const faceAreaSqIn = faceAreaSqft * 144;

  // Calculate dimensions
  const heightIn = Math.sqrt(faceAreaSqIn / aspectRatio);
  const widthIn = faceAreaSqIn / heightIn;

  // Round to nearest standard increment (6")
  const roundedWidth = Math.ceil(widthIn / 6) * 6;
  const roundedHeight = Math.ceil(heightIn / 6) * 6;

  const actualArea = (roundedWidth * roundedHeight) / 144;
  const actualVelocity = input.cfm / actualArea;

  return {
    face_area_sqft: Math.round(actualArea * 100) / 100,
    width_in: roundedWidth,
    height_in: roundedHeight,
    actual_velocity_fpm: Math.round(actualVelocity)
  };
}

/**
 * Calculate thermal loads from air conditions
 */
function calculateThermal(input: ThermalInput): ThermalResult {
  // Psychrometric properties (simplified)
  const enteringRH = calculateRH(input.entering_db_f, input.entering_wb_f);
  const enteringW = humidityRatio(input.entering_db_f, enteringRH);
  const enteringH = enthalpy(input.entering_db_f, enteringW);

  // Assume leaving conditions
  const leavingWb = input.leaving_wb_f || input.leaving_db_f + 1;
  const leavingRH = calculateRH(input.leaving_db_f, leavingWb);
  const leavingW = humidityRatio(input.leaving_db_f, leavingRH);
  const leavingH = enthalpy(input.leaving_db_f, leavingW);

  // Air properties
  const avgSpecVol = 13.5; // ft³/lb (approximate)
  const massFlow = (input.cfm * 60) / avgSpecVol; // lb/hr

  // Load calculations
  const totalBtuh = massFlow * (enteringH - leavingH);
  const sensibleBtuh = massFlow * 0.24 * (input.entering_db_f - input.leaving_db_f);
  const latentBtuh = totalBtuh - sensibleBtuh;
  const shr = sensibleBtuh / totalBtuh;

  // Estimate coil rows (rough correlation)
  const deltaT = input.entering_db_f - input.leaving_db_f;
  const rowsEstimate = Math.ceil(deltaT / 5);

  return {
    total_mbh: Math.round(totalBtuh / 100) / 10,
    sensible_mbh: Math.round(sensibleBtuh / 100) / 10,
    latent_mbh: Math.round(latentBtuh / 100) / 10,
    sensible_heat_ratio: Math.round(shr * 100) / 100,
    mass_flow_lb_hr: Math.round(massFlow),
    coil_rows_estimate: Math.max(4, Math.min(8, rowsEstimate))
  };
}

/**
 * Calculate system airflow and pressure drops
 */
function calculateAirflow(input: AirflowInput): AirflowResult {
  const componentPD: { [key: string]: number } = {};
  let internalSP = 0;

  // Calculate pressure drop for each component
  for (const comp of input.components) {
    let pd = 0;

    switch (comp.type) {
      case "filter_prefilter":
        pd = comp.merv && comp.merv >= 8 ? 0.25 : 0.15;
        componentPD["prefilter"] = pd;
        break;

      case "filter_final":
        if (comp.merv) {
          if (comp.merv >= 13) pd = 0.45;
          else if (comp.merv >= 10) pd = 0.35;
          else pd = 0.25;
        } else {
          pd = 0.35;
        }
        componentPD["final_filter"] = pd;
        break;

      case "cooling_coil":
        pd = (comp.rows || 6) * 0.08;
        componentPD["cooling_coil"] = Math.round(pd * 100) / 100;
        break;

      case "heating_coil":
        pd = (comp.rows || 1) * 0.06;
        componentPD["heating_coil"] = Math.round(pd * 100) / 100;
        break;

      case "mixing_section":
        pd = 0.10;
        componentPD["mixing"] = pd;
        break;

      case "damper":
        pd = 0.04;
        componentPD["dampers"] = (componentPD["dampers"] || 0) + pd;
        break;

      case "transition":
        pd = 0.08;
        componentPD["transitions"] = (componentPD["transitions"] || 0) + pd;
        break;

      case "sound_attenuator":
        pd = 0.25;
        componentPD["sound_attenuator"] = pd;
        break;
    }

    internalSP += pd;
  }

  const totalSP = internalSP + input.external_sp_in_wg;

  // Estimate fan power
  const efficiency = 0.70; // Assume 70% total efficiency
  const bhp = (input.cfm * totalSP) / (6356 * efficiency);

  // Motor sizing with margin
  let motorHp: number;
  if (bhp < 5) motorHp = Math.ceil(bhp * 1.25);
  else if (bhp < 20) motorHp = Math.ceil(bhp * 1.15);
  else motorHp = Math.ceil(bhp * 1.10);

  // Round to standard motor sizes
  const standardMotors = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  motorHp = standardMotors.find(hp => hp >= motorHp) || 100;

  return {
    internal_sp_in_wg: Math.round(internalSP * 100) / 100,
    external_sp_in_wg: input.external_sp_in_wg,
    total_sp_in_wg: Math.round(totalSP * 100) / 100,
    component_pd: componentPD,
    fan_bhp_estimate: Math.round(bhp * 100) / 100,
    fan_motor_hp_estimate: motorHp
  };
}

// Helper psychrometric functions
function calculateRH(db: number, wb: number): number {
  // Simplified RH calculation from DB and WB
  const diff = db - wb;
  const rh = 100 - (diff * 3.5); // Very approximate
  return Math.max(10, Math.min(100, rh));
}

function humidityRatio(db: number, rh: number): number {
  // Simplified humidity ratio calculation
  const pws = Math.exp(17.67 * db / (db + 243.5)) * 0.61078 * 0.145;
  const pw = (rh / 100) * pws;
  return 0.62198 * pw / (14.696 - pw);
}

function enthalpy(db: number, w: number): number {
  return 0.24 * db + w * (1061 + 0.444 * db);
}

// MCP Server setup
const server = createServer("simulation");

defineTool(
  server,
  "size",
  "Calculate AHU cabinet sizing from CFM requirements",
  {
    cfm: z.number().positive().describe("Design airflow (CFM)"),
    face_velocity_fpm: z.number().positive().optional().describe("Target face velocity (fpm), default 500"),
    aspect_ratio: z.number().positive().optional().describe("Width to height ratio, default 1.2")
  },
  (input) => calculateSizing(input)
);

defineTool(
  server,
  "thermal",
  "Calculate thermal loads from air conditions",
  {
    cfm: z.number().positive().describe("Airflow (CFM)"),
    entering_db_f: z.number().describe("Entering dry-bulb (°F)"),
    entering_wb_f: z.number().describe("Entering wet-bulb (°F)"),
    leaving_db_f: z.number().describe("Leaving dry-bulb (°F)"),
    leaving_wb_f: z.number().optional().describe("Leaving wet-bulb (°F)")
  },
  (input) => calculateThermal(input)
);

defineTool(
  server,
  "airflow",
  "Calculate system pressure drops and fan power",
  {
    cfm: z.number().positive().describe("Airflow (CFM)"),
    components: z.array(z.object({
      type: z.string(),
      rows: z.number().int().positive().optional(),
      merv: z.number().int().positive().optional()
    })).describe("List of components in airpath"),
    external_sp_in_wg: z.number().min(0).describe("External static pressure (in. w.g.)")
  },
  (input) => calculateAirflow(input)
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
