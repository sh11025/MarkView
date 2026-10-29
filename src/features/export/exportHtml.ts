/**
 * 완전히 자체 포함된 HTML 만들기: 문서 스타일·KaTeX 글꼴·첨부 이미지·Mermaid SVG를 모두 파일 안에 넣는다.
 * 그래서 인터넷이 없는 PC에서도 그대로 보인다.
 */
import documentCss from '../../styles/document.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';
import { renderMarkdown } from '../../render/markdown';
import { sanitizeHtml } from '../../render/sanitize';
import { loadExtendedEmojis } from '../../constants/emojiCore';
import { decodeMermaidCode, renderMermaid, type DiagramTheme } from '../../render/mermaid';
import { getAttachmentBlob } from '../../storage/attachments';
import { resolveRelativePath } from '../folder/path';
import { readFileByPath, type DirectoryHandleLike } from '../../storage/folder';

export interface FolderExportContext {
  folderPath?: string;
  folderHandle?: DirectoryHandleLike | null;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 상대 경로 문서 링크의 <a> 태그를 비활성화하고 텍스트 내용만 남긴다 */
export function deactivateRelativeLinks(container: HTMLElement): void {
  for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#') || /^(https?:|mailto:)/i.test(href)) continue;
    const span = document.createElement('span');
    span.innerHTML = a.innerHTML;
    a.replaceWith(span);
  }
}

/** 상대 경로 이미지를 읽어 data URL로 변환하여 인라인 처리한다 */
export async function inlineRelativeImages(
  container: HTMLElement,
  context?: FolderExportContext,
): Promise<void> {
  for (const img of container.querySelectorAll<HTMLImageElement>('img[data-rel-src]')) {
    const relSrc = img.dataset.relSrc!;
    let inlined = false;

    if (context?.folderPath && context?.folderHandle) {
      const resolved = resolveRelativePath(context.folderPath, relSrc);
      if (resolved.ok) {
        const file = await readFileByPath(context.folderHandle, resolved.path);
        if (file) {
          img.src = await blobToDataUrl(file);
          img.removeAttribute('data-rel-src');
          img.classList.remove('img-pending');
          inlined = true;
        }
      }
    }

    if (!inlined) {
      const span = document.createElement('span');
      span.className = 'img-missing';
      span.textContent = `(이미지를 포함하지 못했습니다: ${relSrc})`;
      img.replaceWith(span);
    }
  }
}

/** KaTeX CSS의 글꼴을 woff2만 남기고 data URL로 바꾼다. */
async function inlineKatexFonts(css: string): Promise<string> {
  // data URL 또는 일반 파일 경로의 woff, ttf fallback 제거하여 woff2만 유지
  const withoutFallbacks = css.replace(/,\s*url\([^)]*?(?:\.woff|\.ttf|data:font\/woff|data:font\/ttf)[^)]*?\)\s*format\("(?:woff|truetype)"\)/gi, '');
  const urls = [...new Set([...withoutFallbacks.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]))];
  let out = withoutFallbacks;
  for (const raw of urls) {
    const url = raw.replace(/^["']|["']$/g, '');
    if (url.startsWith('data:')) continue; // 이미 data URL로 인라인되어 있으면 건너뜀
    try {
      const res = await fetch(new URL(url, document.baseURI));
      if (!res.ok) continue;
      out = out.split(raw).join(`"${await blobToDataUrl(await res.blob())}"`);
    } catch {
      // 글꼴을 못 넣어도 수식은 시스템 글꼴로 표시된다
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export async function buildStandaloneHtml(
  source: string,
  title: string,
  theme: DiagramTheme,
  folderContext?: FolderExportContext,
): Promise<string> {
  if (source.includes(':')) {
    await loadExtendedEmojis();
  }
  const container = document.createElement('div');
  container.innerHTML = sanitizeHtml(
    renderMarkdown(source, {
      resolveRelativeImage: () => undefined, // pending 상태로 data-rel-src 부착 유도
    }).html,
  );

  container.querySelectorAll('.code-copy, .mermaid-edit').forEach((el) => el.remove());

  // 1. 첨부 이미지 인라인
  for (const img of container.querySelectorAll<HTMLImageElement>('img[data-attachment]')) {
    const blob = await getAttachmentBlob(img.dataset.attachment!);
    if (blob) img.src = await blobToDataUrl(blob);
    img.removeAttribute('data-attachment');
  }

  // 2. 상대 경로 이미지 인라인
  await inlineRelativeImages(container, folderContext);

  // 3. 상대 경로 문서 링크 비활성화 (글자만 남김)
  deactivateRelativeLinks(container);

  for (const block of container.querySelectorAll<HTMLElement>('.mermaid-block')) {
    const result = await renderMermaid(decodeMermaidCode(block), theme);
    if ('svg' in result) block.innerHTML = result.svg;
    else block.innerHTML = `<pre class="mermaid-error">${escapeHtml(result.error)}</pre>`;
    block.removeAttribute('data-code');
  }

  const hasMath = container.querySelector('.katex') !== null;
  const css = [documentCss, hasMath ? await inlineKatexFonts(katexCss) : ''].join('\n').replace(/<\/style/gi, '<\\/style');

  return `<!doctype html>
<html lang="ko" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MarkView">
<title>${escapeHtml(title)}</title>
<style>
${css}
body { margin: 0; background: var(--doc-bg); }
.markdown-body { max-width: 860px; margin: 0 auto; padding: 40px 24px; }
</style>
</head>
<body>
<main class="markdown-body">
${container.innerHTML}
</main>
</body>
</html>
`;
}
