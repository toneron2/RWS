/**
 * MCP Server: Psychrometrics
 *
 * Provides psychrometric calculations for air property analysis.
 * This is the computational engine behind the ahu-psychro skill.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";
import { AirState, completeAirState, pressureAtAltitude } from "../shared/psychro.js";

interface ProcessResult {
  inlet: AirState;
  outlet: AirState;
  load_btuh?: number;
  sensible_btuh?: number;
  latent_btuh?: number;
}

/**
 * Mix two airstreams
 */
function mixAirstreams(
  state1: AirState, cfm1: number,
  state2: AirState, cfm2: number,
  pAtm: number = 14.696
): AirState {
  const totalCfm = cfm1 + cfm2;
  const W_mix = (cfm1 * state1.humidity_ratio! + cfm2 * state2.humidity_ratio!) / totalCfm;
  const h_mix = (cfm1 * state1.enthalpy_btu_lb! + cfm2 * state2.enthalpy_btu_lb!) / totalCfm;

  // Solve for temperature from enthalpy and humidity ratio
  const T_mix = (h_mix - 1061 * W_mix) / (0.240 + 0.444 * W_mix);

  return completeAirState({ db_temp_f: T_mix, humidity_ratio: W_mix }, pAtm);
}

/**
 * Cooling coil process
 */
function coolingProcess(
  entering: AirState,
  cfm: number,
  leaving_db: number,
  leaving_wb?: number,
  pAtm: number = 14.696
): ProcessResult {
  let leaving: AirState;

  if (leaving_wb !== undefined) {
    leaving = completeAirState({ db_temp_f: leaving_db, wb_temp_f: leaving_wb }, pAtm);
  } else {
    // Assume saturation at leaving conditions (worst case)
    leaving = completeAirState({ db_temp_f: leaving_db, rh_percent: 95 }, pAtm);
  }

  const v_avg = (entering.specific_volume_ft3_lb! + leaving.specific_volume_ft3_lb!) / 2;
  const massFlow = cfm * 60 / v_avg; // lb/hr

  const totalLoad = massFlow * (entering.enthalpy_btu_lb! - leaving.enthalpy_btu_lb!);
  const sensibleLoad = massFlow * 0.24 * (entering.db_temp_f - leaving.db_temp_f);
  const latentLoad = totalLoad - sensibleLoad;

  return {
    inlet: entering,
    outlet: leaving,
    load_btuh: totalLoad,
    sensible_btuh: sensibleLoad,
    latent_btuh: latentLoad
  };
}

// MCP Server setup
const server = createServer("psychrometrics");

const airStateShape = {
  db_temp_f: z.number().describe("Dry-bulb temperature (°F)"),
  wb_temp_f: z.number().optional().describe("Wet-bulb temperature (°F)"),
  rh_percent: z.number().min(0).max(100).optional().describe("Relative humidity (%)"),
  humidity_ratio: z.number().min(0).optional().describe("Humidity ratio (lb water / lb dry air)")
};

defineTool(
  server,
  "calculate",
  "Calculate complete air properties from dry-bulb plus one of wet-bulb, RH or humidity ratio",
  { ...airStateShape, altitude_ft: z.number().min(0).optional().describe("Altitude (ft), default 0") },
  ({ altitude_ft, ...state }) => completeAirState(state, pressureAtAltitude(altitude_ft ?? 0))
);

defineTool(
  server,
  "mix",
  "Calculate mixed air state from two airstreams",
  {
    stream1: z.object(airStateShape).describe("First airstream state"),
    cfm1: z.number().positive().describe("First stream CFM"),
    stream2: z.object(airStateShape).describe("Second airstream state"),
    cfm2: z.number().positive().describe("Second stream CFM")
  },
  ({ stream1, cfm1, stream2, cfm2 }) =>
    mixAirstreams(completeAirState(stream1), cfm1, completeAirState(stream2), cfm2)
);

defineTool(
  server,
  "process",
  "Analyze heating or cooling process",
  {
    process_type: z.enum(["cooling", "heating"]),
    entering: z.object(airStateShape).describe("Entering air state"),
    cfm: z.number().positive().describe("Airflow (CFM)"),
    leaving_db_f: z.number().describe("Leaving dry-bulb (°F)"),
    leaving_wb_f: z.number().optional().describe("Leaving wet-bulb (°F); if omitted, 95% RH leaving air is assumed")
  },
  ({ entering, cfm, leaving_db_f, leaving_wb_f }) =>
    coolingProcess(completeAirState(entering), cfm, leaving_db_f, leaving_wb_f)
);

serve(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
