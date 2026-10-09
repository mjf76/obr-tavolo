// Test delle regole pure (movimento, PF): `npm test`
import assert from "node:assert/strict";
import { applyDamage, applyHeal, applyTempHp } from "../src/shared/hp.ts";
import { parse, roll, doubleDice } from "../src/sheet/dice.ts";
import { attackBonus, attackDamage, initiative, passivePerception, profBonus, saveBonus, skillBonus, spellDC, validatePg } from "../src/sheet/derive.ts";
import type { PgSheet } from "../src/sheet/types.ts";
import { readFileSync } from "node:fs";
import { lightFor, parseDarkvisionFt } from "../src/shared/visionRules.ts";
import { formatDistance, nextDiagonalCost, pathCost, type Step } from "../src/shared/movement.ts";

const D: Step = { dx: 1, dy: 1 };
const O: Step = { dx: 1, dy: 0 };
const ft = { multiplier: 5, unit: "ft", digits: 0 };
const m = { multiplier: 1.5, unit: "m", digits: 1 };

const bran = JSON.parse(readFileSync(new URL("../examples/pg-esempio-guerriero.json", import.meta.url), "utf8")) as PgSheet;
const ilsa = JSON.parse(readFileSync(new URL("../examples/pg-esempio-mago.json", import.meta.url), "utf8")) as PgSheet;
let seq: number[] = [];
const rng = () => (seq.shift() ?? 0) ;

const cases: [string, () => void][] = [
  ["dadi: parse valido/non valido", () => { assert.ok(parse("2d6+3")); assert.equal(parse("2d6+x"), null); }],
  ["dadi: 1d20+5 con dado 14", () => { seq = [13 / 20]; assert.equal(roll("1d20+5", "normale", rng)!.total, 19); }],
  ["dadi: vantaggio tiene il più alto", () => { seq = [2 / 20, 16 / 20]; const r = roll("1d20+1", "vantaggio", rng)!; assert.equal(r.total, 18); assert.equal(r.natural, 17); }],
  ["dadi: 20 naturale = critico", () => { seq = [19.5 / 20]; assert.equal(roll("1d20+3", "normale", rng)!.crit, true); }],
  ["dadi: critico raddoppia i dadi", () => assert.equal(doubleDice("1d8+3+2d6"), "2d8+3+4d6")],
  ["scheda: esempi validi", () => { assert.deepEqual(validatePg(bran), []); assert.deepEqual(validatePg(ilsa), []); }],
  ["scheda: competenza liv. 3 = +2, liv. 5 = +3", () => { assert.equal(profBonus(3), 2); assert.equal(profBonus(5), 3); }],
  ["Bran: TS Forza +5, Atletica +5, Percezione passiva 13", () => {
    assert.equal(saveBonus(bran, "for"), 5); assert.equal(skillBonus(bran, "atletica"), 5); assert.equal(passivePerception(bran), 13); }],
  ["Bran: spada lunga +5, 1d8+3", () => {
    assert.equal(attackBonus(bran, bran.attacchi[0]), 5); assert.deepEqual(attackDamage(bran, bran.attacchi[0]), [{ expr: "1d8+3", tipo: "Tagliente" }]); }],
  ["Ilsa: CD incantesimi 13, iniziativa +2", () => { assert.equal(spellDC(ilsa), 13); assert.equal(initiative(ilsa), 2); }],
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
  ["scurovisione in metri", () => assert.equal(parseDarkvisionFt("Scurovisione 18 m"), 60)],
  ["scurovisione in piedi", () => assert.equal(parseDarkvisionFt("Darkvision 120 ft., Passive Perception 12"), 120)],
  ["nessuna scurovisione", () => assert.equal(parseDarkvisionFt("Nessuna scurovisione"), 0)],
  ["buio: scurovisione 60 ft = 12 caselle", () => assert.equal(lightFor(60, "", "buio", 150).attenuationRadius, 12 * 150 + 75)],
  ["buio: torcia batte niente scurovisione", () => assert.equal(lightFor(0, "torcia", "buio", 100).attenuationRadius, 8 * 100 + 50)],
  ["buio: senza nulla, una casella", () => assert.equal(lightFor(0, "", "buio", 100).attenuationRadius, 150)],
  ["occhio di bue: cono", () => assert.equal(lightFor(60, "occhiodibue", "buio", 100).outerAngle, 60)],
  ["illuminata: raggio ampio, cerchio", () => assert.equal(lightFor(0, "occhiodibue", "luce", 100).outerAngle, 360)],
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
