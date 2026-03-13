const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/dashboard/projets/[id]/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const deleteLines = (start, end) => {
  for (let i = start; i <= end; i++) {
    lines[i] = null;
  }
};

// 1. Assistant state
const stateStart = lines.findIndex(l => l && l.includes('const getAssistantIntro ='));
const stateEnd = lines.findIndex(l => l && l.includes('const pendingLegacyTasks = pendingProposal?.tasks ?? []'));
if (stateStart !== -1 && stateEnd !== -1) deleteLines(stateStart, stateEnd);

// 2. useEffects for assistant
const effect1Start = lines.findIndex(l => l && l.includes('if (activeTab !== "assistant") return;'));
if (effect1Start !== -1) {
    const effect1End = lines.findIndex((l, i) => i > effect1Start && l && l.includes('}, [activeTab]);'));
    if (effect1End !== -1) deleteLines(effect1Start - 1, effect1End); 
}

const effect2Start = lines.findIndex((l, i) => i > effect1Start && l && l.includes('if (activeTab !== "assistant") return;'));
if (effect2Start !== -1) {
    const effect2End = lines.findIndex((l, i) => i > effect2Start && l && l.includes('}, [assistantLoading, assistantMessages.length, activeTab]);'));
    if (effect2End !== -1) deleteLines(effect2Start - 1, effect2End);
}

const effect3Start = lines.findIndex(l => l && l.includes('setAssistantMessages((prev) => {'));
if (effect3Start !== -1) {
    const effect3End = lines.findIndex((l, i) => i > effect3Start && l && l.includes('}, [userRole]);'));
    if (effect3End !== -1) deleteLines(effect3Start - 1, effect3End);
}

// 3. buildAssistantTaskDescription to assistantActionButtons
const buildTaskStart = lines.findIndex(l => l && l.includes('const buildAssistantTaskDescription = (task: AssistantTask) => {'));
const actionBtnEnd = lines.findIndex((l, i) => i > buildTaskStart && l && l.includes('}, [assistantLoading, sendAssistantMessage, userRole]);'));
if (buildTaskStart !== -1 && actionBtnEnd !== -1) {
    deleteLines(buildTaskStart, actionBtnEnd);
}

// 4. JSX block
const jsxStart = lines.findIndex(l => l && l.includes('{!loading && activeTab === "assistant" && ('));
const jsxEnd = lines.findIndex((l, i) => i > jsxStart && l && l.includes('</section>'));
if (jsxStart !== -1 && jsxEnd !== -1) {
    deleteLines(jsxStart, jsxEnd + 1);
    lines[jsxStart] = `
      {!loading && activeTab === "assistant" && (
        <AssistantTab
          projectId={projectId}
          user={user}
          userRole={userRole}
          project={project}
          totalBudget={totalBudget}
          quotes={quotes}
          canUseAssistantPlanning={canUseAssistantPlanning}
          loadProject={loadProject}
          contextPhaseId={contextPhaseId}
          contextLotId={contextLotId}
          openGuide={openGuide}
        />
      )}
    `;
}

// 5. Add import at the top
const importLine = `import { AssistantTab } from "@/components/project/tabs/AssistantTab";`;
if (!lines.slice(0, 20).some(l => l && l.includes('AssistantTab'))) {
    lines.splice(2, 0, importLine);
}

const newContent = lines.filter(l => l !== null).join('\n');
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('Successfully refactored page.tsx for AssistantTab');
