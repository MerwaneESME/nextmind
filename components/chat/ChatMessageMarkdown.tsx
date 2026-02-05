"use client";

import type { ReactNode } from "react";
import { TermsSearch } from "@/components/TermsSearch";
import { BudgetSummary } from "@/components/assistant/BudgetSummary";
import { ExampleCard } from "@/components/assistant/ExampleCard";
import { MessageCard } from "@/components/assistant/MessageCard";
import { RiskWarning } from "@/components/assistant/RiskWarning";
import { TimelinePhase, type TimelinePhaseData } from "@/components/assistant/TimelinePhase";
import { formatCurrency } from "@/lib/utils";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "code"; code: string; language?: string };

type DevisTermsUiPayload = {
  query?: string;
  category?: string;
  ids?: string[];
};

type AssistantBudgetPayload = {
  ht?: number | null;
  tva?: number | null;
  ttc?: number | null;
  hint?: string;
  payments?: Array<{
    label: string;
    percent?: number;
    amount?: number;
    note?: string;
  }>;
};

type AssistantTimelinePayload = {
  title?: string;
  totalDuration?: string;
  phases?: TimelinePhaseData[];
};

type AssistantRisksPayload = {
  groups?: Array<{
    icon?: string;
    title: string;
    description?: string;
    actions?: string[];
    variant?: "info" | "warning" | "danger" | "success";
  }>;
  safetyBudget?: Array<{ label: string; value: string }>;
};

type AssistantDevisPayload = {
  totalTtc?: number | null;
  quotes?: Array<{
    id?: string;
    title: string;
    status?: string;
    totalTtc?: number | null;
    updatedAt?: string;
  }>;
};

type AssistantExamplePayload = { text?: string };

function isDevisTermsLanguage(language: string | undefined): boolean {
  const lang = (language || "").trim().toLowerCase();
  return lang === "devis-terms" || lang === "devis_terms" || lang === "btp-terms";
}

function parseDevisTermsUiPayload(code: string): DevisTermsUiPayload {
  const raw = (code || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const obj = parsed as Record<string, unknown>;
    return {
      query: typeof obj.query === "string" ? obj.query : undefined,
      category: typeof obj.category === "string" ? obj.category : undefined,
      ids: Array.isArray(obj.ids) ? obj.ids.filter((id) => typeof id === "string") : undefined,
    };
  } catch {
    return { query: raw };
  }
}

function isAssistantLanguage(language: string | undefined): boolean {
  const lang = (language || "").trim().toLowerCase();
  return (
    lang === "assistant-budget" ||
    lang === "assistant-timeline" ||
    lang === "assistant-risks" ||
    lang === "assistant-devis" ||
    lang === "assistant-example"
  );
}

function parseJsonPayload(code: string): unknown {
  const raw = (code || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function renderAssistantBlock(language: string | undefined, code: string): ReactNode | null {
  const lang = (language || "").trim().toLowerCase();
  const parsed = parseJsonPayload(code);
  if (!parsed || typeof parsed !== "object") {
    return (
      <MessageCard variant="warning" title="Réponse formatée invalide">
        Je n&apos;arrive pas à afficher ce bloc. Essayez de reformuler.
      </MessageCard>
    );
  }

  if (lang === "assistant-example") {
    const payload = parsed as AssistantExamplePayload;
    if (!payload.text) return null;
    return <ExampleCard text={payload.text} />;
  }

  if (lang === "assistant-budget") {
    const payload = parsed as AssistantBudgetPayload;
    const ttc = typeof payload.ttc === "number" ? payload.ttc : null;

    return (
      <div className="space-y-3">
        {ttc !== null ? (
          <BudgetSummary ht={payload.ht ?? null} tva={payload.tva ?? null} ttc={ttc} />
        ) : (
          <MessageCard variant="info" title="Budget">
            Ajoutez un devis lié au projet pour un total fiable.
          </MessageCard>
        )}

        {payload.hint && (
          <MessageCard variant="info" title="Résumé">
            {payload.hint}
          </MessageCard>
        )}

        {payload.payments && payload.payments.length > 0 && (
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <h4 className="font-bold text-neutral-900 mb-3">Échéancier (repère)</h4>
            <div className="space-y-2">
              {payload.payments.map((p, idx) => {
                const amount = typeof p.amount === "number" ? formatCurrency(p.amount) : null;
                const percent = typeof p.percent === "number" ? `${p.percent}%` : null;
                return (
                  <div
                    key={`${p.label}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900">{p.label}</div>
                      {(percent || p.note) && (
                        <div className="text-xs text-neutral-600">{[percent, p.note].filter(Boolean).join(" • ")}</div>
                      )}
                    </div>
                    {amount && <div className="font-bold text-neutral-900 whitespace-nowrap">{amount}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (lang === "assistant-timeline") {
    const payload = parsed as AssistantTimelinePayload;
    const phases = Array.isArray(payload.phases) ? payload.phases : [];

    return (
      <div className="space-y-3">
        {(payload.title || payload.totalDuration) && (
          <MessageCard variant="info" title={payload.title ?? "Planning"}>
            {payload.totalDuration ?? "Durée variable selon l’ampleur et les aléas."}
          </MessageCard>
        )}
        <div className="relative">
          {phases.map((phase, idx) => (
            <TimelinePhase key={`${phase.title}-${idx}`} phase={phase} index={idx} isLast={idx === phases.length - 1} />
          ))}
        </div>
      </div>
    );
  }

  if (lang === "assistant-risks") {
    const payload = parsed as AssistantRisksPayload;
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    const safetyBudget = Array.isArray(payload.safetyBudget) ? payload.safetyBudget : [];

    return (
      <div className="space-y-3">
        {groups.map((g, idx) => (
          <RiskWarning
            key={`${g.title}-${idx}`}
            icon={g.icon}
            title={g.title}
            description={g.description}
            actions={g.actions}
            variant={g.variant ?? "warning"}
          />
        ))}
        {safetyBudget.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-3">💼 À prévoir en sécurité</h4>
            <div className="space-y-2 text-sm text-blue-800">
              {safetyBudget.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="flex items-center justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (lang === "assistant-devis") {
    const payload = parsed as AssistantDevisPayload;
    const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
    const total = typeof payload.totalTtc === "number" ? payload.totalTtc : null;

    return (
      <div className="space-y-3">
        <MessageCard variant="info" title="Résumé">
          {total !== null
            ? `Total TTC (devis liés) : ${formatCurrency(total)}.`
            : "Aucun total TTC disponible. Ajoutez/liez un devis au projet pour obtenir un total."}
        </MessageCard>

        {quotes.length > 0 && (
          <div className="grid gap-2">
            {quotes.slice(0, 6).map((q, idx) => (
              <div key={`${q.title}-${idx}`} className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-900 truncate">{q.title}</div>
                    {q.status && <div className="text-xs text-neutral-500">{q.status}</div>}
                  </div>
                  {typeof q.totalTtc === "number" && (
                    <div className="font-bold text-neutral-900 whitespace-nowrap">{formatCurrency(q.totalTtc)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function isCodeFenceStart(line: string) {
  return /^\s*```/.test(line);
}

function parseCodeFenceStart(line: string): { language?: string } | null {
  const match = line.match(/^\s*```([^\s`]*)\s*$/);
  if (!match) return null;
  return { language: match[1] ? match[1] : undefined };
}

function isHeading(line: string) {
  return /^\s{0,3}#{1,6}\s+/.test(line);
}

function parseHeading(line: string): { level: HeadingLevel; text: string } | null {
  const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
  if (!match) return null;
  const level = match[1].length as HeadingLevel;
  return { level, text: match[2] };
}

function isBlockquote(line: string) {
  return /^\s*>/.test(line);
}

function parseBlockquoteLine(line: string): string {
  return line.replace(/^\s*>\s?/, "");
}

function isUnorderedListItem(line: string) {
  return /^\s*[-*]\s+/.test(line);
}

function parseUnorderedListItem(line: string): string | null {
  const match = line.match(/^\s*[-*]\s+(.*)$/);
  return match ? match[1] : null;
}

function isOrderedListItem(line: string) {
  return /^\s*\d+\.\s+/.test(line);
}

function parseOrderedListItem(line: string): string | null {
  const match = line.match(/^\s*\d+\.\s+(.*)$/);
  return match ? match[1] : null;
}

function isBlockStart(line: string) {
  return (
    isCodeFenceStart(line) ||
    isHeading(line) ||
    isBlockquote(line) ||
    isUnorderedListItem(line) ||
    isOrderedListItem(line)
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line?.trim()) {
      index += 1;
      continue;
    }

    const fenceStart = parseCodeFenceStart(line);
    if (fenceStart) {
      const language = fenceStart.language;
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !isCodeFenceStart(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && isCodeFenceStart(lines[index])) {
        index += 1;
      }
      blocks.push({ type: "code", code: codeLines.join("\n"), language });
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading.level, text: heading.text });
      index += 1;
      continue;
    }

    if (isBlockquote(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && isBlockquote(lines[index])) {
        quoteLines.push(parseBlockquoteLine(lines[index]));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    if (isUnorderedListItem(line)) {
      const items: string[] = [];
      let currentItem: string | null = null;
      while (index < lines.length) {
        const currentLine = lines[index];
        if (!currentLine?.trim()) {
          index += 1;
          continue;
        }

        const item = parseUnorderedListItem(currentLine);
        if (item !== null) {
          if (currentItem !== null) items.push(currentItem.trimEnd());
          currentItem = item;
          index += 1;
          continue;
        }

        if (/^\s+/.test(currentLine) && currentItem !== null) {
          currentItem += `\n${currentLine.trim()}`;
          index += 1;
          continue;
        }

        break;
      }

      if (currentItem !== null) items.push(currentItem.trimEnd());
      blocks.push({ type: "ul", items });
      continue;
    }

    if (isOrderedListItem(line)) {
      const items: string[] = [];
      let currentItem: string | null = null;
      while (index < lines.length) {
        const currentLine = lines[index];
        if (!currentLine?.trim()) {
          index += 1;
          continue;
        }

        const item = parseOrderedListItem(currentLine);
        if (item !== null) {
          if (currentItem !== null) items.push(currentItem.trimEnd());
          currentItem = item;
          index += 1;
          continue;
        }

        if (/^\s+/.test(currentLine) && currentItem !== null) {
          currentItem += `\n${currentLine.trim()}`;
          index += 1;
          continue;
        }

        break;
      }

      if (currentItem !== null) items.push(currentItem.trimEnd());
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index];
      if (!currentLine?.trim()) {
        index += 1;
        break;
      }
      if (isBlockStart(currentLine)) break;
      paragraphLines.push(currentLine);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks;
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return trimmed;
    return null;
  } catch {
    return null;
  }
}

function findNextInlineToken(text: string, fromIndex: number) {
  const candidates: Array<{ type: "code" | "bold" | "link"; index: number }> = [];

  const codeIndex = text.indexOf("`", fromIndex);
  if (codeIndex !== -1) candidates.push({ type: "code", index: codeIndex });

  const boldIndex = text.indexOf("**", fromIndex);
  if (boldIndex !== -1) candidates.push({ type: "bold", index: boldIndex });

  const linkIndex = text.indexOf("[", fromIndex);
  if (linkIndex !== -1) candidates.push({ type: "link", index: linkIndex });

  if (candidates.length === 0) return null;

  const priority = { code: 0, bold: 1, link: 2 } as const;
  candidates.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return priority[a.type] - priority[b.type];
  });

  return candidates[0];
}

function renderInlineMarkdown(text: string, keyPrefix = "md"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let keyIndex = 0;

  const pushText = (value: string) => {
    if (!value) return;
    nodes.push(value);
  };

  while (cursor < text.length) {
    const next = findNextInlineToken(text, cursor);
    if (!next) {
      pushText(text.slice(cursor));
      break;
    }

    if (next.index > cursor) {
      pushText(text.slice(cursor, next.index));
      cursor = next.index;
      continue;
    }

    if (next.type === "code") {
      const end = text.indexOf("`", cursor + 1);
      if (end === -1) {
        pushText(text.slice(cursor));
        break;
      }

      const code = text.slice(cursor + 1, end);
      nodes.push(
        <code
          key={`${keyPrefix}-code-${keyIndex++}`}
          className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.95em]"
        >
          {code}
        </code>
      );
      cursor = end + 1;
      continue;
    }

    if (next.type === "bold") {
      const end = text.indexOf("**", cursor + 2);
      if (end === -1) {
        pushText(text.slice(cursor, cursor + 2));
        cursor += 2;
        continue;
      }

      const inner = text.slice(cursor + 2, end);
      nodes.push(
        <strong key={`${keyPrefix}-b-${keyIndex++}`}>
          {renderInlineMarkdown(inner, `${keyPrefix}-b${keyIndex}`)}
        </strong>
      );
      cursor = end + 2;
      continue;
    }

    if (next.type === "link") {
      const closeBracket = text.indexOf("]", cursor + 1);
      if (closeBracket === -1 || closeBracket + 1 >= text.length || text[closeBracket + 1] !== "(") {
        pushText("[");
        cursor += 1;
        continue;
      }

      const closeParen = text.indexOf(")", closeBracket + 2);
      if (closeParen === -1) {
        pushText("[");
        cursor += 1;
        continue;
      }

      const linkText = text.slice(cursor + 1, closeBracket);
      const hrefRaw = text.slice(closeBracket + 2, closeParen);
      const href = sanitizeHref(hrefRaw);

      if (!href) {
        nodes.push(
          <span key={`${keyPrefix}-linktext-${keyIndex++}`}>
            {renderInlineMarkdown(linkText, `${keyPrefix}-lt${keyIndex}`)}
          </span>
        );
        cursor = closeParen + 1;
        continue;
      }

      nodes.push(
        <a
          key={`${keyPrefix}-a-${keyIndex++}`}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
          className="underline underline-offset-2"
        >
          {renderInlineMarkdown(linkText, `${keyPrefix}-a${keyIndex}`)}
        </a>
      );
      cursor = closeParen + 1;
      continue;
    }

    pushText(text[cursor]);
    cursor += 1;
  }

  return nodes;
}

function headingClassName(level: HeadingLevel) {
  switch (level) {
    case 1:
      return "text-base font-semibold";
    case 2:
      return "text-sm font-semibold";
    case 3:
      return "text-sm font-medium";
    default:
      return "text-sm font-medium";
  }
}

export function ChatMessageMarkdown({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-2 text-sm leading-relaxed break-words">
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return (
            <Tag key={`h-${blockIndex}`} className={headingClassName(block.level)}>
              {renderInlineMarkdown(block.text, `h-${blockIndex}`)}
            </Tag>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={`ul-${blockIndex}`} className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-${blockIndex}-${itemIndex}`} className="whitespace-pre-wrap">
                  {renderInlineMarkdown(item, `ul-${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={`ol-${blockIndex}`} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-${blockIndex}-${itemIndex}`} className="whitespace-pre-wrap">
                  {renderInlineMarkdown(item, `ol-${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={`bq-${blockIndex}`}
              className="border-l-2 border-black/20 pl-3 italic whitespace-pre-wrap"
            >
              {renderInlineMarkdown(block.text, `bq-${blockIndex}`)}
            </blockquote>
          );
        }

        if (block.type === "code") {
          if (isDevisTermsLanguage(block.language)) {
            const payload = parseDevisTermsUiPayload(block.code);
            return <TermsSearch key={`terms-${blockIndex}`} initialPayload={payload} />;
          }

          if (isAssistantLanguage(block.language)) {
            return (
              <div key={`assistant-${blockIndex}`} className="space-y-2">
                {renderAssistantBlock(block.language, block.code)}
              </div>
            );
          }

          return (
            <pre
              key={`code-${blockIndex}`}
              className="overflow-x-auto rounded bg-black/5 p-3 text-xs leading-relaxed whitespace-pre"
            >
              <code className="font-mono">{block.code}</code>
            </pre>
          );
        }

        return (
          <p key={`p-${blockIndex}`} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.text, `p-${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
}
