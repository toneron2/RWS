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

/** Dew point from humidity ratio (°F). */
export function dewPoint(W: number, pAtm: number = P_STD_PSIA): number {
  const Pw = (W * pAtm) / (0.62198 + W);
  // Approximate inversion of saturation pressure
  // Using simplified correlation
  const alpha = Math.log(Pw);
  return 100.45 + 33.193 * alpha + 2.319 * alpha * alpha;
}

/** Wet-bulb temperature from dry-bulb and humidity ratio (°F). */
export function wetBulb(tempF: number, W: number, pAtm: number = P_STD_PSIA): number {
  // Iterative solution
  let twb = tempF - 10; // Initial guess
  for (let i = 0; i < 20; i++) {
    const Wcalc = humidityRatioFromWetBulb(tempF, twb, pAtm);
    const error = W - Wcalc;
    if (Math.abs(error) < 0.0001) break;
    twb += error * 50; // Adjust guess
  }
  return twb;
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
