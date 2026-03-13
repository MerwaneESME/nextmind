const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let lines = fs.readFileSync(pagePath, "utf-8").split("\n");

// First remove lines 1120 to 1262 (indices 1119 to 1261)
// Wait, we need to locate by substring since lines can shift if we do multiple splices
const attachStart = lines.findIndex(l => l.includes("const handleAttachQuote = async"));
const downloadEnd = lines.findIndex((l, i) => i > attachStart && l.includes("if (quote.previewData) {"));

if (attachStart !== -1 && downloadEnd !== -1) {
  // Find the exact closing brace of handleDownloadQuote
  let endIdx = downloadEnd;
  while (!lines[endIdx].includes("};") && endIdx < lines.length) {
    endIdx++;
  }
  lines.splice(attachStart, endIdx - attachStart + 1);
  console.log("Removed handleAttachQuote to handleDownloadQuote block.");
}

// Then remove useEffect for devis
const effectStart = lines.findIndex(l => l.includes('if (activeTab === "devis") {'));
if (effectStart !== -1) {
  // It's inside a useEffect. The useEffect stats at effectStart - 1.
  if (lines[effectStart - 1].includes("useEffect(() => {")) {
    lines.splice(effectStart - 1, 5); // Remmoves useEffect until `}, [activeTab]);`
    console.log("Removed useEffect for devis logic.");
  }
}

fs.writeFileSync(pagePath, lines.join("\n"), "utf-8");
