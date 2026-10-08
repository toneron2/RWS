import { test } from "node:test";
import assert from "node:assert/strict";
import { fanCatalog, selectCoil, selectFan } from "./calc.js";

test("selected fan can deliver the requested airflow at its rated pressure", () => {
  for (const [cfm, tsp] of [[2000, 1], [12000, 5.5], [14000, 3], [24000, 4], [39000, 5.5]] as const) {
    const fan = selectFan(cfm, tsp);
    const data = fanCatalog.find(f => f.model === fan.model)!;
    assert.ok(data.max_cfm >= cfm, `${fan.model} rated ${data.max_cfm} CFM selected for ${cfm}`);
    assert.ok(data.max_sp_in_wg >= tsp, `${fan.model} rated ${data.max_sp_in_wg} in. w.g. selected for ${tsp}`);
    assert.ok(fan.operating_point.rpm <= data.rpm_range[1] && fan.operating_point.rpm >= data.rpm_range[0],
      `${fan.model} at ${fan.operating_point.rpm} rpm outside ${data.rpm_range}`);
    assert.ok(fan.motor_hp >= fan.operating_point.bhp, "motor covers brake horsepower");
  }
});

test("14,000 CFM no longer selects the 12,000 CFM PLR-18", () => {
  assert.notEqual(selectFan(14000, 3).model, "PLR-18");
});

test("fan type filter is honoured and impossible duties throw", () => {
  assert.equal(selectFan(5000, 2, "centrifugal_bi").type, "centrifugal_bi");
  assert.throws(() => selectFan(90000, 5.5), /No suitable fan/);
  assert.throws(() => selectFan(5000, 2, "centrifugal_af"), /No suitable fan/);
});

test("coil selection returns standard face sizes and water flow", () => {
  const coil = selectCoil("cooling", 24, 1043, 12);
  assert.equal(coil.type, "chilled_water");
  assert.ok(coil.dimensions.face_area_sqft >= 24);
  assert.equal(coil.performance.gpm, Math.round(1043 * 1000 / (500 * 12) * 10) / 10);
  assert.equal(selectCoil("heating", 24, 350, 20).type, "hot_water");
});

test("motor covers brake horsepower with margin at the top of the catalog", () => {
  for (const [cfm, tsp] of [[40000, 6], [25000, 5]] as const) {
    try {
      const fan = selectFan(cfm, tsp);
      assert.ok(fan.motor_hp >= fan.operating_point.bhp, `${cfm}/${tsp}: ${fan.motor_hp} HP for ${fan.operating_point.bhp} BHP`);
    } catch (e) { assert.match((e as Error).message, /No suitable fan/); }
  }
});

test("coil larger than the catalog is refused, not undersized", () => {
  assert.throws(() => selectCoil("cooling", 80, 1500, 12), /split the coil/);
});
