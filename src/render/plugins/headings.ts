import type { MarkdownIt } from 'markdown-it';

export interface TocItem {
  id: string;
  text: string;
  level: number;
  /** 원문 줄 번호 (0부터) */
  line: number;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** 제목에 고유 id를 붙이고 env.toc에 목차를 모은다. */
export function headingsPlugin(md: MarkdownIt): void {
  md.core.ruler.push('heading_ids', (state) => {
    const toc: TocItem[] = [];
    const used = new Map<string, number>();
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length - 1; i++) {
      const open = tokens[i];
      if (open.type !== 'heading_open') continue;
      const text = (tokens[i + 1].children ?? [])
        .filter((t) => t.type === 'text' || t.type === 'code_inline' || t.type === 'math_inline')
        .map((t) => t.content)
        .join('')
        .trim();

      const base = slugify(text) || 'section';
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;

      open.attrSet('id', id);
      toc.push({ id, text, level: Number(open.tag.slice(1)), line: open.map?.[0] ?? 0 });
    }

    state.env.toc = toc;
  });
}
