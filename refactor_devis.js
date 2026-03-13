const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "app", "dashboard", "projets", "[id]", "page.tsx");
let content = fs.readFileSync(pagePath, "utf-8");

// Remove state declarations
content = content.replace(/.*const \[availableQuotes, setAvailableQuotes\] = useState.*\n?/g, "");
content = content.replace(/.*const \[selectedQuoteId, setSelectedQuoteId\] = useState.*\n?/g, "");
content = content.replace(/.*const \[quoteStatusUpdatingId, setQuoteStatusUpdatingId\] = useState.*\n?/g, "");
content = content.replace(/.*const \[quoteDeletingId, setQuoteDeletingId\] = useState.*\n?/g, "");

// Remove loadAvailableQuotes
const loadStart = content.indexOf(`const loadAvailableQuotes = async () => {`);
if (loadStart !== -1) {
  const loadEnd = content.indexOf(`};`, loadStart) + 2;
  content = content.slice(0, loadStart) + content.slice(loadEnd);
}

// Remove useEffect for loadAvailableQuotes
const effectStart = content.indexOf(`useEffect(() => {\n    if (activeTab === "devis") {\n      void loadAvailableQuotes();\n    }\n  }, [activeTab]);`);
if (effectStart !== -1) {
  content = content.slice(0, effectStart) + content.slice(effectStart + `useEffect(() => {\n    if (activeTab === "devis") {\n      void loadAvailableQuotes();\n    }\n  }, [activeTab]);`.length);
}

// Remove handleAttachQuote
const attachStart = content.indexOf(`const handleAttachQuote = async (quoteIdOverride?: string) => {`);
if (attachStart !== -1) {
  const attachEndStr = `}
        })
        .catch(() => {/* silencieux */});
    }
  };`;
  const attachEnd = content.indexOf(attachEndStr, attachStart);
  if (attachEnd !== -1) {
    content = content.slice(0, attachStart) + content.slice(attachEnd + attachEndStr.length);
  }
}

// Remove handleUpdateQuoteWorkflow
const updateStart = content.indexOf(`const handleUpdateQuoteWorkflow = async (quote: QuoteSummary, nextStatus: WorkflowStatus) => {`);
if (updateStart !== -1) {
  const updateEndStr = `} finally {
      setQuoteStatusUpdatingId(null);
    }
  };`;
  const updateEnd = content.indexOf(updateEndStr, updateStart);
  if (updateEnd !== -1) {
    content = content.slice(0, updateStart) + content.slice(updateEnd + updateEndStr.length);
  }
}

// Remove handleDeleteQuote
const deleteStart = content.indexOf(`const handleDeleteQuote = async (quote: QuoteSummary) => {`);
if (deleteStart !== -1) {
  const deleteEndStr = `} finally {
      setQuoteDeletingId(null);
    }
  };`;
  const deleteEnd = content.indexOf(deleteEndStr, deleteStart);
  if (deleteEnd !== -1) {
    content = content.slice(0, deleteStart) + content.slice(deleteEnd + deleteEndStr.length);
  }
}

// Remove handleViewQuote
const viewStart = content.indexOf(`const handleViewQuote = (quote: QuoteSummary) => {`);
if (viewStart !== -1) {
  const viewEndStr = `};`;
  const viewEnd = content.indexOf(viewEndStr, viewStart);
  if (viewEnd !== -1) {
    content = content.slice(0, viewStart) + content.slice(viewEnd + viewEndStr.length);
  }
}

// Remove normalizeStoragePath
const normStart = content.indexOf(`const normalizeStoragePath = (bucket?: string, path?: string) => {`);
if (normStart !== -1) {
  const normEndStr = `};`;
  const normEnd = content.indexOf(normEndStr, normStart);
  if (normEnd !== -1) {
    content = content.slice(0, normStart) + content.slice(normEnd + normEndStr.length);
  }
}

// Remove handleDownloadQuote
const downloadStart = content.indexOf(`const handleDownloadQuote = async (quote: QuoteSummary) => {`);
if (downloadStart !== -1) {
  const downloadEndStr = `}
    }
  };`;
  const downloadEnd = content.indexOf(downloadEndStr, downloadStart);
  if (downloadEnd !== -1) {
    content = content.slice(0, downloadStart) + content.slice(downloadEnd + downloadEndStr.length);
  }
}

// Replace JSX block
const jsxStart = content.indexOf(`{!loading && activeTab === "devis" && (`);
if (jsxStart !== -1) {
  const jsxEndStr = `/>
      )}`;
  const jsxEnd = content.indexOf(jsxEndStr, jsxStart);
  if (jsxEnd !== -1) {
    const replacement = `{!loading && activeTab === "devis" && (
        <DevisTab
          projectId={projectId}
          user={user}
          role={role}
          canManageProject={canManageProject}
          canEditQuotes={canEditQuotes}
          quotes={quotes}
          loadProject={loadProject}
          onError={setError}
          setQuotes={setQuotes}
        />
      )}`;
    content = content.slice(0, jsxStart) + replacement + content.slice(jsxEnd + jsxEndStr.length);
  }
}

// Add Imports
if (!content.includes("import { DevisTab }")) {
  const importLines = content.split('\n');
  importLines.splice(2, 0, `import { DevisTab } from "@/components/project/tabs/DevisTab";`);
  content = importLines.join('\n');
}

fs.writeFileSync(pagePath, content, "utf-8");
console.log("DevisTab refactoring applied.");
