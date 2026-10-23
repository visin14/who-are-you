import test from "node:test";
import assert from "node:assert/strict";
import { calculateArchetype, buildPrompt, questions, ARCHETYPE_CODES } from "./config.js";

test("clear winner", () => {
  assert.equal(calculateArchetype(["E", "E", "E", "R", "S", "L"]), "E");
});
test("two-way tie resolves to most recent among tied", () => {
  assert.equal(calculateArchetype(["E", "R", "E", "R", "S", "L"]), "R");
  assert.equal(calculateArchetype(["R", "E", "R", "E", "S", "L"]), "E");
});
test("three-way tie", () => {
  assert.equal(calculateArchetype(["E", "R", "S", "E", "R", "S"]), "S");
});
test("all different resolves to the last answer", () => {
  assert.equal(calculateArchetype(["E", "R", "S", "L", "A", "M"]), "M");
});
test("deterministic", () => {
  const a = ["A", "M", "A", "M", "L", "S"];
  assert.equal(calculateArchetype(a), calculateArchetype([...a]));
});
test("each archetype appears exactly 4 times in the quiz", () => {
  const counts = {};
  for (const q of questions) for (const o of q.options) counts[o.archetype] = (counts[o.archetype] || 0) + 1;
  for (const c of ARCHETYPE_CODES) assert.equal(counts[c], 4);
});
test("buildPrompt includes scene", () => {
  assert.match(buildPrompt("M"), /enchanted forest/);
});
