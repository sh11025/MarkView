import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import python from 'highlight.js/lib/languages/python';
import markdownLang from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import diff from 'highlight.js/lib/languages/diff';
import type { MarkdownIt as MarkdownItInstance } from 'markdown-it';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerAliases(['shell', 'zsh'], { languageName: 'bash' });
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('markdown', markdownLang);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('diff', diff);
import { mathPlugin } from './plugins/math';
import { tasksPlugin } from './plugins/tasks';
import { alertsPlugin } from './plugins/alerts';
import { emojiPlugin } from './plugins/emoji';
import { emojiCalloutPlugin } from './plugins/emojiCallout';
import { headingsPlugin, type TocItem } from './plugins/headings';
import { sourceLinesPlugin } from './plugins/sourceLines';
import { cjkEmphasisPlugin } from './plugins/cjkEmphasis';

export type { TocItem };

export interface RenderOptions {
  /** `attachment:ID` 이미지 주소를 실제 URL로 바꾼다. 아직 불러오지 않았으면 undefined */
  resolveAttachment?: (id: string) => string | undefined;
  /** 상대 경로 이미지를 실제 URL 또는 'missing'으로 바꾼다. 아직 모르면 undefined */
  resolveRelativeImage?: (src: string) => string | 'missing' | undefined;
}

export interface RenderResult {
  html: string;
  toc: TocItem[];
  /** 아직 불러오지 못한 상대 경로 이미지 목록 (중복 제거됨) */
  pendingRelativeImages: string[];
}

export const ATTACHMENT_PREFIX = 'attachment:';

interface RenderEnv {
  toc: TocItem[];
  resolveAttachment?: RenderOptions['resolveAttachment'];
  resolveRelativeImage?: RenderOptions['resolveRelativeImage'];
  pendingRelativeImages: Set<string>;
}

function isExternalOrAbsolute(src: string): boolean {
  return (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src) ||
    src.startsWith('//') ||
    src.startsWith('/') ||
    /^[a-zA-Z]:/.test(src)
  );
}

function highlight(code: string, lang: string, escape: (s: string) => string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      // 아래 기본 처리로
    }
  }
  return escape(code);
}

function createMarkdown(): MarkdownItInstance {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
  md.use(cjkEmphasisPlugin)
    .use(mathPlugin)
    .use(tasksPlugin)
    .use(alertsPlugin)
    .use(emojiPlugin)
    .use(emojiCalloutPlugin)
    .use(headingsPlugin)
    .use(sourceLinesPlugin);

  const escape = md.utils.escapeHtml;

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
    const lang = info.split(/\s+/)[0].toLowerCase();
    const lines = token.map ? ` data-line="${token.map[0]}" data-line-end="${token.map[1]}"` : '';

    if (lang === 'mermaid') {
      // DOMPurify는 `-->`가 든 속성값을 지우므로 인코딩해서 담는다 (decodeMermaidCode로 복원)
      return (
        `<div class="mermaid-wrap"${lines}>` +
        `<button type="button" class="mermaid-edit">편집</button>` +
        `<div class="mermaid-block" data-code="${encodeURIComponent(token.content)}"></div>` +
        `</div>\n`
      );
    }

    const langClass = lang ? ` language-${escape(lang)}` : '';
    return (
      `<div class="code-block"${lines}>` +
      `<div class="code-header"><span class="code-lang">${escape(lang || 'text')}</span>` +
      `<button type="button" class="code-copy">복사</button></div>` +
      `<pre><code class="hljs${langClass}">${highlight(token.content, lang, escape)}</code></pre></div>\n`
    );
  };

  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = String(token.attrGet('src') ?? '');
    const renv = env as unknown as RenderEnv;

    if (src.startsWith(ATTACHMENT_PREFIX)) {
      const id = src.slice(ATTACHMENT_PREFIX.length);
      token.attrSet('src', renv.resolveAttachment?.(id) ?? '');
      token.attrSet('data-attachment', id);
    } else if (renv.resolveRelativeImage && !isExternalOrAbsolute(src)) {
      const resolved = renv.resolveRelativeImage(src);
      if (resolved === 'missing') {
        const alt = token.content || src;
        return `<span class="img-missing" title="${escape(src)}">🖼 이미지를 찾을 수 없음: ${escape(alt)}</span>`;
      } else if (typeof resolved === 'string') {
        token.attrSet('src', resolved);
      } else {
        renv.pendingRelativeImages.add(src);
        token.attrSet('src', '');
        token.attrSet('data-rel-src', src);
        token.attrJoin('class', 'img-pending');
      }
    }

    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  return md;
}

const md = createMarkdown();

/** 마크다운 → HTML. DOM이 필요 없는 순수 함수 (정화는 sanitize.ts에서). */
export function renderMarkdown(source: string, options: RenderOptions = {}): RenderResult {
  const pendingSet = new Set<string>();
  const env: RenderEnv = {
    toc: [],
    resolveAttachment: options.resolveAttachment,
    resolveRelativeImage: options.resolveRelativeImage,
    pendingRelativeImages: pendingSet,
  };
  const html = md.render(source, env as unknown as Record<string, unknown>);
  return { html, toc: env.toc, pendingRelativeImages: [...pendingSet] };
}

/** 문서에서 참조하는 첨부 이미지 id 목록 */
export function findAttachmentIds(source: string): string[] {
  const ids = new Set<string>();
  for (const m of source.matchAll(/\(attachment:([\w-]+)(?:[\s\t]+[^)]*)?\)/g)) ids.add(m[1]);
  return [...ids];
}

export type MarkdownToken = ReturnType<MarkdownItInstance['parse']>[number];

/** markdown-it 토큰 파싱 (서식 정리 등에서 블록 줄 범위를 구할 때 사용) */
export function parseMarkdownTokens(source: string): MarkdownToken[] {
  return md.parse(source, {});
}
