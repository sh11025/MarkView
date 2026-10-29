import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 4199;
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8',
};

function serveFile(res: http.ServerResponse, filePath: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback: index.html
    const indexPath = path.join(DIST_DIR, 'index.html');
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': content.length,
    });
    res.end(content);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  const headers: Record<string, string | number> = {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Access-Control-Allow-Origin': '*',
  };

  if (filePath.endsWith('sw.js')) {
    headers['Service-Worker-Allowed'] = '/';
  }

  res.writeHead(200, headers);
  res.end(content);
}

let server: http.Server;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(parsed.pathname);

    // 하위 경로 (/markview-test/) 지원
    if (pathname.startsWith('/markview-test/')) {
      pathname = pathname.slice('/markview-test'.length);
    } else if (pathname === '/markview-test') {
      res.writeHead(301, { Location: '/markview-test/' });
      res.end();
      return;
    }

    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const safePath = path.normalize(path.join(DIST_DIR, pathname));
    if (!safePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    serveFile(res, safePath);
  });

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test.describe('배포 점검 — 하위 경로 호환 & 오프라인 PWA 동작 검증', () => {
  test('D1. 하위 경로(/markview-test/) 서빙: 404 없이 모든 리소스 로드 및 초기 렌더링 확인', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });

    const responses404: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404) {
        responses404.push(res.url());
      }
    });

    await page.goto(`http://localhost:${PORT}/markview-test/`);

    // 에디터와 제목 로드 확인
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    await expect(editor).toContainText('MarkView 시작하기');

    // 수식(KaTeX) 렌더링 확인
    const katexEl = page.locator('.markdown-body .katex');
    await expect(katexEl.first()).toBeVisible({ timeout: 10000 });

    // 다이어그램(Mermaid SVG) 렌더링 확인
    const mermaidSvg = page.locator('.markdown-body .mermaid-block svg');
    await expect(mermaidSvg.first()).toBeVisible({ timeout: 15000 });

    // 404 및 실패한 요청 0건 검증
    expect(responses404).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('D2. 루트 경로(/) 서빙: 404 없이 모든 리소스 로드 및 서비스 워커 등록 확인', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });

    await page.goto(`http://localhost:${PORT}/`);

    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    await expect(editor).toContainText('MarkView 시작하기');

    // manifest 링크 확인
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toContain('manifest.webmanifest');

    expect(failedRequests).toEqual([]);
  });

  test('D3. 오프라인 동작: 1회 로드 후 네트워크 차단 상태에서 새로고침 및 전체 기능 정상 동작 검증', async ({ page, context }) => {
    // 1. 하위 경로로 접속
    await page.goto(`http://localhost:${PORT}/markview-test/`);
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // 서비스 워커 등록 및 활성화 대기
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg && !!reg.active;
    }, { timeout: 15000 });

    // 캐시 저장 완료를 위한 잠시 대기
    await page.waitForTimeout(1000);

    // 2. 외부 요청 감시 설정
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(`http://localhost:${PORT}`)) {
        externalRequests.push(url);
      }
    });

    // 3. 브라우저 네트워크를 완전 오프라인으로 전환
    await context.setOffline(true);

    // 4. 오프라인 상태에서 페이지 새로고침
    await page.reload();

    // 5. 오프라인 새로고침 후에도 앱이 정상 로드되는지 검증
    await expect(editor).toBeVisible({ timeout: 10000 });
    await expect(editor).toContainText('MarkView 시작하기');

    // 6. 오프라인에서 수식(KaTeX) 정상 렌더링
    const katexEl = page.locator('.markdown-body .katex');
    await expect(katexEl.first()).toBeVisible({ timeout: 10000 });

    // 7. 오프라인에서 Mermaid 다이어그램 정상 렌더링
    const mermaidWrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(mermaidWrap).toBeVisible({ timeout: 15000 });
    const mermaidSvg = mermaidWrap.locator('.mermaid-block svg');
    await expect(mermaidSvg).toBeVisible({ timeout: 15000 });

    // 8. 오프라인에서 체크박스 상호작용
    const uncheckedBox = page.locator('.markdown-body .task-checkbox').nth(1);
    await expect(uncheckedBox).not.toBeChecked();
    await uncheckedBox.click();
    await expect(page.locator('.cm-line', { hasText: '- [x] 표의 칸을' })).toBeVisible();

    // 9. 오프라인에서 템플릿 갤러리 열기
    await page.locator('button[title="템플릿"]').click();
    const templateModal = page.locator('div[role="dialog"][aria-label="문서 템플릿 갤러리"]');
    await expect(templateModal).toBeVisible();
    await expect(templateModal).toContainText('문서 템플릿');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 10. 오프라인에서 수식 갤러리 열기
    const mathBtn = page.locator('button[title="수식 삽입"]');
    await expect(mathBtn).toBeVisible();
    await mathBtn.click();

    const mathModal = page.locator('div[role="dialog"][aria-label="수식 템플릿 갤러리"]');
    await expect(mathModal).toBeVisible();
    await expect(mathModal).toContainText('수식 삽입 갤러리');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 11. 오프라인에서 다이어그램 갤러리 열기
    const diagramBtn = page.locator('button[title="다이어그램 삽입"]');
    await expect(diagramBtn).toBeVisible();
    await diagramBtn.click();

    const diagramModal = page.locator('div[role="dialog"][aria-label="다이어그램 템플릿 갤러리"]');
    await expect(diagramModal).toBeVisible();
    await expect(diagramModal).toContainText('다이어그램 삽입 갤러리');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 12. 다이어그램 PNG 저장 오프라인 동작 검증 (시작하기.md 탭으로 돌아가서 다운로드)
    const welcomeTab = page.locator('nav').getByText('시작하기.md');
    await welcomeTab.click();
    await page.waitForTimeout(300);

    const diagWrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(diagWrap).toBeVisible({ timeout: 15000 });
    await diagWrap.scrollIntoViewIfNeeded();
    await diagWrap.hover();

    const overlay = page.locator('.mermaid-export-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    const pngBtn = overlay.getByRole('button', { name: 'PNG로 저장' });
    await expect(pngBtn).toBeVisible();

    const pngDownloadPromise = page.waitForEvent('download');
    await pngBtn.click();
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toContain('-diagram.png');

    // 13. 오프라인 동안 외부 주소로 나간 요청이 0건인지 검증
    expect(externalRequests).toEqual([]);

    // 오프라인 해제
    await context.setOffline(false);
  });
});
