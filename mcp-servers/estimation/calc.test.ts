import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_TYPES, generateQuote, priceComponent } from "./calc.js";

test("unknown component type is an error, not a silent zero", () => {
  assert.throws(
    () => priceComponent({ component_type: "humidifier" as never }),
    /Unknown component type "humidifier"/
  );
});

test("every declared component type prices to at least one BOM line", () => {
  for (const component_type of COMPONENT_TYPES) {
    const r = priceComponent({ component_type, face_area_sqft: 24, motor_hp: 20, rows: 6, merv: 13 });
    assert.ok(r.items.length > 0, `${component_type} produced no BOM lines`);
    assert.ok(r.total > 0, `${component_type} priced at ${r.total}`);
    assert.equal(r.total, r.items.reduce((s, i) => s + i.extended, 0));
  }
});

test("filters use the filter price table", () => {
  const hepa = priceComponent({ component_type: "filter_hepa", face_area_sqft: 24 });
  const merv13 = priceComponent({ component_type: "filter_final", face_area_sqft: 24, merv: 13 });
  const merv14 = priceComponent({ component_type: "filter_final", face_area_sqft: 24, merv: 14 });
  assert.ok(hepa.total > merv14.total && merv14.total > merv13.total);
  assert.equal(hepa.items[1].quantity, 6, "24 sqft is six 24x24 cells");
});

test("centrifugal fans price differently from plenum fans", () => {
  const plenum = priceComponent({ component_type: "fan", motor_hp: 20 });
  const centrifugal = priceComponent({ component_type: "fan", motor_hp: 20, fan_type: "centrifugal" });
  assert.notEqual(plenum.total, centrifugal.total);
});

test("quote subtotals follow BOM categories and carry no empty 'Other'", () => {
  const q = generateQuote(12000, [
    { component_type: "cooling_coil", rows: 8, face_area_sqft: 24 },
    { component_type: "fan", motor_hp: 40 },
    { component_type: "vfd", motor_hp: 40 },
    { component_type: "filter_hepa", face_area_sqft: 24 },
    { component_type: "damper_outdoor_air", face_area_sqft: 24 }
  ], "hospital");
  assert.ok(!("Other" in q.subtotals));
  assert.ok(q.subtotals["Filters"] > 0 && q.subtotals["Dampers"] > 0);
  const bomTotal = q.bom.reduce((s, i) => s + i.extended, 0);
  const subTotal = Object.values(q.subtotals).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(bomTotal - subTotal) < 0.01, "subtotals equal the BOM");
  assert.equal(q.material_cost, Math.round(bomTotal));
  assert.ok(q.sell_price > q.total_cost);
});
