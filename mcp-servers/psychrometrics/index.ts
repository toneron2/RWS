/**
 * MCP Server: Psychrometrics
 *
 * Provides psychrometric calculations for air property analysis.
 * This is the computational engine behind the ahu-psychro skill.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Constants
const R_DA = 53.352; // Gas constant for dry air, ft·lbf/(lbm·°R)
const R_V = 85.778;  // Gas constant for water vapor

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
const server = new Server(
  { name: "psychrometrics", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "calculate",
      description: "Calculate complete air properties from partial state",
      inputSchema: {
        type: "object",
        properties: {
          db_temp_f: { type: "number", description: "Dry-bulb temperature (°F)" },
          wb_temp_f: { type: "number", description: "Wet-bulb temperature (°F)" },
          rh_percent: { type: "number", description: "Relative humidity (%)" },
          humidity_ratio: { type: "number", description: "Humidity ratio (lb/lb)" },
          altitude_ft: { type: "number", description: "Altitude (ft)", default: 0 }
        },
        required: ["db_temp_f"]
      }
    },
    {
      name: "mix",
      description: "Calculate mixed air state from two airstreams",
      inputSchema: {
        type: "object",
        properties: {
          stream1: { type: "object", description: "First airstream state" },
          cfm1: { type: "number", description: "First stream CFM" },
          stream2: { type: "object", description: "Second airstream state" },
          cfm2: { type: "number", description: "Second stream CFM" }
        },
        required: ["stream1", "cfm1", "stream2", "cfm2"]
      }
    },
    {
      name: "process",
      description: "Analyze heating or cooling process",
      inputSchema: {
        type: "object",
        properties: {
          process_type: { type: "string", enum: ["cooling", "heating"] },
          entering: { type: "object", description: "Entering air state" },
          cfm: { type: "number", description: "Airflow (CFM)" },
          leaving_db_f: { type: "number", description: "Leaving dry-bulb (°F)" },
          leaving_wb_f: { type: "number", description: "Leaving wet-bulb (°F)" }
        },
        required: ["process_type", "entering", "cfm", "leaving_db_f"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "calculate": {
      const pAtm = args.altitude_ft ?
        14.696 * Math.pow(1 - 6.8754e-6 * args.altitude_ft, 5.2559) : 14.696;
      const state = completeAirState(args as Partial<AirState>, pAtm);
      return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
    }

    case "mix": {
      const state1 = completeAirState(args.stream1);
      const state2 = completeAirState(args.stream2);
      const mixed = mixAirstreams(state1, args.cfm1, state2, args.cfm2);
      return { content: [{ type: "text", text: JSON.stringify(mixed, null, 2) }] };
    }

    case "process": {
      const entering = completeAirState(args.entering);
      const result = coolingProcess(
        entering,
        args.cfm,
        args.leaving_db_f,
        args.leaving_wb_f
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
