/**
 * Converts AI-generated markdown analysis into plain text and PDF-friendly blocks.
 */

const MAIN_SECTION_TITLE =
  /^(resume\s*feedback|.*interview\s*questions?|career\s*roadmap|skill\s*gaps?)/i;

function isAnalysisSectionHeader(line) {
  const trimmed = String(line).trim();
  const numbered = trimmed.match(/^\d+\.\s+(.+)/);
  if (numbered) return MAIN_SECTION_TITLE.test(numbered[1]);
  const heading = trimmed.match(/^#{1,3}\s+(.+)/);
  if (heading) return MAIN_SECTION_TITLE.test(heading[1]);
  return false;
}

function isCareerRoadmapHeader(line) {
  return /career\s*roadmap/i.test(String(line).trim());
}

function stripInlineMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\*+/g, '')
    .trim();
}

function markdownToPlainText(markdown) {
  if (!markdown) return '';

  let text = String(markdown);

  // Preserve code block content without fences
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => code.trim());

  // Headings -> plain lines with spacing
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_, title) => `\n${stripInlineMarkdown(title)}\n`);

  // Bold / italic (remaining)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');

  // Bullet markers
  text = text.replace(/^\s*[\*\-]\s+/gm, '  • ');
  text = text.replace(/^\s*•\s*/gm, '  • ');

  // Numbered lists
  text = text.replace(/^(\s*)(\d+)\.\s+/gm, (_, indent, num) => `${indent}${num}. `);

  // Blockquotes
  text = text.replace(/^>\s?/gm, '');

  // Horizontal rules
  text = text.replace(/^---+$/gm, '');

  // Tree/ASCII art artifacts sometimes produced by models
  text = text.replace(/[%├└┬┴┼╔╗╚╝║─│]/g, ' ');

  // Collapse excessive whitespace
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Career roadmaps often use tables, emoji, and ASCII timelines — normalize for PDF/UI.
 */
function formatCareerRoadmapSection(text) {
  if (!text) return '';

  let t = String(text);

  // Markdown tables -> "Col A — Col B"
  t = t.replace(/^\|(.+)\|$/gm, (_, row) =>
    row
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(' — ')
  );
  t = t.replace(/^\|?[\s:|\-─—]+\|?$/gm, '');

  t = markdownToPlainText(t);

  // Emoji / decorative symbols common in roadmap output
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');

  // Drop markdown table separator rows left after conversion
  t = t
    .split('\n')
    .filter((line) => !/^[\s|:\-─—]+$/.test(line.trim()))
    .join('\n');

  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

/**
 * Strip markdown from the Career Roadmap section only; leave other sections unchanged.
 */
function normalizeAiAnalysis(markdown) {
  if (!markdown?.trim()) return '';

  const lines = markdown.split('\n');
  const parts = [];
  let buffer = [];
  let roadmapHeader = null;
  let roadmapLines = [];

  const flushBuffer = () => {
    if (buffer.length) {
      parts.push(buffer.join('\n'));
      buffer = [];
    }
  };

  const flushRoadmap = () => {
    if (roadmapHeader != null) {
      parts.push(roadmapHeader);
      parts.push(formatCareerRoadmapSection(roadmapLines.join('\n')));
      roadmapHeader = null;
      roadmapLines = [];
    }
  };

  for (const line of lines) {
    if (isCareerRoadmapHeader(line)) {
      flushBuffer();
      flushRoadmap();
      roadmapHeader = line;
      continue;
    }

    if (roadmapHeader != null && isAnalysisSectionHeader(line)) {
      flushRoadmap();
      buffer.push(line);
      continue;
    }

    if (roadmapHeader != null) {
      roadmapLines.push(line);
    } else {
      buffer.push(line);
    }
  }

  flushRoadmap();
  flushBuffer();

  return parts
    .filter((part) => part != null && String(part).trim())
    .join('\n')
    .trim();
}

/**
 * Parse markdown into sections for structured PDF rendering.
 */
function parseAiAnalysisSections(markdown) {
  if (!markdown?.trim()) {
    return [];
  }

  const lines = markdown.split('\n');
  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (current && (current.title || current.blocks.length)) {
      sections.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) continue;

    const h3 = trimmed.match(/^#{1,3}\s+(.+)/);
    const h4 = trimmed.match(/^#{4,6}\s+(.+)/);
    const mainNumbered = trimmed.match(/^(\d+)\.\s+(.+)/);

    if (h3) {
      pushCurrent();
      current = { title: stripInlineMarkdown(h3[1]), blocks: [] };
      continue;
    }

    if (mainNumbered && MAIN_SECTION_TITLE.test(mainNumbered[2])) {
      pushCurrent();
      current = { title: stripInlineMarkdown(mainNumbered[2]), blocks: [] };
      continue;
    }

    if (!current) {
      current = { title: 'AI Analysis', blocks: [] };
    }

    if (h4) {
      current.blocks.push({ type: 'subtitle', text: stripInlineMarkdown(h4[1]) });
      continue;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      current.blocks.push({
        type: 'numbered',
        number: numbered[1],
        text: stripInlineMarkdown(numbered[2]),
      });
      continue;
    }

    const bullet = trimmed.match(/^[\*\-]\s+(.+)/);
    if (bullet) {
      current.blocks.push({ type: 'bullet', text: stripInlineMarkdown(bullet[1]) });
      continue;
    }

    const inRoadmap = current?.title && /career\s*roadmap/i.test(current.title);
    current.blocks.push({
      type: 'paragraph',
      text: inRoadmap ? trimmed : stripInlineMarkdown(trimmed),
    });
  }

  pushCurrent();

  return sections.map((section) => {
    if (!/career\s*roadmap/i.test(section.title)) return section;
    return {
      ...section,
      blocks: section.blocks.map((block) => ({
        ...block,
        text: block.text ? formatCareerRoadmapSection(block.text) : block.text,
      })),
    };
  });
}

module.exports = {
  stripInlineMarkdown,
  markdownToPlainText,
  formatCareerRoadmapSection,
  normalizeAiAnalysis,
  parseAiAnalysisSections,
};
