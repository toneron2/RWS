/**
 * Simulation calculations: cabinet sizing, coil thermal loads and airpath
 * pressure drop. Kept separate from the server entry point so they can be
 * unit tested.
 */

import { completeAirState } from "../shared/psychro.js";

export interface SizingInput {
  cfm: number;
  face_velocity_fpm?: number;
  aspect_ratio?: number;
}

export interface SizingResult {
  face_area_sqft: number;
  width_in: number;
  height_in: number;
  actual_velocity_fpm: number;
}

export interface ThermalInput {
  cfm: number;
  entering_db_f: number;
  entering_wb_f: number;
  leaving_db_f: number;
  leaving_wb_f?: number;
}

export interface ThermalResult {
  total_mbh: number;
  sensible_mbh: number;
  latent_mbh: number;
  sensible_heat_ratio: number;
  mass_flow_lb_hr: number;
  coil_rows_estimate: number;
}

export const AIRPATH_COMPONENT_TYPES = [
  "filter_prefilter", "filter_final", "filter_hepa",
  "cooling_coil", "heating_coil",
  "mixing_section", "damper", "transition", "sound_attenuator", "humidifier"
] as const;
export type AirpathComponentType = (typeof AIRPATH_COMPONENT_TYPES)[number];

export interface AirflowInput {
  cfm: number;
  components: {
    type: AirpathComponentType;
    rows?: number;
    merv?: number;
  }[];
  external_sp_in_wg: number;
}

export interface AirflowResult {
  internal_sp_in_wg: number;
  external_sp_in_wg: number;
  total_sp_in_wg: number;
  component_pd: { [key: string]: number };
  fan_bhp_estimate: number;
  fan_motor_hp_estimate: number;
}

/**
 * Calculate cabinet sizing from CFM requirements
 */
export function calculateSizing(input: SizingInput): SizingResult {
  const faceVelocity = input.face_velocity_fpm || 500;
  const aspectRatio = input.aspect_ratio || 1.2; // W:H

  const faceAreaSqft = input.cfm / faceVelocity;
  const faceAreaSqIn = faceAreaSqft * 144;

  // Calculate dimensions
  const heightIn = Math.sqrt(faceAreaSqIn / aspectRatio);
  const widthIn = faceAreaSqIn / heightIn;

  // Round to nearest standard increment (6")
  const roundedWidth = Math.ceil(widthIn / 6) * 6;
  const roundedHeight = Math.ceil(heightIn / 6) * 6;

  const actualArea = (roundedWidth * roundedHeight) / 144;
  const actualVelocity = input.cfm / actualArea;

  return {
    face_area_sqft: Math.round(actualArea * 100) / 100,
    width_in: roundedWidth,
    height_in: roundedHeight,
    actual_velocity_fpm: Math.round(actualVelocity)
  };
}

/**
 * Calculate cooling coil loads from entering and leaving air conditions.
 * When no leaving wet-bulb is given, 95% RH leaving air is assumed.
 */
export function calculateThermal(input: ThermalInput): ThermalResult {
  const entering = completeAirState({
    db_temp_f: input.entering_db_f,
    wb_temp_f: input.entering_wb_f
  });
  const leaving = input.leaving_wb_f !== undefined
    ? completeAirState({ db_temp_f: input.leaving_db_f, wb_temp_f: input.leaving_wb_f })
    : completeAirState({ db_temp_f: input.leaving_db_f, rh_percent: 95 });

  // Mass flow from the mean specific volume across the coil
  const avgSpecVol = (entering.specific_volume_ft3_lb! + leaving.specific_volume_ft3_lb!) / 2;
  const massFlow = (input.cfm * 60) / avgSpecVol; // lb/hr

  // Load calculations
  const totalBtuh = massFlow * (entering.enthalpy_btu_lb! - leaving.enthalpy_btu_lb!);
  const sensibleBtuh = massFlow * 0.24 * (input.entering_db_f - input.leaving_db_f);
  const latentBtuh = totalBtuh - sensibleBtuh;
  const shr = totalBtuh !== 0 ? sensibleBtuh / totalBtuh : 1;

  // Estimate coil rows (rough correlation)
  const deltaT = input.entering_db_f - input.leaving_db_f;
  const rowsEstimate = Math.ceil(deltaT / 5);

  return {
    total_mbh: Math.round(totalBtuh / 100) / 10,
    sensible_mbh: Math.round(sensibleBtuh / 100) / 10,
    latent_mbh: Math.round(latentBtuh / 100) / 10,
    sensible_heat_ratio: Math.round(shr * 100) / 100,
    mass_flow_lb_hr: Math.round(massFlow),
    coil_rows_estimate: Math.max(4, Math.min(8, rowsEstimate))
  };
}

/**
 * Calculate system airflow and pressure drops
 */
export function calculateAirflow(input: AirflowInput): AirflowResult {
  const componentPD: { [key: string]: number } = {};
  let internalSP = 0;

  // Calculate pressure drop for each component
  for (const comp of input.components) {
    let pd = 0;

    switch (comp.type) {
      case "filter_prefilter":
        pd = comp.merv && comp.merv >= 8 ? 0.25 : 0.15;
        componentPD["prefilter"] = pd;
        break;

      case "filter_final":
        if (comp.merv) {
          if (comp.merv >= 13) pd = 0.45;
          else if (comp.merv >= 10) pd = 0.35;
          else pd = 0.25;
        } else {
          pd = 0.35;
        }
        componentPD["final_filter"] = pd;
        break;

      case "cooling_coil":
        pd = (comp.rows || 6) * 0.08;
        componentPD["cooling_coil"] = Math.round(pd * 100) / 100;
        break;

      case "heating_coil":
        pd = (comp.rows || 1) * 0.06;
        componentPD["heating_coil"] = Math.round(pd * 100) / 100;
        break;

      case "mixing_section":
        pd = 0.10;
        componentPD["mixing"] = pd;
        break;

      case "damper":
        pd = 0.04;
        componentPD["dampers"] = (componentPD["dampers"] || 0) + pd;
        break;

      case "transition":
        pd = 0.08;
        componentPD["transitions"] = (componentPD["transitions"] || 0) + pd;
        break;

      case "sound_attenuator":
        pd = 0.25;
        componentPD["sound_attenuator"] = pd;
        break;

      case "filter_hepa":
        pd = 1.0; // clean; typical range 0.5 to 1.5
        componentPD["hepa_filter"] = pd;
        break;

      case "humidifier":
        pd = 0.05; // steam dispersion tubes
        componentPD["humidifier"] = pd;
        break;

      default: {
        const unknown: never = comp.type;
        throw new Error(`Unknown airpath component type "${unknown}". Known types: ${AIRPATH_COMPONENT_TYPES.join(", ")}`);
      }
    }

    internalSP += pd;
  }

  const totalSP = internalSP + input.external_sp_in_wg;

  // Estimate fan power
  const efficiency = 0.70; // Assume 70% total efficiency
  const bhp = (input.cfm * totalSP) / (6356 * efficiency);

  // Motor sizing with margin
  let motorHp: number;
  if (bhp < 5) motorHp = Math.ceil(bhp * 1.25);
  else if (bhp < 20) motorHp = Math.ceil(bhp * 1.15);
  else motorHp = Math.ceil(bhp * 1.10);

  // Round to standard motor sizes
  const standardMotors = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  motorHp = standardMotors.find(hp => hp >= motorHp) || 100;

  return {
    internal_sp_in_wg: Math.round(internalSP * 100) / 100,
    external_sp_in_wg: input.external_sp_in_wg,
    total_sp_in_wg: Math.round(totalSP * 100) / 100,
    component_pd: componentPD,
    fan_bhp_estimate: Math.round(bhp * 100) / 100,
    fan_motor_hp_estimate: motorHp
  };
}
