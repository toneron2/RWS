/**
 * Psychrometric relations in IP units (°F, psia, lb water per lb dry air,
 * Btu/lb). Shared by the psychrometrics and simulation servers so both
 * report the same air properties for the same state.
 *
 * Correlations follow the ASHRAE Handbook, Fundamentals, chapter 1.
 */

export const P_STD_PSIA = 14.696;

export interface AirState {
  db_temp_f: number;
  wb_temp_f?: number;
  rh_percent?: number;
  humidity_ratio?: number;
  enthalpy_btu_lb?: number;
  specific_volume_ft3_lb?: number;
  dew_point_f?: number;
}

/** Standard atmosphere pressure at altitude (psia). */
export function pressureAtAltitude(altitudeFt: number): number {
  return P_STD_PSIA * Math.pow(1 - 6.8754e-6 * altitudeFt, 5.2559);
}

/** Saturation pressure of water vapour over liquid water (psia). Valid 32 to 392°F. */
export function saturationPressure(tempF: number): number {
  const T = tempF + 459.67; // °R
  const C1 = -1.0440397e4;
  const C2 = -1.1294650e1;
  const C3 = -2.7022355e-2;
  const C4 = 1.2890360e-5;
  const C5 = -2.4780681e-9;
  const C6 = 6.5459673;
  const lnPws = C1 / T + C2 + C3 * T + C4 * T * T + C5 * T * T * T + C6 * Math.log(T);
  return Math.exp(lnPws);
}

/** Humidity ratio from dry-bulb and relative humidity. */
export function humidityRatioFromRH(tempF: number, rhPercent: number, pAtm: number = P_STD_PSIA): number {
  const Pw = (rhPercent / 100) * saturationPressure(tempF);
  return 0.62198 * Pw / (pAtm - Pw);
}

/** Relative humidity (%) from dry-bulb and humidity ratio. */
export function rhFromHumidityRatio(tempF: number, W: number, pAtm: number = P_STD_PSIA): number {
  const Pw = (W * pAtm) / (0.62198 + W);
  return (Pw / saturationPressure(tempF)) * 100;
}

/** Humidity ratio from dry-bulb and wet-bulb (ASHRAE eq. 35). */
export function humidityRatioFromWetBulb(dbF: number, wbF: number, pAtm: number = P_STD_PSIA): number {
  const Wstar = humidityRatioFromRH(wbF, 100, pAtm);
  return ((1093 - 0.556 * wbF) * Wstar - 0.240 * (dbF - wbF)) /
         (1093 + 0.444 * dbF - wbF);
}

/** Enthalpy of moist air (Btu per lb dry air). */
export function enthalpy(tempF: number, W: number): number {
  return 0.240 * tempF + W * (1061 + 0.444 * tempF);
}

/** Specific volume of moist air (ft³ per lb dry air). */
export function specificVolume(tempF: number, W: number, pAtm: number = P_STD_PSIA): number {
  const T = tempF + 459.67;
  return 0.370486 * T * (1 + 1.6078 * W) / pAtm;
}

/** Dew point from humidity ratio (°F), ASHRAE eq. 39 (above 32°F) and eq. 40 (below). */
export function dewPoint(W: number, pAtm: number = P_STD_PSIA): number {
  const Pw = (W * pAtm) / (0.62198 + W);
  const alpha = Math.log(Pw);
  const td = 100.45 + 33.193 * alpha + 2.319 * alpha ** 2 + 0.17074 * alpha ** 3 +
             1.2063 * Math.pow(Pw, 0.1984);
  if (td >= 32) return td;
  return 90.12 + 26.142 * alpha + 0.8927 * alpha ** 2;
}

/**
 * Wet-bulb temperature from dry-bulb and humidity ratio (°F).
 *
 * Inverts humidityRatioFromWetBulb by bisection. W(twb) rises
 * monotonically with twb, and twb can never exceed the dry-bulb.
 */
export function wetBulb(tempF: number, W: number, pAtm: number = P_STD_PSIA): number {
  let lo = tempF - 150;
  let hi = tempF;
  if (W >= humidityRatioFromWetBulb(tempF, hi, pAtm)) return hi;
  if (W <= humidityRatioFromWetBulb(tempF, lo, pAtm)) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (humidityRatioFromWetBulb(tempF, mid, pAtm) < W) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-6) break;
  }
  return (lo + hi) / 2;
}

/**
 * Complete an air state from dry-bulb plus one of humidity ratio, relative
 * humidity or wet-bulb (checked in that order).
 */
export function completeAirState(partial: Partial<AirState>, pAtm: number = P_STD_PSIA): AirState {
  if (partial.db_temp_f === undefined) {
    throw new Error("Insufficient data to determine air state: db_temp_f is required");
  }
  const state: AirState = { db_temp_f: partial.db_temp_f };

  if (partial.humidity_ratio !== undefined) {
    state.humidity_ratio = partial.humidity_ratio;
  } else if (partial.rh_percent !== undefined) {
    state.humidity_ratio = humidityRatioFromRH(state.db_temp_f, partial.rh_percent, pAtm);
  } else if (partial.wb_temp_f !== undefined) {
    if (partial.wb_temp_f > state.db_temp_f) {
      throw new Error(`Wet-bulb ${partial.wb_temp_f}°F cannot exceed dry-bulb ${state.db_temp_f}°F`);
    }
    state.humidity_ratio = humidityRatioFromWetBulb(state.db_temp_f, partial.wb_temp_f, pAtm);
  } else {
    throw new Error("Insufficient data to determine air state: give wb_temp_f, rh_percent or humidity_ratio");
  }

  state.rh_percent = rhFromHumidityRatio(state.db_temp_f, state.humidity_ratio, pAtm);
  state.enthalpy_btu_lb = enthalpy(state.db_temp_f, state.humidity_ratio);
  state.specific_volume_ft3_lb = specificVolume(state.db_temp_f, state.humidity_ratio, pAtm);
  state.dew_point_f = dewPoint(state.humidity_ratio, pAtm);
  state.wb_temp_f = wetBulb(state.db_temp_f, state.humidity_ratio, pAtm);

  return state;
}

/**
 * Air leaving a cooling coil. A coil cannot add moisture: without a leaving
 * wet-bulb, 95% RH is assumed but capped at the entering humidity ratio (a
 * dry coil); a given leaving wet-bulb wetter than the entering air is rejected.
 */
export function leavingCoilState(entering: AirState, leavingDb: number, leavingWb?: number,
                                 pAtm: number = P_STD_PSIA): AirState {
  const Win = entering.humidity_ratio!;
  if (leavingWb === undefined) {
    const W95 = humidityRatioFromRH(leavingDb, 95, pAtm);
    return completeAirState({ db_temp_f: leavingDb, humidity_ratio: Math.min(W95, Win) }, pAtm);
  }
  const leaving = completeAirState({ db_temp_f: leavingDb, wb_temp_f: leavingWb }, pAtm);
  if (leaving.humidity_ratio! > Win + 1e-9) {
    throw new Error(`Leaving air (${leavingDb}/${leavingWb}°F) holds more moisture than entering air; a cooling coil cannot add moisture`);
  }
  return leaving;
}
