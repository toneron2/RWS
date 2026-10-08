/**
 * MCP Server: Psychrometrics
 *
 * Provides psychrometric calculations for air property analysis.
 * This is the computational engine behind the ahu-psychro skill.
 */

import { z } from "zod";
import { createServer, defineTool, serve } from "../shared/mcp.js";

interface AirState {
  db_temp_f: number;
  wb_temp_f?: number;
  rh_percent?: number;
  humidity_ratio?: number;
  enthalpy_btu_lb?: number;
  specific_volume_ft3_lb?: number;
  dew_point_f?: number;
}

interface ProcessResult {
  inlet: AirState;
  outlet: AirState;
  load_btuh?: number;
  sensible_btuh?: number;
  latent_btuh?: number;
}

/**
 * Calculate saturation pressure at a given temperature
 */
function saturationPressure(tempF: number): number {
  const T = tempF + 459.67; // Convert to Rankine
  // ASHRAE correlation for saturation pressure
  const C1 = -1.0440397e4;
  const C2 = -1.1294650e1;
  const C3 = -2.7022355e-2;
  const C4 = 1.2890360e-5;
  const C5 = -2.4780681e-9;
  const C6 = 6.5459673;

  const lnPws = C1/T + C2 + C3*T + C4*T*T + C5*T*T*T + C6*Math.log(T);
  return Math.exp(lnPws); // psia
}

/**
 * Calculate humidity ratio from RH and temperature
 */
function humidityRatioFromRH(tempF: number, rhPercent: number, pAtm: number = 14.696): number {
  const Pws = saturationPressure(tempF);
  const Pw = (rhPercent / 100) * Pws;
  return 0.62198 * Pw / (pAtm - Pw);
}

/**
 * Calculate RH from humidity ratio and temperature
 */
function rhFromHumidityRatio(tempF: number, W: number, pAtm: number = 14.696): number {
  const Pws = saturationPressure(tempF);
  const Pw = (W * pAtm) / (0.62198 + W);
  return (Pw / Pws) * 100;
}

/**
 * Calculate enthalpy from temperature and humidity ratio
 */
function enthalpy(tempF: number, W: number): number {
  return 0.240 * tempF + W * (1061 + 0.444 * tempF);
}

/**
 * Calculate specific volume
 */
function specificVolume(tempF: number, W: number, pAtm: number = 14.696): number {
  const T = tempF + 459.67;
  return 0.370486 * T * (1 + 1.6078 * W) / pAtm;
}

/**
 * Calculate dew point from humidity ratio
 */
function dewPoint(W: number, pAtm: number = 14.696): number {
  const Pw = (W * pAtm) / (0.62198 + W);
  // Approximate inversion of saturation pressure
  // Using simplified correlation
  const alpha = Math.log(Pw);
  return 100.45 + 33.193 * alpha + 2.319 * alpha * alpha;
}

/**
 * Calculate wet bulb from dry bulb and humidity ratio
 */
function wetBulb(tempF: number, W: number, pAtm: number = 14.696): number {
  // Iterative solution
  let twb = tempF - 10; // Initial guess
  for (let i = 0; i < 20; i++) {
    const Wstar = humidityRatioFromRH(twb, 100, pAtm);
    const Wcalc = ((1093 - 0.556 * twb) * Wstar - 0.240 * (tempF - twb)) /
                  (1093 + 0.444 * tempF - twb);
    const error = W - Wcalc;
    if (Math.abs(error) < 0.0001) break;
    twb += error * 50; // Adjust guess
  }
  return twb;
}

/**
 * Complete air state from partial information
 */
function completeAirState(partial: Partial<AirState>, pAtm: number = 14.696): AirState {
  const state: AirState = { db_temp_f: partial.db_temp_f! };

  // Determine humidity ratio
  if (partial.humidity_ratio !== undefined) {
    state.humidity_ratio = partial.humidity_ratio;
  } else if (partial.rh_percent !== undefined) {
    state.humidity_ratio = humidityRatioFromRH(state.db_temp_f, partial.rh_percent, pAtm);
  } else if (partial.wb_temp_f !== undefined) {
    // Calculate W from wet bulb (simplified)
    const Wstar = humidityRatioFromRH(partial.wb_temp_f, 100, pAtm);
    state.humidity_ratio = ((1093 - 0.556 * partial.wb_temp_f) * Wstar -
                           0.240 * (state.db_temp_f - partial.wb_temp_f)) /
                          (1093 + 0.444 * state.db_temp_f - partial.wb_temp_f);
  } else {
    throw new Error("Insufficient data to determine air state");
  }

  // Calculate remaining properties
  state.rh_percent = rhFromHumidityRatio(state.db_temp_f, state.humidity_ratio, pAtm);
  state.enthalpy_btu_lb = enthalpy(state.db_temp_f, state.humidity_ratio);
  state.specific_volume_ft3_lb = specificVolume(state.db_temp_f, state.humidity_ratio, pAtm);
  state.dew_point_f = dewPoint(state.humidity_ratio, pAtm);
  state.wb_temp_f = wetBulb(state.db_temp_f, state.humidity_ratio, pAtm);

  return state;
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

function pressureAtAltitude(altitudeFt: number): number {
  return 14.696 * Math.pow(1 - 6.8754e-6 * altitudeFt, 5.2559);
}

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
