/**
 * MCP Server: Estimation
 *
 * Provides cost estimation and pricing capabilities for AHU designs.
 * Calculates BOMs, applies margins, and generates quotes.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";
import { COMPONENT_TYPES, generateQuote, priceComponent } from "./calc.js";

// MCP Server setup
const server = createServer("estimation");

const componentShape = {
  component_type: z.enum(COMPONENT_TYPES),
  fan_type: z.enum(["plenum", "centrifugal"]).optional().describe("Fan construction, default plenum"),
  merv: z.number().int().positive().optional().describe("Filter MERV rating, for filter_prefilter and filter_final"),
  model: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  capacity_mbh: z.number().positive().optional(),
  motor_hp: z.number().positive().optional(),
  rows: z.number().int().positive().optional(),
  face_area_sqft: z.number().positive().optional()
};

defineTool(
  server,
  "price",
  "Generate quote and BOM for AHU design",
  {
    cfm: z.number().positive().describe("Design airflow (CFM)"),
    components: z.array(z.object(componentShape)).describe("List of components to price"),
    complexity: z.enum(["standard", "custom", "hospital", "hazardous"]).optional().describe("Labor complexity class, default standard")
  },
  ({ cfm, components, complexity }) => generateQuote(cfm, components, complexity)
);

defineTool(
  server,
  "component_price",
  "Get price for individual component",
  componentShape,
  (input) => priceComponent(input)
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
