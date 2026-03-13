const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let content = fs.readFileSync(pagePath, "utf-8");

// 1. Remove state declarations for planningView and weekStart
content = content.replace(/.*const \[planningView, setPlanningView\].*\n?/g, "");
content = content.replace(/.*const \[weekStart, setWeekStart\].*\n?/g, "");

// 2. Remove planning param effects
const paramsBlockStart = content.indexOf(`const planningDateParam = searchParams.get("planningDate");`);
if (paramsBlockStart !== -1) {
  const paramsBlockEnd = content.indexOf(`}, [activeTab, planningTaskIdParam]);`, paramsBlockStart);
  if (paramsBlockEnd !== -1) {
    const end = paramsBlockEnd + `}, [activeTab, planningTaskIdParam]);`.length;
    content = content.slice(0, paramsBlockStart) + content.slice(end);
  }
}

// 3. Remove weekDays
const weekDaysStart = content.indexOf(`const weekDays = useMemo(() => {`);
if (weekDaysStart !== -1) {
  const weekDaysEnd = content.indexOf(`}, [weekStart]);`, weekDaysStart);
  if (weekDaysEnd !== -1) {
    const end = weekDaysEnd + `}, [weekStart]);`.length;
    content = content.slice(0, weekDaysStart) + content.slice(end);
  }
}

// 4. Remove dayKeys block
const dayKeysStart = content.indexOf(`const dayKeys = useMemo(() => weekDays.map((day) => toDateKey(day)), [weekDays]);`);
if (dayKeysStart !== -1) {
  const dayKeysEnd = content.indexOf(`const todayKey = toDateKey(new Date());`, dayKeysStart);
  if (dayKeysEnd !== -1) {
    const end = dayKeysEnd + `const todayKey = toDateKey(new Date());`.length;
    content = content.slice(0, dayKeysStart) + content.slice(end);
  }
}

// 5. Remove taskSlots and timedTaskBlocks
const taskSlotsStart = content.indexOf(`const taskSlots = useMemo(() => {`);
if (taskSlotsStart !== -1) {
  const taskSlotsEndStr = `}, [tasks, dayKeys, dayKeySet]);`;
  let startIdx = taskSlotsStart;
  // There are two such ends, one for taskSlots, one for timedTaskBlocks
  const firstEnd = content.indexOf(taskSlotsEndStr, startIdx);
  if (firstEnd !== -1) {
    const secondEnd = content.indexOf(taskSlotsEndStr, firstEnd + 1);
    if (secondEnd !== -1) {
      const end = secondEnd + taskSlotsEndStr.length;
      content = content.slice(0, taskSlotsStart) + content.slice(end);
    }
  }
}

// 6. Replace the JSX Block
const jsxStart = content.indexOf(`{!loading && activeTab === "planning" && (`);
if (jsxStart !== -1) {
  const endSection = `</section>\n      )}`;
  const jsxEnd = content.indexOf(endSection, jsxStart);
  
  if (jsxEnd !== -1) {
    const end = jsxEnd + endSection.length;
    const replacement = `{!loading && activeTab === "planning" && (
        <PlanningTab
          canEditPlanning={canEditPlanning}
          interventions={interventions}
          tasks={tasks}
          lotLabelColors={lotLabelColors}
          openTaskModal={openTaskModal}
          openTaskDetails={openTaskDetails}
        />
      )}`;
      
    content = content.slice(0, jsxStart) + replacement + content.slice(end);
  } else {
    console.log("Could not find end of Planning JSX block!");
  }
} else {
    console.log("Could not find start of Planning JSX block!");
}

// 7. Add Import
if (!content.includes("import { PlanningTab }")) {
  const importLines = content.split('\n');
  importLines.splice(2, 0, `import { PlanningTab } from "@/components/project/tabs/PlanningTab";`);
  content = importLines.join('\n');
}

fs.writeFileSync(pagePath, content, "utf-8");
console.log("PlanningTab refactoring applied.");
