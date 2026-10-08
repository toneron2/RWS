import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completeAirState,
  enthalpy,
  humidityRatioFromRH,
  humidityRatioFromWetBulb,
  pressureAtAltitude,
  saturationPressure
} from "./psychro.js";

// Reference values from the ASHRAE Handbook, Fundamentals, psychrometric
// tables at 14.696 psia. Tolerances reflect the correlations' stated accuracy.

function near(actual: number, expected: number, tol: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} not within ${tol} of ${expected}`);
}

test("saturation pressure matches steam tables", () => {
  near(saturationPressure(212), 14.696, 0.02, "Pws at 212°F");
  near(saturationPressure(70), 0.3632, 0.001, "Pws at 70°F");
  near(saturationPressure(32), 0.08865, 0.0005, "Pws at 32°F");
});

test("humidity ratio from RH", () => {
  near(humidityRatioFromRH(75, 50), 0.00924, 0.0001, "W at 75°F 50%");
  near(humidityRatioFromRH(55, 100), 0.00919, 0.0001, "W at 55°F saturated");
});

test("humidity ratio from wet-bulb", () => {
  near(humidityRatioFromWetBulb(96, 78), 0.0165, 0.0003, "W at 96/78");
  near(humidityRatioFromWetBulb(80, 67), 0.0112, 0.0003, "W at 80/67 (ARI rating point)");
});

test("enthalpy", () => {
  near(enthalpy(80, 0.0112), 31.4, 0.2, "h at 80/67");
  near(enthalpy(55, 0.00873), 22.7, 0.2, "h at 55°F 95%");
});

test("altitude pressure", () => {
  near(pressureAtAltitude(0), 14.696, 1e-9, "sea level");
  near(pressureAtAltitude(5000), 12.23, 0.02, "5000 ft");
});

test("completeAirState from each input", () => {
  const fromRh = completeAirState({ db_temp_f: 75, rh_percent: 50 });
  near(fromRh.humidity_ratio!, 0.00924, 0.0001, "W");
  near(fromRh.enthalpy_btu_lb!, 28.1, 0.1, "h");
  near(fromRh.specific_volume_ft3_lb!, 13.68, 0.02, "v");
  near(fromRh.dew_point_f!, 55.1, 0.5, "dew point");

  const fromWb = completeAirState({ db_temp_f: 96, wb_temp_f: 78 });
  near(fromWb.rh_percent!, 45, 1, "RH at 96/78");

  const fromW = completeAirState({ db_temp_f: 75, humidity_ratio: 0.00924 });
  near(fromW.rh_percent!, 50, 0.5, "RH from W");

  assert.throws(() => completeAirState({ db_temp_f: 75 }), /Insufficient data/);
});
