/**
 * MCP Server: Simulation
 *
 * Provides simulation capabilities for AHU design validation.
 * Includes sizing calculations, thermal performance, and airflow analysis.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";
import { AIRPATH_COMPONENT_TYPES, calculateAirflow, calculateSizing, calculateThermal } from "./calc.js";

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
  "Calculate cooling coil loads from entering and leaving air conditions (95% RH leaving assumed when leaving_wb_f is omitted)",
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
      type: z.enum(AIRPATH_COMPONENT_TYPES),
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
