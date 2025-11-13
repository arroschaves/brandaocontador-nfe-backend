const fs = require("fs");
const path = require("path");

function writeJUnit(results) {
  const tests = results.length;
  const failures = results.filter((r) => !r.success).length;
  const time = results.reduce((a, r) => a + (r.duration || 0), 0);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="Backend CI" tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">`;
  for (const r of results) {
    xml += `\n  <testcase classname="${r.classname}" name="${r.name}" time="${(r.duration || 0).toFixed(3)}">`;
    if (!r.success) xml += `\n    <failure message="${r.message || "Failure"}"></failure>`;
    xml += `\n  </testcase>`;
  }
  xml += `\n</testsuite>`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "junit.xml"), xml);
}

function main() {
  const results = [];
  const e2ePath = path.join(process.cwd(), "reports", "e2e.json");
  if (fs.existsSync(e2ePath)) {
    const e2e = JSON.parse(fs.readFileSync(e2ePath, "utf8"));
    results.push({ classname: "DFE", name: "E2E", duration: e2e.duration || 0, success: e2e.success !== false, message: e2e.error || "" });
  }
  const netPath = path.join(process.cwd(), "reports", "network.json");
  if (fs.existsSync(netPath)) {
    const net = JSON.parse(fs.readFileSync(netPath, "utf8"));
    results.push({ classname: "Network", name: "Simulation", duration: net.duration_sec || 0, success: net.fail === 0, message: `ok=${net.ok} fail=${net.fail}` });
  }
  writeJUnit(results);
}

main();
