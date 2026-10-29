import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const htmlPath = path.resolve(process.cwd(), 'release/MarkView-USB/MarkView.html');
const fileUrl = pathToFileURL(htmlPath).href;

test.describe('포터블 빌드 (file:// 환경) E2E 검증', () => {
  // F1. file://로 열었을 때 초기 화면 정상 로드
  test('F1. file:// 초기 로드: 시작하기.md, 수식, 다이어그램, 콘솔 에러 0건, 외부 요청 0건', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('http:') || url.startsWith('https:')) {
        externalRequests.push(url);
      }
    });

    await page.goto(fileUrl);

    // 탭 및 제목
    const welcomeTab = page.locator('nav').getByText('시작하기.md');
    await expect(welcomeTab).toBeVisible();
    const heading = page.locator('.markdown-body').getByRole('heading', { name: 'MarkView 시작하기' });
    await expect(heading).toBeVisible();

    // 수식 (.katex)
    const math = page.locator('.markdown-body .katex').first();
    await expect(math).toBeVisible();

    // 다이어그램 (.mermaid-block svg)
    const diagram = page.locator('.markdown-body .mermaid-block svg');
    await expect(diagram).toBeVisible({ timeout: 15000 });

    // hljs 구문 강조 색상 확인
    const codeToken = page.locator('.markdown-body pre code span[class*="hljs-"]').first();
    await expect(codeToken).toBeVisible();

    // 콘솔 에러 0건
    expect(consoleErrors).toEqual([]);

    // 외부 네트워크 요청 0건
    expect(externalRequests).toEqual([]);
  });

  // F2. 글 작성 후 새로고침 시 동작 확인
  test('F2. 글 작성 후 새로고침 시 동작 확인 (IndexedDB 유지 또는 임시 모드)', async ({ page }) => {
    await page.goto(fileUrl);
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('# 포터블 테스트 문서\n저장 테스트');

    // 1초 대기 후 새로고침
    await page.waitForTimeout(1000);
    await page.reload();

    // 새로고침 후 앱이 에러 화면 없이 정상 로드되는지 확인
    const hasNewDoc = await page.locator('nav').getByText('새 문서.md').isVisible();
    const hasWelcome = await page.locator('nav').getByText('시작하기.md').isVisible();
    expect(hasNewDoc || hasWelcome).toBe(true);
    await expect(page.locator('.markdown-body')).toBeVisible();
  });

  // F3. 다이어그램 편집 모달, 템플릿 갤러리 정상 오픈 확인
  test('F3. 다이어그램 편집 모달 및 템플릿 갤러리 정상 오픈 확인', async ({ page }) => {
    await page.goto(fileUrl);

    // 1) 템플릿 갤러리 모달
    const templateBtn = page.getByRole('button', { name: '템플릿' });
    await expect(templateBtn).toBeVisible();
    await templateBtn.click();
    const galleryModal = page.getByRole('dialog', { name: '문서 템플릿' });
    await expect(galleryModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(galleryModal).not.toBeVisible();

    // 2) 다이어그램 편집 모달
    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 15000 });
    const editDiagramBtn = wrap.locator('.mermaid-edit');
    await wrap.hover();
    await expect(editDiagramBtn).toBeVisible();
    await editDiagramBtn.click();
    const mermaidModal = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(mermaidModal).toBeVisible();
    await mermaidModal.getByRole('button', { name: '취소' }).click();
    await expect(mermaidModal).not.toBeVisible();
  });

  // F4. HTML 내보내기 다운로드 파일 검증
  test('F4. HTML 내보내기 다운로드 파일 검증 (외부 URL 부재, 수식 글꼴 포함, 크기 측정)', async ({ page }) => {
    await page.goto(fileUrl);

    // 내보내기 메뉴 열기
    await page.locator('header button[title="내보내기"]').click();
    const exportHtmlBtn = page.getByRole('button', { name: 'HTML 파일 (오프라인용)' });
    await expect(exportHtmlBtn).toBeVisible();

    // 다운로드 대기 및 클릭
    const downloadPromise = page.waitForEvent('download');
    await exportHtmlBtn.click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (!downloadPath) throw new Error('Download failed');

    const htmlContent = fs.readFileSync(downloadPath, 'utf8');
    const fileSize = fs.statSync(downloadPath).size;

    // 외부 CSS/JS 리소스 태그가 없는지 확인
    const externalResourceTags = htmlContent.match(/<(?:link|script|img)[^>]*(?:src|href)=["']https?:\/\/[^"']+/gi) || [];
    expect(externalResourceTags).toEqual([]);

    // 수식 폰트(woff2 data URL) 인라인 포함 확인
    expect(htmlContent).toContain('font/woff2;base64');
    expect(fileSize).toBeGreaterThan(100 * 1024);

    console.log(`[F4 실측] 내보낸 HTML 파일 크기: ${(fileSize / 1024).toFixed(1)} KB`);
  });

  // F5. 파일 경로에 한글과 공백이 있어도 열린다
  test('F5. 경로에 한글과 공백이 있어도 열린다 (임시 테스트 폴더 한글/MarkView.html)', async ({ page }) => {
    const tempDir = path.resolve(process.cwd(), 'release/임시 테스트 폴더 한글');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempHtml = path.join(tempDir, 'MarkView.html');
    fs.copyFileSync(htmlPath, tempHtml);

    try {
      const tempUrl = pathToFileURL(tempHtml).href;
      await page.goto(tempUrl);

      await expect(page.locator('nav').getByText('시작하기.md')).toBeVisible();
      await expect(page.locator('.markdown-body').getByRole('heading', { name: 'MarkView 시작하기' })).toBeVisible();
    } finally {
      try {
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch {
        // 정리 중 에러 무시
      }
    }
  });

  // F6. file: 안내 배너 표시 확인, 서비스 워커 controller null, 설치 버튼 숨김 확인
  test('F6. file: 안내 배너 표시, 서비스 워커 미등록, 설치 버튼 숨김 확인', async ({ page }) => {
    await page.goto(fileUrl);

    // 안내 배너 확인
    const banner = page.locator('aside[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('USB');

    // 서비스 워커 controller null 확인
    const swController = await page.evaluate(() => (navigator.serviceWorker ? navigator.serviceWorker.controller : null));
    expect(swController).toBeNull();

    // 설치 버튼 숨김 확인
    const installBtn = page.getByRole('button', { name: '앱 설치' });
    await expect(installBtn).not.toBeVisible();
  });

  // F7. 파일 열기/저장 API 가용성 점검 및 저장 fallback 동작 확인
  test('F7. 파일 열기/저장 API 가용성 점검 및 저장 fallback 동작 확인', async ({ page }) => {
    await page.goto(fileUrl);

    const apiSupport = await page.evaluate(async () => {
      let idbWorks = false;
      try {
        const req = indexedDB.open('__test_idb__', 1);
        await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
        idbWorks = true;
        indexedDB.deleteDatabase('__test_idb__');
      } catch {
        idbWorks = false;
      }

      return {
        isSecureContext: window.isSecureContext,
        indexedDBWorks: idbWorks,
        hasOpenFilePicker: 'showOpenFilePicker' in window,
        hasSaveFilePicker: 'showSaveFilePicker' in window,
        hasDirectoryPicker: 'showDirectoryPicker' in window,
        protocol: window.location.protocol,
      };
    });

    console.log('[F7 실측] file:// 환경 API 지원 현황:', JSON.stringify(apiSupport, null, 2));

    // File System Access API를 제거하여 <input type="file"> / <a download> fallback이 작동하는지 확인
    await page.evaluate(() => {
      // @ts-ignore
      delete window.showOpenFilePicker;
      // @ts-ignore
      delete window.showSaveFilePicker;
      // @ts-ignore
      delete window.showDirectoryPicker;
    });

    // 1) 다른 이름으로 저장 -> <a download> 다운로드 fallback 동작 확인
    await page.locator('header button[title="저장"]').click();
    const saveAsBtn = page.getByRole('button', { name: '다른 이름으로 저장' });
    await expect(saveAsBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await saveAsBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('시작하기.md');

    // 2) 열기 -> <input type="file"> fallback 동작 확인
    const openBtn = page.getByRole('button', { name: '열기' });
    await expect(openBtn).toBeVisible();
  });

  // F8. 포터블 환경(file://)에서 수식·다이어그램 템플릿 갤러리 및 다이어그램 PNG 저장 확인
  test('F8. 포터블 환경(file://)에서 수식/다이어그램 갤러리 열기 및 다이어그램 PNG 저장 확인', async ({ page }) => {
    await page.goto(fileUrl);

    // 1) 수식 템플릿 갤러리 모달 열기 및 닫기
    const mathBtn = page.locator('button[title="수식 삽입"]');
    await expect(mathBtn).toBeVisible();
    await mathBtn.click();
    const mathDialog = page.locator('div[role="dialog"][aria-label="수식 템플릿 갤러리"]');
    await expect(mathDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mathDialog).not.toBeVisible();

    // 2) 다이어그램 템플릿 갤러리 모달 열기 및 닫기
    const diagramBtn = page.locator('button[title="다이어그램 삽입"]');
    await expect(diagramBtn).toBeVisible();
    await diagramBtn.click();
    const diagramDialog = page.locator('div[role="dialog"][aria-label="다이어그램 템플릿 갤러리"]');
    await expect(diagramDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(diagramDialog).not.toBeVisible();

    // 3) 미리보기 다이어그램 호버 후 PNG 저장 동작 확인
    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 15000 });
    await expect(wrap.locator('.mermaid-block svg')).toBeVisible({ timeout: 15000 });
    await wrap.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await wrap.hover();

    const overlay = page.locator('.mermaid-export-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    const pngBtn = overlay.getByRole('button', { name: 'PNG로 저장' });
    await expect(pngBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await pngBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('-diagram.png');

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buf = fs.readFileSync(downloadedPath);
      expect(buf.length).toBeGreaterThan(16);
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
    }
  });
});
