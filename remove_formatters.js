const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let lines = fs.readFileSync(pagePath, "utf-8").split("\n");

const startIdx = lines.findIndex(l => l.includes("const formatMemberRole = (role?: string | null)"));
const endIdx = lines.findIndex(l => l.includes("const TASK_STATUS_OPTIONS = ["));

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx);
  console.log("formatMemberRole and formatMemberStatus removed.");
} else {
  console.log("Could not find formatMemberRole boundaries.");
}

// Add import for member helpers if missing
if (!lines.some(l => l.includes("from \"@/lib/memberHelpers\""))) {
  // Find a good spot to insert imports
  const importIdx = lines.findIndex(l => l.includes("import { supabase }"));
  if (importIdx !== -1) {
    lines.splice(importIdx + 1, 0, 'import { formatMemberRole, formatMemberStatus } from "@/lib/memberHelpers";');
  }
}

fs.writeFileSync(pagePath, lines.join("\n"), "utf-8");
