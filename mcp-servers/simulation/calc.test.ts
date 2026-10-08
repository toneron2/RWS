import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAirflow, calculateSizing, calculateThermal } from "./calc.js";

test("thermal: Houston 100% OA coil, 12,000 CFM 96/78 to 55/54", () => {
  const r = calculateThermal({ cfm: 12000, entering_db_f: 96, entering_wb_f: 78, leaving_db_f: 55, leaving_wb_f: 54 });
  // 4.5 × CFM × Δh with Δh ≈ 18.7 Btu/lb gives roughly 1,000 MBH; the
  // psychrometrics server computes 979 MBH for the same states.
  assert.ok(r.total_mbh > 900 && r.total_mbh < 1050, `total ${r.total_mbh} MBH`);
  assert.ok(r.sensible_mbh > 480 && r.sensible_mbh < 540, `sensible ${r.sensible_mbh} MBH`);
  assert.ok(r.sensible_heat_ratio > 0.45 && r.sensible_heat_ratio < 0.6, `SHR ${r.sensible_heat_ratio}`);
  assert.ok(r.mass_flow_lb_hr > 50000 && r.mass_flow_lb_hr < 54000, `mass flow ${r.mass_flow_lb_hr}`);
  assert.equal(r.coil_rows_estimate, 8);
});

test("thermal: leaving wet-bulb defaults to 95% RH", () => {
  const explicit = calculateThermal({ cfm: 10000, entering_db_f: 80, entering_wb_f: 67, leaving_db_f: 55, leaving_wb_f: 54.2 });
  const assumed = calculateThermal({ cfm: 10000, entering_db_f: 80, entering_wb_f: 67, leaving_db_f: 55 });
  assert.ok(Math.abs(explicit.total_mbh - assumed.total_mbh) < 15, `${explicit.total_mbh} vs ${assumed.total_mbh}`);
});

test("sizing rounds to 6 inch increments near 500 fpm", () => {
  const r = calculateSizing({ cfm: 12000 });
  assert.equal(r.width_in % 6, 0);
  assert.equal(r.height_in % 6, 0);
  assert.ok(r.actual_velocity_fpm <= 500 && r.actual_velocity_fpm > 400);
});

test("airflow sums component drops and external static", () => {
  const r = calculateAirflow({
    cfm: 12000,
    components: [{ type: "filter_final", merv: 13 }, { type: "cooling_coil", rows: 6 }, { type: "damper" }, { type: "damper" }],
    external_sp_in_wg: 2
  });
  assert.equal(r.internal_sp_in_wg, 1.01);
  assert.equal(r.total_sp_in_wg, 3.01);
  assert.equal(r.component_pd.dampers, 0.08);
});
