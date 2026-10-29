/**
 * Mermaid 렌더링. 라이브러리가 커서 처음 필요할 때 불러온다.
 * securityLevel 'strict' + 결과 SVG도 DOMPurify로 한 번 더 정화한다.
 */
import type { Mermaid } from 'mermaid';
import { sanitizeSvg } from './sanitize';

export type DiagramTheme = 'light' | 'dark';

let mermaidPromise: Promise<Mermaid> | null = null;
let initializedTheme: DiagramTheme | null = null;
let queue: Promise<unknown> = Promise.resolve();
let seq = 0;
const cache = new Map<string, string>();

async function getMermaid(theme: DiagramTheme): Promise<Mermaid> {
  const mermaid = await (mermaidPromise ??= import('mermaid').then((m) => m.default));
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      fontFamily: 'inherit',
    });
    initializedTheme = theme;
  }
  return mermaid;
}

export type MermaidResult = { svg: string } | { error: string };

/** 렌더 요청은 하나씩 순서대로 처리한다 (mermaid 전역 설정을 공유하므로) */
export function renderMermaid(code: string, theme: DiagramTheme): Promise<MermaidResult> {
  const key = `${theme}\n${code}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve({ svg: cached });

  const job = queue.then(async (): Promise<MermaidResult> => {
    const id = `mmd-${++seq}`;
    try {
      const mermaid = await getMermaid(theme);
      const { svg } = await mermaid.render(id, code);
      const clean = sanitizeSvg(svg);
      if (cache.size > 100) cache.delete(cache.keys().next().value!);
      cache.set(key, clean);
      return { svg: clean };
    } catch (err) {
      document.getElementById(`d${id}`)?.remove();
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

export function decodeMermaidCode(block: HTMLElement): string {
  return decodeURIComponent(block.dataset.code ?? '');
}

/** 컨테이너 안의 아직 그리지 않은 `.mermaid-block`들을 그린다. */
export async function renderMermaidBlocks(container: HTMLElement, theme: DiagramTheme): Promise<void> {
  const blocks = [...container.querySelectorAll<HTMLElement>('.mermaid-block')].filter(
    (b) => b.dataset.renderedTheme !== theme,
  );
  for (const block of blocks) {
    const encoded = block.dataset.code ?? '';
    block.dataset.renderedTheme = theme;
    if (!block.firstChild) block.innerHTML = '<div class="mermaid-status">다이어그램 그리는 중…</div>';
    const result = await renderMermaid(decodeMermaidCode(block), theme);
    if (block.dataset.code !== encoded) continue; // 그사이 내용이 바뀜
    if ('svg' in result) {
      block.innerHTML = result.svg;
    } else {
      const pre = document.createElement('pre');
      pre.className = 'mermaid-error';
      pre.textContent = `다이어그램 문법 오류\n${result.error}`;
      block.replaceChildren(pre);
    }
  }
}
