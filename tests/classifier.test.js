const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

test("PEVM flow narrows the classifier to its branch instead of all roots", () => {
  const classifierTree = readJson("eskd_tree.json");
  const pevmTree = readJson("eskd_pevm_tree.json");
  const flow = readJson("question_flow.json");
  const adaptiveRules = readJson("adaptive_rules.json");

  const engineContext = {};
  const engineSource = fs.readFileSync(path.join(root, "classifier-engine.js"), "utf8");
  vm.runInNewContext(`${engineSource}\nthis.createEskdEngine = createEskdEngine;`, engineContext);

  const engine = engineContext.createEskdEngine();
  engine.loadData({ ...classifierTree, ...pevmTree }, flow, adaptiveRules);

  const pevmOption = flow.questions.assembly_domain.options.find((option) =>
    option.label.includes("ПЭВМ")
  );
  assert.ok(pevmOption, "assembly_domain should offer the PEVM option");
  assert.deepEqual(Array.from(pevmOption.branchPrefixes), ["46621"]);

  engine.applyFlowOption(pevmOption);

  const roots = engine.getRestrictedRoots();
  assert.equal(
    Array.from(roots, (node) => node.code).join(","),
    "46621",
    "a missing branch prefix would incorrectly expose all classifier roots"
  );

  const leaves = engine.getChildren(roots[0]);
  assert.equal(
    Array.from(leaves, (node) => node.code).join(","),
    "466211,466212,466213,466214,466215,466216,466219"
  );
});
