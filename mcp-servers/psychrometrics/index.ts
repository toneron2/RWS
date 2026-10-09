/**
 * MCP Server: Psychrometrics
 *
 * Provides psychrometric calculations for air property analysis.
 * This is the computational engine behind the ahu-psychro skill.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";
import { completeAirState, pressureAtAltitude } from "../shared/psychro.js";
import { coolingProcess, heatingProcess, mixAirstreams } from "./calc.js";

// MCP Server setup
const server = createServer("psychrometrics");

const airStateShape = {
  db_temp_f: z.number().describe("Dry-bulb temperature (°F)"),
  wb_temp_f: z.number().optional().describe("Wet-bulb temperature (°F)"),
  rh_percent: z.number().min(0).max(100).optional().describe("Relative humidity (%)"),
  humidity_ratio: z.number().min(0).optional().describe("Humidity ratio (lb water / lb dry air)")
};

const altitudeShape = {
  altitude_ft: z.number().min(0).optional().describe("Altitude (ft), default 0")
};

defineTool(
  server,
  "calculate",
  "Calculate complete air properties from dry-bulb plus one of wet-bulb, RH or humidity ratio",
  { ...airStateShape, ...altitudeShape },
  ({ altitude_ft, ...state }) => completeAirState(state, pressureAtAltitude(altitude_ft ?? 0))
);

defineTool(
  server,
  "mix",
  "Calculate mixed air state from two airstreams (mass-weighted)",
  {
    stream1: z.object(airStateShape).describe("First airstream state"),
    cfm1: z.number().positive().describe("First stream CFM"),
    stream2: z.object(airStateShape).describe("Second airstream state"),
    cfm2: z.number().positive().describe("Second stream CFM"),
    ...altitudeShape
  },
  ({ stream1, cfm1, stream2, cfm2, altitude_ft }) => {
    const pAtm = pressureAtAltitude(altitude_ft ?? 0);
    return mixAirstreams(completeAirState(stream1, pAtm), cfm1, completeAirState(stream2, pAtm), cfm2, pAtm);
  }
);

defineTool(
  server,
  "process",
  "Analyze a coil process. Cooling: loads positive for heat removed; leaving_wb_f optional " +
  "(95% RH leaving assumed). Heating: sensible only at constant humidity ratio, loads positive " +
  "for heat added; leaving_wb_f is ignored.",
  {
    process_type: z.enum(["cooling", "heating"]),
    entering: z.object(airStateShape).describe("Entering air state"),
    cfm: z.number().positive().describe("Airflow (CFM)"),
    leaving_db_f: z.number().describe("Leaving dry-bulb (°F)"),
    leaving_wb_f: z.number().optional().describe("Leaving wet-bulb (°F), cooling only"),
    ...altitudeShape
  },
  ({ process_type, entering, cfm, leaving_db_f, leaving_wb_f, altitude_ft }) => {
    const pAtm = pressureAtAltitude(altitude_ft ?? 0);
    const enteringState = completeAirState(entering, pAtm);
    return process_type === "heating"
      ? heatingProcess(enteringState, cfm, leaving_db_f, pAtm)
      : coolingProcess(enteringState, cfm, leaving_db_f, leaving_wb_f, pAtm);
  }
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
