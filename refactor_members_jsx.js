const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let lines = fs.readFileSync(pagePath, "utf-8").split("\n");

// The MembersTab block starts at line 2187 (1-indexed, so index 2186)
// The ending tag is at line 2268 (index 2267)
// Let's find dynamically by locating `{!loading && activeTab === "membres" && (`
const startIdx = lines.findIndex(l => l.includes('{!loading && activeTab === "membres" && ('));
const endIdx = lines.findIndex(l => l.includes('{!loading && activeTab === "guide" && ('));

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `      {!loading && activeTab === "membres" && (
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
  lines.splice(startIdx, endIdx - startIdx, replacement);
  fs.writeFileSync(pagePath, lines.join("\n"), "utf-8");
  console.log("MembersTab JSX replaced successfully");
} else {
  console.log("Could not find boundaries", startIdx, endIdx);
}
