"use client";

import type { ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "code"; code: string; language?: string };

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
