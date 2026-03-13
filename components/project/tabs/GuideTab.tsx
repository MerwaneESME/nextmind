import { ProjectGuidePanel } from "@/components/guide/ProjectGuidePanel";
import type { QuoteSummary } from "@/lib/quotesStore";

export interface GuideTabProps {
  guideSectionParam: string | null;
  guideQueryParam: string | null;
  guideTermParam: string | null;
  openGuide: (section?: string, patch?: Record<string, string | null | undefined>) => void;
  openAssistantTab: () => void;
  totalBudget: number;
  hasBudget: boolean;
  quotes: QuoteSummary[];
  projectType: string | null;
}

export function GuideTab({
  guideSectionParam,
  guideQueryParam,
  guideTermParam,
  openGuide,
  openAssistantTab,
  totalBudget,
  hasBudget,
  quotes,
  projectType,
}: GuideTabProps) {
  return (
    <section className="space-y-6">
      <ProjectGuidePanel
        section={guideSectionParam}
        query={guideQueryParam}
        term={guideTermParam}
        onOpenGuide={openGuide}
        onOpenAssistant={openAssistantTab}
        totalBudget={totalBudget}
        hasBudget={hasBudget}
        quotes={quotes}
        projectType={projectType}
      />
    </section>
  );
}
