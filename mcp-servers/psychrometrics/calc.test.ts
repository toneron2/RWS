import { test } from "node:test";
import assert from "node:assert/strict";
import { completeAirState } from "../shared/psychro.js";
import { coolingProcess, heatingProcess, mixAirstreams } from "./calc.js";

test("cooling: Houston 100% OA, 12,000 CFM 96/78 to 55/54", () => {
  const r = coolingProcess(completeAirState({ db_temp_f: 96, wb_temp_f: 78 }), 12000, 55, 54);
  assert.ok(r.load_btuh > 900_000 && r.load_btuh < 1_050_000, `total ${r.load_btuh}`);
  assert.ok(r.sensible_btuh > 480_000 && r.sensible_btuh < 540_000, `sensible ${r.sensible_btuh}`);
  assert.ok(r.latent_btuh > 0, "latent positive for dehumidifying coil");
});

test("cooling rejects leaving temperature above entering", () => {
  assert.throws(() => coolingProcess(completeAirState({ db_temp_f: 55, rh_percent: 50 }), 1000, 60), /below entering/);
});

test("heating: 12,000 CFM from 28°F/50% to 55°F is sensible only, about 1.08 × CFM × ΔT", () => {
  const r = heatingProcess(completeAirState({ db_temp_f: 28, rh_percent: 50 }), 12000, 55);
  const ruleOfThumb = 1.08 * 12000 * 27; // 349,920 Btu/h at standard air
  assert.ok(Math.abs(r.load_btuh - ruleOfThumb) / ruleOfThumb < 0.1, `load ${r.load_btuh} vs ${ruleOfThumb}`);
  assert.equal(r.latent_btuh, 0);
  assert.equal(r.sensible_btuh, r.load_btuh);
  assert.ok(Math.abs(r.outlet.humidity_ratio! - r.inlet.humidity_ratio!) < 1e-12, "constant W");
  assert.ok(r.outlet.rh_percent! < r.inlet.rh_percent!, "RH falls on heating");
});

test("heating rejects leaving temperature below entering", () => {
  assert.throws(() => heatingProcess(completeAirState({ db_temp_f: 70, rh_percent: 50 }), 1000, 60), /above entering/);
});

test("mixing 30% outdoor air with return air lands between the two states", () => {
  const oa = completeAirState({ db_temp_f: 96, wb_temp_f: 78 });
  const ra = completeAirState({ db_temp_f: 75, rh_percent: 50 });
  const mixed = mixAirstreams(oa, 3000, ra, 7000);
  assert.ok(mixed.db_temp_f > 80.5 && mixed.db_temp_f < 82, `db ${mixed.db_temp_f}`);
  assert.ok(mixed.humidity_ratio! > ra.humidity_ratio! && mixed.humidity_ratio! < oa.humidity_ratio!);
  assert.ok(mixed.enthalpy_btu_lb! > ra.enthalpy_btu_lb! && mixed.enthalpy_btu_lb! < oa.enthalpy_btu_lb!);
});

test("cooling a dry airstream: no moisture added, no negative latent", () => {
  const r = coolingProcess(completeAirState({ db_temp_f: 75, rh_percent: 40 }), 10000, 55);
  assert.ok(Math.abs(r.outlet.humidity_ratio! - r.inlet.humidity_ratio!) < 1e-12, "constant W on a dry coil");
  assert.ok(r.latent_btuh >= 0 && r.latent_btuh < 0.02 * r.load_btuh, `latent ${r.latent_btuh}`);
  assert.throws(() => coolingProcess(completeAirState({ db_temp_f: 75, rh_percent: 40 }), 10000, 55, 54.5), /cannot add moisture/);
});
