const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let lines = fs.readFileSync(pagePath, "utf-8").split("\n");

const startIdx = lines.findIndex(l => l.includes('{!loading && activeTab === "planning" && ('));
const endIdx = lines.findIndex(l => l.includes('{!loading && activeTab === "membres" && ('));

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `      {!loading && activeTab === "planning" && (
        <PlanningTab
          canEditPlanning={canEditPlanning}
          interventions={interventions}
          tasks={tasks}
          lotLabelColors={lotLabelColors}
          openTaskModal={openTaskModal}
          openTaskDetails={openTaskDetails}
        />
      )}
`;
  lines.splice(startIdx, endIdx - startIdx, replacement);
  fs.writeFileSync(pagePath, lines.join("\n"), "utf-8");
  console.log("JSX replaced successfully");
} else {
  console.log("Could not find boundaries", startIdx, endIdx);
}
