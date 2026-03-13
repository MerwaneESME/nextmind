const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let content = fs.readFileSync(pagePath, "utf-8");

// Remove state definitions for inviteEmail and inviteRole
content = content.replace(/.*const \[inviteEmail, setInvitéEmail\] = useState\(""\);\n?/g, "");
content = content.replace(/.*const \[inviteRole, setInvitéRole\] = useState\("client"\);\n?/g, "");

// Remove handleInvitéByEmail function block
const handleInvStart = content.indexOf(`const handleInvitéByEmail = async (event: React.FormEvent<HTMLFormElement>) => {`);
if (handleInvStart !== -1) {
  const handleInvEnd = content.indexOf(`};`, handleInvStart);
  if (handleInvEnd !== -1) {
    const end = handleInvEnd + 2;
    content = content.slice(0, handleInvStart) + content.slice(end);
  }
}

// Replace JSX block
const jsxStart = content.indexOf(`{!loading && activeTab === "membres" && (`);
if (jsxStart !== -1) {
  const endSectionStr = `</section>\n      )}`;
  const jsxEnd = content.indexOf(endSectionStr, jsxStart);
  if (jsxEnd !== -1) {
    // We add the handler onInvite directly in the JSX injection
    const replacement = `{!loading && activeTab === "membres" && (
        <MembersTab
          members={members}
          canInviteMembers={canInviteMembers}
          onInvite={async (email, role) => {
            if (!user?.id || !projectId) return;
            await inviteProjectMemberByEmail(user.id, projectId, email, role);
            await loadProject();
          }}
        />
      )}`;
    content = content.slice(0, jsxStart) + replacement + content.slice(jsxEnd + endSectionStr.length);
  }
}

// Add Import for MembersTab
if (!content.includes("import { MembersTab }")) {
  const importLines = content.split('\n');
  importLines.splice(2, 0, `import { MembersTab } from "@/components/project/tabs/MembersTab";`);
  content = importLines.join('\n');
}

fs.writeFileSync(pagePath, content, "utf-8");
console.log("MembersTab refactoring script applied.");
