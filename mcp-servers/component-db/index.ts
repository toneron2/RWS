/**
 * MCP Server: Component Database
 *
 * Provides access to HVAC component catalogs and selection data.
 * This simulates a real component database that would be populated
 * with manufacturer data for fans, coils, filters, etc.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";
import { coilCatalog, fanCatalog, selectCoil, selectFan } from "./calc.js";

// MCP Server setup
const server = createServer("component-db");

// Only fans and coils have catalog data; filters and dampers are priced by the estimation server.
const componentType = z.enum(["fan", "coil"]);

defineTool(
  server,
  "lookup",
  "Look up component by model number",
  { component_type: componentType, model: z.string() },
  ({ component_type, model }) => {
    const component = component_type === "fan"
      ? fanCatalog.find(f => f.model === model)
      : coilCatalog.find(c => c.model === model);
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
    return coilCatalog.map(c => ({ model: c.model, type: c.type, rows: c.rows }));
  }
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
