const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let content = fs.readFileSync(pagePath, "utf-8");

// Imports to add
const importStr = `import { OverviewTab } from "@/components/project/tabs/OverviewTab";\n`;
if (!content.includes("import { OverviewTab }")) {
  const lines = content.split('\n');
  lines.splice(2, 0, importStr.trim());
  content = lines.join('\n');
}

// Remove normalizeProjectStatus
content = content.replace(/const normalizeProjectStatus = \(status: string \| null\) => {[\s\S]*?};\n?/, "");

// Remove upcomingInterventions, upcomingTasks, upcomingItems
const removeUseMemo = (name) => {
  const startExpr = `const ${name} = useMemo(() => {`;
  const startIdx = content.indexOf(startExpr);
  if (startIdx !== -1) {
    // Find matching ending brace
    let brackets = 0;
    let endIdx = startIdx;
    let foundStart = false;
    while (endIdx < content.length) {
      if (content[endIdx] === '{') { brackets++; foundStart = true; }
      else if (content[endIdx] === '}') { brackets--; }
      
      if (foundStart && brackets === 0) {
        // Find next `}, [deps]);` or similar
        const nextReturnChar = content.indexOf('\n', endIdx);
        endIdx = nextReturnChar;
        break;
      }
      endIdx++;
    }
    content = content.slice(0, startIdx) + content.slice(endIdx + 1);
  }
};
removeUseMemo("upcomingTasks");
removeUseMemo("upcomingInterventions");
removeUseMemo("upcomingItems");
removeUseMemo("statusCardColorClass");
removeUseMemo("lateTasks");

// Remove handleUpdateProjectStatus
content = content.replace(/const handleUpdateProjectStatus = async \(nextStatus: ProjectStatusValue\) => {[\s\S]*?};\n?/, "");

// Remove projectStatusValue local state
content = content.replace(/const \[projectStatusValue, setProjectStatusValue\] = useState<ProjectStatusValue>\(normalizeProjectStatus\(project\?.status \?\? null\)\);\n?/, "");
content = content.replace(/useEffect\(\(\) => {\n    setProjectStatusValue\(normalizeProjectStatus\(project\?.status \?\? null\)\);\n  }, \[projectStatusValue, project\]\);\n?/g, "");

// We will do a generic replacement of the overview tab JSX
const startJsx = `{!loading && activeTab === "overview" && (`;
const renderOverviewTabJSX = `{!loading && activeTab === "overview" && (
        <OverviewTab
          projectId={projectId}
          project={project}
          role={role}
          members={members}
          tasks={tasks}
          interventions={interventions}
          interventionsLoading={interventionsLoading}
          totalTasks={totalTasks}
          completedTasks={completedTasks}
          progressPercent={progressPercent}
          hasBudget={hasBudget}
          totalBudget={totalBudget}
          interventionsBudgetActual={interventionsBudgetActual}
          canManageProject={canManageProject}
          onTabChange={(tab) => {
            setActiveTab(tab);
            updateQuery({ tab });
          }}
          openEditInfoModal={openEditInfoModal}
          openCreateInterventionModal={openCreateInterventionModal}
          setRendezVousModalOpen={setRendezVousModalOpen}
          loadProject={loadProject}
          setError={setError}
          PROJECT_STATUS_OPTIONS={PROJECT_STATUS_OPTIONS}
        />
      )}`;

const sIdx = content.indexOf(startJsx);

if (sIdx !== -1) {
  // Finds the closing parenthesis of {!loading && activeTab === "overview" && (...)}
  // The jsx block ends right before `{!loading && activeTab === "interventions" && (` or similar
  const endMarker = `{!loading && activeTab === "interventions" && (`
  const eIdx = content.indexOf(endMarker);
  if (eIdx !== -1) {
    content = content.slice(0, sIdx) + renderOverviewTabJSX + "\n\n      " + content.slice(eIdx);
  }
}

fs.writeFileSync(pagePath, content, "utf-8");
console.log("OverviewTab node replacement matched.");
