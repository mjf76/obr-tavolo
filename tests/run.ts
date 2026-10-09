// Test delle regole pure (movimento, PF): `npm test`
import assert from "node:assert/strict";
import { applyDamage, applyHeal, applyTempHp } from "../src/shared/hp.ts";
import { formatDistance, nextDiagonalCost, pathCost, type Step } from "../src/shared/movement.ts";

const D: Step = { dx: 1, dy: 1 };
const O: Step = { dx: 1, dy: 0 };
const ft = { multiplier: 5, unit: "ft", digits: 0 };
const m = { multiplier: 1.5, unit: "m", digits: 1 };

const cases: [string, () => void][] = [
  ["5-10-5: tre diagonali = 4 caselle (20 ft)", () => assert.equal(pathCost([D, D, D], "ALTERNATING"), 4)],
  ["5-10-5: ortogonali non contano per l'alternanza", () => assert.equal(pathCost([D, O, D], "ALTERNATING"), 4)],
  ["5-10-5: prossima diagonale dopo una = 2", () => assert.equal(nextDiagonalCost([D], "ALTERNATING"), 2)],
  ["5-10-5: prossima diagonale dopo due = 1", () => assert.equal(nextDiagonalCost([D, D], "ALTERNATING"), 1)],
  ["Chebyshev: diagonale = 1", () => assert.equal(pathCost([D, D, D], "CHEBYSHEV"), 3)],
  ["Manhattan: diagonale = 2", () => assert.equal(pathCost([D, O], "MANHATTAN"), 3)],
  ["avanti e indietro consuma movimento", () =>
    assert.equal(pathCost([O, { dx: -1, dy: 0 }], "ALTERNATING"), 2)],
  ["formato ft → anche metri", () => assert.equal(formatDistance(4, ft), "20 ft · 6 m")],
  ["formato m → anche piedi", () => assert.equal(formatDistance(3, m), "15 ft · 4,5 m")],
  ["danno: prima i PF temporanei", () =>
    assert.deepEqual(applyDamage({ hp: 12, maxHp: 27, tempHp: 5, ac: 16 }, 8), { hp: 9, maxHp: 27, tempHp: 0, ac: 16 })],
  ["danno: PF non sotto zero", () => assert.equal(applyDamage({ hp: 3, maxHp: 10, tempHp: 0, ac: 10 }, 20).hp, 0)],
  ["cura: non oltre il massimo", () => assert.equal(applyHeal({ hp: 8, maxHp: 10, tempHp: 0, ac: 10 }, 9).hp, 10)],
  ["PF temp: non si sommano, vince il più alto", () =>
    assert.equal(applyTempHp({ hp: 8, maxHp: 10, tempHp: 6, ac: 10 }, 4).tempHp, 6)],
];

let fail = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log("✓", name);
  } catch (e) {
    fail++;
    console.log("✗", name, "\n ", (e as Error).message);
  }
}
console.log(fail ? `\n${fail} test falliti` : `\nTutti i ${cases.length} test superati`);
process.exit(fail ? 1 : 0);
