/**
 * Air-stream processes: mixing, cooling and heating. Kept separate from
 * the server entry point so they can be unit tested.
 */

import { AirState, completeAirState, leavingCoilState, P_STD_PSIA } from "../shared/psychro.js";

export interface ProcessResult {
  inlet: AirState;
  outlet: AirState;
  /** Total load, Btu/h. Positive is heat removed for cooling, heat added for heating. */
  load_btuh: number;
  sensible_btuh: number;
  latent_btuh: number;
}

/** Mass flow of dry air (lb/h) across a coil, from the mean specific volume. */
function massFlow(cfm: number, a: AirState, b: AirState): number {
  const vAvg = (a.specific_volume_ft3_lb! + b.specific_volume_ft3_lb!) / 2;
  return cfm * 60 / vAvg;
}

/**
 * Mix two airstreams, weighting by dry-air mass flow.
 */
export function mixAirstreams(
  state1: AirState, cfm1: number,
  state2: AirState, cfm2: number,
  pAtm: number = P_STD_PSIA
): AirState {
  const m1 = cfm1 / state1.specific_volume_ft3_lb!;
  const m2 = cfm2 / state2.specific_volume_ft3_lb!;
  const W_mix = (m1 * state1.humidity_ratio! + m2 * state2.humidity_ratio!) / (m1 + m2);
  const h_mix = (m1 * state1.enthalpy_btu_lb! + m2 * state2.enthalpy_btu_lb!) / (m1 + m2);

  // Solve for temperature from enthalpy and humidity ratio
  const T_mix = (h_mix - 1061 * W_mix) / (0.240 + 0.444 * W_mix);

  return completeAirState({ db_temp_f: T_mix, humidity_ratio: W_mix }, pAtm);
}

/**
 * Cooling coil process. Loads are positive for heat removed. When no
 * leaving wet-bulb is given, 95% RH leaving air is assumed.
 */
export function coolingProcess(
  entering: AirState,
  cfm: number,
  leaving_db: number,
  leaving_wb?: number,
  pAtm: number = P_STD_PSIA
): ProcessResult {
  if (leaving_db >= entering.db_temp_f) {
    throw new Error(`Cooling process needs leaving dry-bulb (${leaving_db}°F) below entering (${entering.db_temp_f}°F)`);
  }
  const leaving = leavingCoilState(entering, leaving_db, leaving_wb, pAtm);

  const m = massFlow(cfm, entering, leaving);
  const totalLoad = m * (entering.enthalpy_btu_lb! - leaving.enthalpy_btu_lb!);
  const sensibleLoad = m * 0.24 * (entering.db_temp_f - leaving.db_temp_f);

  return {
    inlet: entering,
    outlet: leaving,
    load_btuh: totalLoad,
    sensible_btuh: sensibleLoad,
    latent_btuh: totalLoad - sensibleLoad
  };
}

/**
 * Heating coil process: sensible only, at constant humidity ratio.
 * Loads are positive for heat added.
 */
export function heatingProcess(
  entering: AirState,
  cfm: number,
  leaving_db: number,
  pAtm: number = P_STD_PSIA
): ProcessResult {
  if (leaving_db <= entering.db_temp_f) {
    throw new Error(`Heating process needs leaving dry-bulb (${leaving_db}°F) above entering (${entering.db_temp_f}°F)`);
  }
  const leaving = completeAirState({ db_temp_f: leaving_db, humidity_ratio: entering.humidity_ratio }, pAtm);

  const m = massFlow(cfm, entering, leaving);
  const load = m * (leaving.enthalpy_btu_lb! - entering.enthalpy_btu_lb!);

  return {
    inlet: entering,
    outlet: leaving,
    load_btuh: load,
    sensible_btuh: load,
    latent_btuh: 0
  };
}
