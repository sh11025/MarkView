import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('MarkView E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 매 테스트마다 깨끗한 상태 및 표준 데스크톱 크기에서 시작하도록 보장
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
  });

  // 1. 첫 실행
  test('1. 첫 실행: 시작하기.md 탭, 제목, 수식 및 다이어그램 렌더링 확인', async ({ page }) => {
    // "시작하기.md" 탭이 있는지 확인
    const welcomeTab = page.locator('nav').getByText('시작하기.md');
    await expect(welcomeTab).toBeVisible();

    // 미리보기에 "MarkView 시작하기" 제목이 보이는지 확인
    const heading = page.locator('.markdown-body').getByRole('heading', { name: 'MarkView 시작하기' });
    await expect(heading).toBeVisible();

    // 수식(.katex)이 보이는지 확인
    const math = page.locator('.markdown-body .katex').first();
    await expect(math).toBeVisible();

    // 다이어그램(.mermaid-block svg)이 그려지는지 확인
    const diagram = page.locator('.markdown-body .mermaid-block svg');
    await expect(diagram).toBeVisible({ timeout: 10000 });
  });

  // 2. 자동 저장
  test('2. 자동 저장: 새 탭 생성 및 입력 후 새로고침 시 복원 확인', async ({ page }) => {
    // "새 문서" 버튼 클릭
    await page.locator('button[title="새 문서"]').first().click();

    // 에디터 포커스 및 입력
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('# 자동 저장 테스트\n내용이 보존됩니다.');

    // 1초 대기 후 새로고침
    await page.waitForTimeout(1000);
    await page.reload();

    // 새로고침 후에도 탭과 입력한 내용이 유지되는지 확인
    await expect(page.locator('nav').getByText('새 문서.md')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('# 자동 저장 테스트');
    await expect(page.locator('.cm-content')).toContainText('내용이 보존됩니다.');
  });

  // 3. 체크박스
  test('3. 체크박스: 미리보기 체크박스 클릭 시 원문 반영 및 Ctrl+Z 되돌리기', async ({ page }) => {
    // 미리보기의 두 번째 체크박스 (미완료 항목: "- [ ] 표의 칸을 더블클릭하면...")
    const uncheckedBox = page.locator('.markdown-body .task-checkbox').nth(1);
    await expect(uncheckedBox).not.toBeChecked();

    // 체크박스 클릭
    await uncheckedBox.click();

    // 에디터 원문의 해당 줄이 - [x]로 바뀌는지 확인
    await expect(page.locator('.cm-line', { hasText: '- [x] 표의 칸을' })).toBeVisible();

    // 에디터를 클릭해 포커스한 뒤 Ctrl+Z 누르기
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');

    // 다시 - [ ]로 돌아오는지 확인
    await expect(page.locator('.cm-line', { hasText: '- [ ] 표의 칸을' })).toBeVisible();
  });

  // 4. 표 셀 편집
  test('4. 표 셀 편집: 셀 더블클릭 후 입력 및 파이프 이스케이프 확인', async ({ page }) => {
    // 표 첫 번째 본문 셀 더블클릭 (기획서)
    const firstCell = page.locator('.markdown-body table.editable-table td').first();
    await expect(firstCell).toBeVisible();
    await firstCell.dblclick();

    // 나타난 입력창에 '가 | 나' 입력 후 Enter
    const cellInput = page.locator('input.fixed');
    await expect(cellInput).toBeVisible();
    await cellInput.fill('가 | 나');
    await page.keyboard.press('Enter');

    // 에디터 원문에는 '가 \| 나'로 보이는지 확인
    await expect(page.locator('.cm-content')).toContainText('가 \\| 나');

    // 미리보기 셀에는 '가 | 나'로 보이는지 확인
    await expect(page.locator('.markdown-body table.editable-table td').first()).toHaveText('가 | 나');
  });

  // 5. 표 열 추가
  test('5. 표 열 추가: 첫 번째 열 오른쪽 클릭 후 오른쪽에 열 추가', async ({ page }) => {
    // 첫 번째 표 선택
    const table = page.locator('.markdown-body table.editable-table').first();
    const firstHeader = table.locator('th').first();
    await expect(firstHeader).toBeVisible();
    await firstHeader.click({ button: 'right' });

    // 메뉴의 "오른쪽에 열 추가" 클릭
    const addColBtn = page.getByRole('button', { name: '오른쪽에 열 추가' });
    await expect(addColBtn).toBeVisible();
    await addColBtn.click();

    // 새 열이 첫 번째 열의 바로 오른쪽에 생기는지 확인 (인덱스 1에 새 열 삽입)
    const headers = table.locator('th');
    await expect(headers.nth(0)).toHaveText('키');
    await expect(headers.nth(1)).toHaveText('열 3');
    await expect(headers.nth(2)).toHaveText('기능');
  });

  // 6. 탭별 실행 취소
  test('6. 탭별 실행 취소: 탭 A와 탭 B의 실행 취소 분리 확인', async ({ page }) => {
    // 새 문서 A 생성
    await page.locator('button[title="새 문서"]').first().click();
    const tabA = page.locator('nav').getByText('새 문서.md');
    await expect(tabA).toBeVisible();

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('문서 A의 고유 내용입니다.');
    await expect(editor).toContainText('문서 A의 고유 내용입니다.');

    // 새 문서 B 생성
    await page.locator('button[title="새 문서"]').first().click();
    const tabB = page.locator('nav').getByText('새 문서 2.md');
    await expect(tabB).toBeVisible();

    await editor.click();
    await page.keyboard.type('문서 B의 고유 내용입니다.');
    await expect(editor).toContainText('문서 B의 고유 내용입니다.');

    // B에서 Ctrl+Z를 여러 번 누름
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ControlOrMeta+z');
    }

    // A 탭을 클릭하여 A로 전환
    await tabA.click();

    // A의 내용은 변하지 않고 그대로 남아있는지 확인
    await expect(editor).toContainText('문서 A의 고유 내용입니다.');
  });

  // 7. 슬래시 메뉴
  test('7. 슬래시 메뉴: 빈 줄에서 /표 입력 후 표 삽입 확인', async ({ page }) => {
    // 새 문서 생성 (빈 문서)
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 빈 줄에서 /표 입력
    await page.keyboard.type('/표');

    // 자동완성 대기 후 Enter
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');

    // 원문에 '| 항목 | 내용 | 비고 |'로 시작하는 표가 삽입되었는지 확인
    await expect(editor).toContainText('| 항목 | 내용 | 비고 |');
  });

  // 8. 코드 블록 보호
  test('8. 코드 블록 보호: bash 코드 블록 안의 $ 변수가 수식으로 변환되지 않음', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 코드 블록 입력
    await page.keyboard.type('```bash\necho "$HOME/$USER"\n```');

    // 미리보기에 수식(.katex)이 생기지 않는지 확인
    await page.waitForTimeout(500);
    const katexElements = page.locator('.markdown-body .katex');
    await expect(katexElements).toHaveCount(0);

    // 글자가 그대로 보이는지 확인
    await expect(page.locator('.markdown-body pre code')).toContainText('echo "$HOME/$USER"');
  });

  // 9. 표 붙여넣기
  test('9. 표 붙여넣기: TSV 텍스트 붙여넣기 시 마크다운 표로 변환 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // ClipboardEvent dispatch 방식으로 탭 구분 텍스트 붙여넣기 시뮬레이션
    await page.evaluate(() => {
      const text = '이름\t값\na\t1';
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      const target = document.querySelector('.cm-content')!;
      target.dispatchEvent(event);
    });

    // 마크다운 표로 변환되었는지 확인
    await expect(editor).toContainText('| 이름 | 값 |');
    await expect(editor).toContainText('| a | 1 |');
  });

  // 10. 긴 문서 커서 복원
  test('10. 긴 문서에서 중간 줄에 커서를 둔 뒤 새로고침 시 커서 줄 복원 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 120줄 문서 빠르게 입력
    const lines = Array.from({ length: 120 }, (_, i) => `줄 번호 ${i + 1} 테스트 내용입니다.`);
    await page.keyboard.insertText(lines.join('\n'));

    // 문서 맨 위로 이동 후 50줄 아래로 이동하여 커서 배치
    await page.keyboard.press('ControlOrMeta+Home');
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // 현재 51번째 줄이 뷰포트에 보이는지 확인
    const targetLine = page.locator('.cm-line', { hasText: '줄 번호 51 테스트 내용입니다.' });
    await expect(targetLine).toBeVisible();
    await expect(targetLine).toBeInViewport();

    // 저장 디바운스 대기 후 새로고침
    await page.waitForTimeout(1000);
    await page.reload();

    // 새로고침 후 커서가 있던 51번째 줄이 에디터 화면에 보이는 상태인지 확인
    await expect(targetLine).toBeVisible();
    await expect(targetLine).toBeInViewport();
  });

  // 11. 탭 전환 후 스크롤 위치 복원
  test('11. 탭 A에서 아래로 스크롤 후 탭 B를 거쳐 다시 A로 왔을 때 스크롤 복원 확인', async ({ page }) => {
    // 탭 A (새 문서) 생성 후 긴 내용 입력
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    const lines = Array.from({ length: 120 }, (_, i) => `탭A의 줄 번호 ${i + 1} 내용입니다.`);
    await page.keyboard.insertText(lines.join('\n'));

    // 아래로 50줄 스크롤 이동
    await page.keyboard.press('ControlOrMeta+Home');
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowDown');
    }

    const line51 = page.locator('.cm-line', { hasText: '탭A의 줄 번호 51 내용입니다.' });
    await expect(line51).toBeVisible();
    await expect(line51).toBeInViewport();

    // 스크롤 및 위치 기록 대기
    await page.waitForTimeout(500);

    // 탭 B 생성 (새 문서 2)
    await page.locator('button[title="새 문서"]').first().click();
    const tabB = page.locator('nav').getByText('새 문서 2.md');
    await expect(tabB).toBeVisible();

    // 다시 탭 A로 복귀
    const tabA = page.locator('nav').getByText('새 문서.md');
    await tabA.click();

    // 탭 A로 돌아왔을 때 스크롤되어 있던 51번째 줄이 여전히 뷰포트에 보이는지 확인
    await expect(line51).toBeVisible();
    await expect(line51).toBeInViewport();
  });

  // 12. 서식 정리 버튼
  test('12. 서식 정리: 표 정렬, 글머리 기호 통일, Ctrl+Z 되돌리기 및 중복 정리 알림 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 엉망인 표와 글머리 항목, 줄 끝 공백 입력
    const rawInput = '|이름|값|\n|--|--|\n|가나다|1|\n\n* 항목   ';
    await page.keyboard.insertText(rawInput);

    // 도구 막대의 "서식 정리" 버튼 클릭
    await page.locator('button[title="서식 정리"]').click();

    // "서식을 정리했습니다." 알림 확인
    await expect(page.getByText('서식을 정리했습니다.')).toBeVisible();

    // 표가 정렬되고 - 항목으로 변경되었는지 확인
    await expect(editor).toContainText('- 항목');
    await expect(editor).not.toContainText('* 항목');
    await expect(editor).toContainText('| 이름   |');

    // Ctrl+Z로 실행 취소하여 원래 상태로 복원 확인
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor).toContainText('* 항목');
    await expect(editor).toContainText('|--|--|');

    // 다시 서식 정리 적용 후, 한 번 더 눌렀을 때 "이미 정리되어 있습니다." 알림 확인
    await page.locator('button[title="서식 정리"]').click();
    await expect(page.getByText('서식을 정리했습니다.')).toBeVisible();

    await page.locator('button[title="서식 정리"]').click();
    await expect(page.getByText('이미 정리되어 있습니다.')).toBeVisible();
  });

  // 13. 코드 블록 보호
  test('13. 코드 블록 보호: bash 블록 안의 별표 항목, 줄 끝 공백, 빈 줄이 보존됨 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 코드 블록 안에 별표 항목, 줄 끝 공백, 연속 빈 줄 포함
    const codeBlockInput = '```bash\n* 항목   \n\n\n\n\necho hello\n```';
    await page.keyboard.insertText(codeBlockInput);

    // 서식 정리 실행
    await page.locator('button[title="서식 정리"]').click();

    // 코드 블록 내부의 * 항목이 - 항목으로 바뀌지 않고 그대로 유지되는지 확인
    await expect(editor).toContainText('* 항목');
    await expect(editor).not.toContainText('- 항목');

    // 코드 블록 내부 줄 수 유지 확인
    const lines = await page.locator('.cm-line').allTextContents();
    const fullText = lines.join('\n');
    expect(fullText).toContain('* 항목');
    expect(fullText).toContain('echo hello');
  });

  // 14. 템플릿 갤러리: 모달 열기, 회의록 선택 후 새 문서 생성 및 날짜 치환 확인
  test('14. 템플릿 갤러리: 모달 열기, 회의록 선택 후 새 문서 생성 및 날짜 치환 확인', async ({ page }) => {
    // 헤더의 "템플릿" 버튼 클릭
    await page.locator('button[title="템플릿"]').click();

    // 모달이 보이는지 확인
    const dialog = page.locator('div[role="dialog"][aria-label="문서 템플릿 갤러리"]');
    await expect(dialog).toBeVisible();

    // "회의록" 카드 클릭
    const meetingCard = dialog.getByRole('button', { name: /회의록/ }).first();
    await meetingCard.click();

    // 미리보기에 회의록 내용이 보이는지 확인
    const preview = dialog.locator('.markdown-body');
    await expect(preview).toContainText('회의록: (회의 제목)');
    await expect(preview).toContainText('액션 아이템');

    // "이 템플릿으로 새 문서" 버튼 클릭
    await dialog.getByRole('button', { name: '이 템플릿으로 새 문서' }).click();

    // 모달이 닫히는지 확인
    await expect(dialog).not.toBeVisible();

    // "회의록.md" 탭이 생기고 활성 탭인지 확인
    const meetingTab = page.locator('nav').getByText('회의록.md');
    await expect(meetingTab).toBeVisible();

    // 에디터에 회의록 내용이 들어있고 {{날짜}} 글자는 남아있지 않음 확인
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('회의록: (회의 제목)');
    await expect(editor).not.toContainText('{{날짜}}');

    // 기존 "시작하기.md" 탭도 그대로 남아있는지 확인
    const startTab = page.locator('nav').getByText('시작하기.md');
    await expect(startTab).toBeVisible();
  });

  // 15. 템플릿 갤러리: Esc 키로 닫기 및 검색 필터링 확인
  test('15. 템플릿 갤러리: Esc 키로 닫기 및 검색 필터링 확인', async ({ page }) => {
    // 템플릿 버튼 클릭
    await page.locator('button[title="템플릿"]').click();
    const dialog = page.locator('div[role="dialog"][aria-label="문서 템플릿 갤러리"]');
    await expect(dialog).toBeVisible();

    // Esc 키를 누르면 닫힘
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // 새 탭이 만들어지지 않았는지 확인 (시작하기.md 1개만 있음)
    await expect(page.locator('nav').getByText('시작하기.md')).toBeVisible();
    await expect(page.locator('nav').getByText('회의록.md')).not.toBeVisible();

    // 다시 열기
    await page.locator('button[title="템플릿"]').click();
    await expect(dialog).toBeVisible();

    // 검색창에 "체크" 입력
    const searchInput = dialog.locator('input[type="text"]');
    await searchInput.fill('체크');

    // "할 일 체크리스트" 카드만 보이는지 확인
    await expect(dialog.getByRole('button', { name: /할 일 체크리스트/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /회의록/ })).not.toBeVisible();
    await expect(dialog.getByRole('button', { name: /주간 보고/ })).not.toBeVisible();
  });

  // 16. 데스크톱 헤더 메뉴 클릭 가능 확인
  test('16. 데스크톱(1280x800): 헤더 메뉴(저장, 내보내기, 보기 설정) 열기 및 하위 항목 trial 클릭 성공', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForSelector('header');

    // 헤더가 세로 스크롤 컨테이너가 되지 않아야 함 (overflow가 visible)
    const headerOverflowY = await page.evaluate(
      () => window.getComputedStyle(document.querySelector('header')!).overflowY
    );
    expect(headerOverflowY).toBe('visible');

    // 1) 저장 메뉴
    await page.locator('header button[title="저장"]').click();
    const saveItem = page.getByRole('button', { name: '다른 이름으로 저장' });
    await expect(saveItem).toBeVisible();

    // 화면 좌표에서 실제로 해당 메뉴 항목이 최상위에 노출되어 있는지 확인 (헤더 높이 밖으로 잘리지 않음)
    const saveItemVisibleAtPoint = await saveItem.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return el === topEl || el.contains(topEl);
    });
    expect(saveItemVisibleAtPoint).toBe(true);

    await saveItem.click({ trial: true });
    expect(await page.evaluate(() => document.querySelector('header')!.scrollTop)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(saveItem).not.toBeVisible();

    // 2) 내보내기 메뉴
    await page.locator('header button[title="내보내기"]').click();
    const exportHtmlItem = page.getByRole('button', { name: 'HTML 파일 (오프라인용)' });
    const exportPdfItem = page.getByRole('button', { name: '인쇄 / PDF로 저장' });
    await expect(exportHtmlItem).toBeVisible();

    const exportPdfVisibleAtPoint = await exportPdfItem.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return el === topEl || el.contains(topEl);
    });
    expect(exportPdfVisibleAtPoint).toBe(true);

    await exportHtmlItem.click({ trial: true });
    await exportPdfItem.click({ trial: true });
    expect(await page.evaluate(() => document.querySelector('header')!.scrollTop)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(exportHtmlItem).not.toBeVisible();

    // 3) 보기 설정 메뉴
    await page.locator('header button[title="보기 설정"]').click();
    const serifBtn = page.getByRole('button', { name: '명조', exact: true });
    await expect(serifBtn).toBeVisible();

    const serifBtnVisibleAtPoint = await serifBtn.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return el === topEl || el.contains(topEl);
    });
    expect(serifBtnVisibleAtPoint).toBe(true);

    await serifBtn.click({ trial: true });
    expect(await page.evaluate(() => document.querySelector('header')!.scrollTop)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(serifBtn).not.toBeVisible();
  });

  // 17. 모바일 헤더 메뉴 클릭 가능 및 뷰포트 내 배치 확인 (400px, 360px)
  test('17. 모바일(400x800, 360x800): 헤더 메뉴 항목 trial 클릭 성공, 메뉴 박스 뷰포트 내 위치 및 가로 스크롤 없음 확인', async ({ page }) => {
    for (const width of [400, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForSelector('header');

      // 헤더가 세로 스크롤 컨테이너가 되지 않아야 함 (overflow가 visible)
      const headerOverflowY = await page.evaluate(
        () => window.getComputedStyle(document.querySelector('header')!).overflowY
      );
      expect(headerOverflowY).toBe('visible');

      // 페이지 전체 가로 스크롤 없음 검사
      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll).toBe(false);

      // 1) 저장 메뉴
      await page.locator('header button[title="저장"]').click();
      const saveMenuBox = await page.locator('header button[title="저장"] ~ div').boundingBox();
      expect(saveMenuBox).not.toBeNull();
      expect(saveMenuBox!.x).toBeGreaterThanOrEqual(0);
      expect(saveMenuBox!.x + saveMenuBox!.width).toBeLessThanOrEqual(width);

      const saveItem = page.getByRole('button', { name: '다른 이름으로 저장' });
      const saveVisible = await saveItem.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return el === topEl || el.contains(topEl);
      });
      expect(saveVisible).toBe(true);

      await saveItem.click({ trial: true });
      await page.keyboard.press('Escape');
      await expect(saveItem).not.toBeVisible();

      // 2) 내보내기 메뉴
      await page.locator('header button[title="내보내기"]').click();
      const exportMenuBox = await page.locator('header button[title="내보내기"] ~ div').boundingBox();
      expect(exportMenuBox).not.toBeNull();
      expect(exportMenuBox!.x).toBeGreaterThanOrEqual(0);
      expect(exportMenuBox!.x + exportMenuBox!.width).toBeLessThanOrEqual(width);

      const exportHtmlItem = page.getByRole('button', { name: 'HTML 파일 (오프라인용)' });
      const exportPdfItem = page.getByRole('button', { name: '인쇄 / PDF로 저장' });
      const exportVisible = await exportPdfItem.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return el === topEl || el.contains(topEl);
      });
      expect(exportVisible).toBe(true);

      await exportHtmlItem.click({ trial: true });
      await exportPdfItem.click({ trial: true });
      await page.keyboard.press('Escape');
      await expect(exportHtmlItem).not.toBeVisible();

      // 3) 보기 설정 메뉴
      await page.locator('header button[title="보기 설정"]').click();
      const settingsMenuBox = await page.locator('header button[title="보기 설정"] ~ div').boundingBox();
      expect(settingsMenuBox).not.toBeNull();
      expect(settingsMenuBox!.x).toBeGreaterThanOrEqual(0);
      expect(settingsMenuBox!.x + settingsMenuBox!.width).toBeLessThanOrEqual(width);

      const serifBtn = page.getByRole('button', { name: '명조', exact: true });
      const serifVisible = await serifBtn.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return el === topEl || el.contains(topEl);
      });
      expect(serifVisible).toBe(true);

      await serifBtn.click({ trial: true });
      await page.keyboard.press('Escape');
      await expect(serifBtn).not.toBeVisible();
    }
  });

  // 18. "열기" 메뉴: 데스크톱과 모바일에서 trial 클릭 성공 및 뷰포트 내 위치 확인
  test('18. "열기" 메뉴: 데스크톱(1280x800)과 모바일(400x800)에서 메뉴 항목 trial 클릭 성공 및 메뉴 박스 뷰포트 내 위치 확인', async ({ page }) => {
    for (const width of [1280, 400]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForSelector('header');

      const openBtn = page.locator('header button[title="열기"]');
      await expect(openBtn).toBeVisible();
      await openBtn.click();

      // 메뉴 박스 뷰포트 내 존재 확인
      const menuBox = await page.locator('header button[title="열기"] ~ div').boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox!.x).toBeGreaterThanOrEqual(0);
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);

      // "파일 열기" 항목 trial 클릭
      const openFileItem = page.getByRole('button', { name: '파일 열기' });
      await expect(openFileItem).toBeVisible();
      await openFileItem.click({ trial: true });

      // "폴더 열기" 항목 trial 클릭
      const openFolderItem = page.getByRole('button', { name: /폴더 열기/ });
      await expect(openFolderItem).toBeVisible();
      await openFolderItem.click({ trial: true });

      await page.keyboard.press('Escape');
      await expect(openFileItem).not.toBeVisible();
    }
  });

  // 19. 폴더 열기 흐름: OPFS 모킹을 통한 폴더 스캔, 파일 열기 및 기존 탭 보존 확인
  test('19. 폴더 열기 흐름: OPFS 모킹을 통한 폴더 스캔, 파일 열기 및 기존 탭 보존 확인', async ({ page }) => {
    // Chromium OPFS를 통해 진짜 FileSystemDirectoryHandle을 생성하고 showDirectoryPicker를 모킹
    await page.addInitScript(async () => {
      const root = await navigator.storage.getDirectory();
      const testDir = await root.getDirectoryHandle('test-workspace', { create: true });

      async function writeTestFile(dir: any, name: string, content: string) {
        const handle = await dir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      }

      await writeTestFile(testDir, 'a.md', '# A 문서\n내용 A');
      await writeTestFile(testDir, '10장.md', '# 10장\n내용 10');
      await writeTestFile(testDir, '2장.md', '# 2장\n내용 2');
      await writeTestFile(testDir, 'img.png', 'fake png');

      const docsDir = await testDir.getDirectoryHandle('docs', { create: true });
      await writeTestFile(docsDir, 'guide.md', '# 가이드 문서\n가이드 내용입니다.');

      const nodeModulesDir = await testDir.getDirectoryHandle('node_modules', { create: true });
      await writeTestFile(nodeModulesDir, 'x.md', '# 무시되어야 함');

      (window as any).showDirectoryPicker = async () => testDir;
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 기존 시작하기.md 탭 확인
    const startTab = page.locator('nav').getByText('시작하기.md');
    await expect(startTab).toBeVisible();

    // 헤더 "열기" -> "폴더 열기" 클릭
    await page.locator('header button[title="열기"]').click();
    await page.getByRole('button', { name: /폴더 열기/ }).click();

    // 사이드바 "파일" 탭 전환 확인 (자동 또는 클릭)
    const filesTabBtn = page.getByRole('button', { name: '파일' });
    await filesTabBtn.click();

    // 사이드바 내 폴더 트리 검증
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('test-workspace')).toBeVisible();

    // 노출되어야 하는 항목들: a.md, 2장.md, 10장.md, docs
    await expect(sidebar.getByRole('button', { name: '2장.md' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '10장.md' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'a.md' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /docs/ })).toBeVisible();

    // 노출되지 않아야 하는 항목들: node_modules, img.png, x.md
    await expect(sidebar.getByText('node_modules')).not.toBeVisible();
    await expect(sidebar.getByText('img.png')).not.toBeVisible();
    await expect(sidebar.getByText('x.md')).not.toBeVisible();

    // 순서 검증: 2장.md가 10장.md보다 앞에 위치하는지 확인
    const fileButtons = await sidebar.locator('ul li button span.truncate').allInnerTexts();
    const idx2 = fileButtons.indexOf('2장.md');
    const idx10 = fileButtons.indexOf('10장.md');
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx10).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeLessThan(idx10);

    // docs 폴더 클릭으로 펼치기 (초기 1단계 하위 폴더 자동 펼침이거나 클릭으로 토글)
    const docsBtn = sidebar.getByRole('button', { name: /docs/ });
    const guideItem = sidebar.getByRole('button', { name: 'guide.md' });
    if (!(await guideItem.isVisible())) {
      await docsBtn.click();
    }
    await expect(guideItem).toBeVisible();

    // guide.md 클릭 -> 새 탭 "guide.md" 열림
    await guideItem.click();
    const guideTab = page.locator('nav').getByText('guide.md');
    await expect(guideTab).toBeVisible();

    // 에디터 내용 확인
    await expect(page.locator('.cm-content')).toContainText('가이드 내용입니다.');

    // 기존 "시작하기.md" 탭도 그대로 남아있는지 확인
    await expect(startTab).toBeVisible();

    // 탭 개수 확인 (2개)
    const tabCountBefore = await page.locator('nav button').count();

    // 같은 파일(guide.md)을 다시 클릭했을 때 새 탭이 늘어나지 않는지 확인
    await guideItem.click();
    const tabCountAfter = await page.locator('nav button').count();
    expect(tabCountAfter).toBe(tabCountBefore);
  });

  // 20. 상대 경로 이미지 로드 및 상대 경로 문서 링크 이동 확인
  test('20. 상대 경로 이미지 로드, 누락/탈출 표시 및 문서 링크/해시 스크롤 이동 확인', async ({ page }) => {
    await page.addInitScript(async () => {
      const root = await navigator.storage.getDirectory();
      const testDir = await root.getDirectoryHandle('test-workspace-step2', { create: true });

      async function writeTestFile(dir: any, name: string, content: string | Uint8Array) {
        const handle = await dir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      }

      // a.md: 긴 본문 + ## 끝부분
      const longLines = Array.from({ length: 40 }, (_, i) => `본문 ${i + 1}줄입니다.`).join('\n\n');
      const aContent = `# 시작\n\n${longLines}\n\n## 끝부분\n\n끝부분 내용입니다.`;
      await writeTestFile(testDir, 'a.md', aContent);

      // docs/guide.md
      const docsDir = await testDir.getDirectoryHandle('docs', { create: true });
      const guideContent = [
        '# 가이드',
        '![로고](../img/logo.png)',
        '![없는이미지](../img/none.png)',
        '![탈출](../../밖.png)',
        '[홈으로](../a.md#끝부분)',
        '[문서 아님](./data.pdf)',
        '[없는 문서](./nope.md)',
      ].join('\n\n');
      await writeTestFile(docsDir, 'guide.md', guideContent);

      // img/logo.png: 1x1 투명 PNG
      const imgDir = await testDir.getDirectoryHandle('img', { create: true });
      const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const binaryString = atob(base64Png);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeTestFile(imgDir, 'logo.png', bytes);

      (window as any).showDirectoryPicker = async () => testDir;
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 폴더 열기
    await page.locator('header button[title="열기"]').click();
    await page.getByRole('button', { name: /폴더 열기/ }).click();

    // 사이드바 "파일" 탭에서 docs 펼치기 및 guide.md 클릭
    const sidebar = page.locator('aside');
    await page.getByRole('button', { name: '파일' }).click();
    await expect(sidebar.getByText('test-workspace-step2')).toBeVisible();

    const docsBtn = sidebar.getByRole('button', { name: /docs/ });
    const guideItem = sidebar.getByRole('button', { name: 'guide.md' });
    if (!(await guideItem.isVisible())) {
      await docsBtn.click();
    }
    await expect(guideItem).toBeVisible();
    await guideItem.click();

    // 1) 첫 번째 이미지가 실제로 로드되는지 확인 (비동기 로드 후 blob: 주소 부여 및 로드 완료 대기)
    const preview = page.locator('.markdown-body');
    const logoImg = preview.locator('img').first();
    await expect(logoImg).toHaveAttribute('src', /^blob:/);
    await expect(async () => {
      const isLoaded = await logoImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
      expect(isLoaded).toBe(true);
    }).toPass();

    // 2) "없는이미지"와 "탈출"은 .img-missing으로 표시되는지 확인
    const missingSpans = preview.locator('.img-missing');
    await expect(missingSpans).toHaveCount(2);
    await expect(missingSpans.nth(0)).toContainText('없는이미지');
    await expect(missingSpans.nth(1)).toContainText('탈출');

    // 3) "홈으로" 링크 클릭 -> a.md 열리고 끝부분 제목이 화면에 보이는지(in viewport) 확인
    await preview.getByRole('link', { name: '홈으로' }).click();
    const aTab = page.locator('nav').getByText('a.md');
    await expect(aTab).toBeVisible();

    // a.md 문서의 "끝부분" 제목이 화면에 보이는지 확인
    const endHeading = preview.locator('#끝부분');
    await expect(endHeading).toBeVisible();
    await expect(endHeading).toBeInViewport();

    // 4) 다시 guide.md 탭으로 돌아가기
    await page.locator('nav').getByText('guide.md').click();
    await expect(preview.getByRole('link', { name: '문서 아님' })).toBeVisible();

    // "문서 아님" 클릭 시 안내 토스트 확인
    await preview.getByRole('link', { name: '문서 아님' }).click();
    await expect(page.getByText('마크다운 문서만 열 수 있습니다')).toBeVisible();

    // "없는 문서" 클릭 시 안내 토스트 확인
    await preview.getByRole('link', { name: '없는 문서' }).click();
    await expect(page.getByText('파일을 찾을 수 없습니다')).toBeVisible();
  });

  // 21. 폴더와 무관한 문서: 상대 경로 링크/이미지 안내 확인
  test('21. 폴더와 무관한 문서: 상대 경로 링크 클릭 시 안내 토스트 및 이미지 .img-missing 표시 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 새 문서 버튼 클릭
    await page.locator('header button[title="새 문서"]').click();

    // 본문에 상대 링크와 상대 이미지 입력
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('[링크](./a.md)\n\n![그림](./x.png)');

    // 미리보기 확인
    const preview = page.locator('.markdown-body');
    await expect(preview.getByRole('link', { name: '링크' })).toBeVisible();

    // 링크 클릭 시 토스트 확인
    await preview.getByRole('link', { name: '링크' }).click();
    await expect(page.getByText('폴더에서 연 문서에서만 상대 경로 링크를 열 수 있습니다')).toBeVisible();

    // 이미지 자리에 .img-missing 표시 확인
    const missingSpan = preview.locator('.img-missing');
    await expect(missingSpan).toBeVisible();
    await expect(missingSpan).toContainText('그림');
  });

  // 22. 다이어그램 편집기 1단계: 순서도 호버 후 편집 -> 노드/연결 수정/추가 -> 적용 -> Ctrl+Z 1번 복원
  test('22. 다이어그램 편집기 1단계: 순서도 편집 모달(role=dialog)에서 수정 및 적용, Ctrl+Z 1회 복원 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 새 문서 열기
    await page.locator('header button[title="새 문서"]').click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    const src = ['# 다이어그램 테스트', '', '```mermaid', 'flowchart TD', '  A["시작단계"] --> B["완료단계"]', '```', '', '끝'].join('\n');
    await page.keyboard.type(src);

    // 미리보기에 mermaid-wrap 및 편집 버튼 생성 확인
    const preview = page.locator('.markdown-body');
    const wrap = preview.locator('.mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });

    const editBtn = wrap.locator('.mermaid-edit');
    // wrap에 호버하면 편집 버튼이 나타남
    await wrap.hover();
    await expect(editBtn).toBeVisible();

    // 편집 버튼 클릭
    await editBtn.click();

    // 접근성 role="dialog" 확인
    const modal = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(modal).toBeVisible();

    // 1단계 목록 편집기 검증을 위해 "목록" 탭으로 전환
    await modal.getByRole('tab', { name: '목록' }).click();

    // 첫 번째 노드 라벨을 "시작_수정"으로 변경
    const firstNodeInput = modal.locator('input[placeholder="단계 이름 입력"]').first();
    await expect(firstNodeInput).toHaveValue('시작단계');
    await firstNodeInput.fill('시작_수정');

    // 단계 추가 클릭
    await modal.getByRole('button', { name: '+ 단계 추가' }).click();
    const nodeInputs = modal.locator('input[placeholder="단계 이름 입력"]');
    await expect(nodeInputs).toHaveCount(3);
    await nodeInputs.nth(2).fill('세번째단계');

    // "적용" 버튼 클릭
    await modal.getByRole('button', { name: '적용' }).click();
    await expect(modal).not.toBeVisible();

    // 에디터 내용에 수정된 내용 반영 확인
    await expect(editor).toContainText('시작_수정');
    await expect(editor).toContainText('세번째단계');
    await expect(editor).toContainText('```mermaid');
    await expect(editor).toContainText('끝');

    // 에디터 클릭 후 Ctrl+Z 1회 실행
    await editor.click();
    await page.keyboard.press('Control+z');

    // Ctrl+Z 1번에 원래 코드로 복원 확인
    await expect(editor).toContainText('시작단계');
    await expect(editor).not.toContainText('시작_수정');
    await expect(editor).not.toContainText('세번째단계');
  });

  // 23. 다이어그램 편집기: 취소 시 원문 유지, 주석/style 보존, Esc 닫기 및 비순서도 안내 확인
  test('23. 다이어그램 편집기: 취소 시 원문 유지, Esc 키 닫기, %% 주석 및 style 보존, 비순서도 코드탭 안내 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 새 문서 열기
    await page.locator('header button[title="새 문서"]').click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    const src = [
      '```mermaid',
      '%% 상단 주석입니다',
      'flowchart TD',
      '  A["노드A"] --> B["노드B"]',
      '  style A fill:#f00',
      '```',
    ].join('\n');
    await page.keyboard.type(src);

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    const editBtn = wrap.locator('.mermaid-edit');
    await wrap.hover();
    await editBtn.click();

    const modal = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(modal).toBeVisible();

    // 1) 변경사항 없는 상태에서 Esc 키 입력 시 모달이 즉시 닫히는지 검증
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 다시 열기
    await wrap.hover();
    await editBtn.click();
    await expect(modal).toBeVisible();

    // 목록 탭으로 전환
    await modal.getByRole('tab', { name: '목록' }).click();

    // 2) 수정 후 취소 confirm 수락 시 원문 유지 검증
    const nodeInput = modal.locator('input[placeholder="단계 이름 입력"]').first();
    await nodeInput.fill('임의변경');
    page.once('dialog', (dialog) => dialog.accept());
    await modal.getByRole('button', { name: '취소' }).click();
    await expect(modal).not.toBeVisible();
    await expect(editor).toContainText('노드A');
    await expect(editor).not.toContainText('임의변경');

    // 3) 다시 열어서 코드 탭으로 전환
    await wrap.hover();
    await editBtn.click();
    await expect(modal).toBeVisible();

    await modal.getByRole('tab', { name: '코드' }).click();
    const textarea = modal.locator('textarea#mermaid-code-input');
    await expect(textarea).toBeVisible();
    // 주석과 스타일이 코드 탭에 보존되어 있는지 확인
    const textVal = await textarea.inputValue();
    expect(textVal).toContain('%% 상단 주석입니다');
    expect(textVal).toContain('style A fill:#f00');

    // 시퀀스 다이어그램 코드로 변경 시 "캔버스" 및 "목록" 탭 비활성화 확인
    await textarea.fill('sequenceDiagram\n  Alice->>Bob: Hello');
    const canvasTabBtn = modal.getByRole('tab', { name: '캔버스' });
    const listTabBtn = modal.getByRole('tab', { name: '목록' });
    await expect(canvasTabBtn).toBeDisabled();
    await expect(listTabBtn).toBeDisabled();
    await expect(modal.getByText(/순서도\(flowchart\/graph\)만/)).toBeVisible();

    // 적용 클릭 시 시퀀스 다이어그램이 원문에 반영되는지 확인
    await modal.getByRole('button', { name: '적용' }).click();
    await expect(modal).not.toBeVisible();
    await expect(editor).toContainText('sequenceDiagram');
    await expect(editor).toContainText('Alice->>Bob: Hello');
  });

  // 24. 다이어그램 편집기: 적용 직전 원문 변경 시 덮어쓰기 방지 검증 (전역 훅 없이 사용자 조작으로 검증)
  test('24. 다이어그램 편집기: 적용 직전 원문 변경 시 덮어쓰기 방지 검증', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 새 문서 열기
    await page.locator('header button[title="새 문서"]').click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    const src = ['```mermaid', 'flowchart TD', '  A["원래노드"] --> B["끝노드"]', '```'].join('\n');
    await page.keyboard.type(src);

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const modal = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(modal).toBeVisible();

    // 목록 탭으로 전환
    await modal.getByRole('tab', { name: '목록' }).click();

    // 모달에서 라벨 수정
    const nodeInput = modal.locator('input[placeholder="단계 이름 입력"]').first();
    await nodeInput.fill('모달수정');

    // 편집 창이 열려 있는 상태에서 에디터에 DOM 포커스를 주고 키보드로 다이어그램 블록 안쪽 내용 변경
    await editor.evaluate((el) => {
      (el as HTMLElement).focus();
    });
    // 문서 맨 처음(```mermaid)으로 이동 후 한 줄 아래(다이어그램 내부 첫 줄)로 내려가서 글자 입력
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('X');

    // 모달의 "적용" 버튼 클릭
    await modal.getByRole('button', { name: '적용' }).click();

    // 적용이 거부되고 에러 토스트가 뜨며 모달이 유지되는지 확인
    const toastMsg = page.getByText('문서가 외부에서 변경되어 적용할 수 없습니다');
    await expect(toastMsg).toBeVisible();
    await expect(modal).toBeVisible();

    // 에디터에서 직접 바꾼 글자(X)가 남아있고, 모달의 '모달수정'은 원문에 반영되지 않음 확인
    await expect(editor).toContainText('X');
    await expect(editor).not.toContainText('모달수정');
  });

  // 25. 기존 헤더 드롭다운 메뉴(저장, 내보내기, 보기) 클릭 및 잘림 점검 재확인
  test('25. 기존 헤더 드롭다운 메뉴(저장, 내보내기, 보기) 클릭 및 잘림 점검 재확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('header');

    // 1) "저장" 드롭다운 메뉴 클릭 및 전체 항목 표시 확인
    await page.locator('header button[title="저장"]').click();
    const saveItem = page.getByRole('button', { name: '다른 이름으로 저장' });
    await expect(saveItem).toBeVisible();
    await saveItem.click({ trial: true });

    // 닫기
    await page.keyboard.press('Escape');
    await expect(saveItem).not.toBeVisible();

    // 2) "내보내기" 드롭다운 메뉴 클릭
    await page.locator('header button[title="내보내기"]').click();
    const exportHtmlItem = page.getByRole('button', { name: 'HTML 파일 (오프라인용)' });
    const exportPdfItem = page.getByRole('button', { name: '인쇄 / PDF로 저장' });
    await expect(exportHtmlItem).toBeVisible();
    await expect(exportPdfItem).toBeVisible();
    await exportHtmlItem.click({ trial: true });

    // 닫기
    await page.keyboard.press('Escape');
    await expect(exportHtmlItem).not.toBeVisible();

    // 3) "보기" 드롭다운 메뉴 클릭
    await page.locator('header button[title="보기 설정"]').click();
    const serifBtn = page.getByRole('button', { name: '명조', exact: true });
    await expect(serifBtn).toBeVisible();
    await serifBtn.click({ trial: true });
    await page.keyboard.press('Escape');
    await expect(serifBtn).not.toBeVisible();
  });

  // 26. IndexedDB 실패 시 임시 모드 진입 및 자동 저장 불가 배너 확인
  test('26. IndexedDB 실패 시 임시 모드 진입 및 자동 저장 불가 배너 확인', async ({ page }) => {
    await page.addInitScript(() => {
      // IndexedDB 접근을 차단하여 loadWorkspace 실패 유도
      Object.defineProperty(window, 'indexedDB', {
        get() {
          throw new Error('IndexedDB access is denied in this test');
        },
      });
    });
    await page.goto('/');

    // 1) 치명적 에러 화면이 아닌 정상 에디터와 환영 문서가 열려야 함
    const welcomeTab = page.locator('nav').getByText('시작하기.md');
    await expect(welcomeTab).toBeVisible();
    const heading = page.locator('.markdown-body').getByRole('heading', { name: 'MarkView 시작하기' });
    await expect(heading).toBeVisible();

    // 2) "자동 저장을 쓸 수 없습니다" 안내 배너가 떠야 함
    const banner = page.locator('aside[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('자동 저장을 쓸 수 없습니다');

    // 3) 배너 닫기 버튼 동작 확인
    const closeBtn = banner.getByRole('button', { name: '배너 닫기' });
    await closeBtn.click();
    await expect(banner).not.toBeVisible();
  });

  // 27. 모달 창 색상 및 대비 회귀 방지 (다이어그램 편집 창 & 템플릿 갤러리)
  test('27. 라이트/다크 테마에서 편집 창 및 템플릿 갤러리 배경 불투명도, 테두리, 대비 비율(>=4.5) 확인', async ({ page }) => {
    function parseRgba(str: string): { r: number; g: number; b: number; a: number } {
      const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return { r: 0, g: 0, b: 0, a: 1 };
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] !== undefined ? Number(match[4]) : 1,
      };
    }

    function getLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
      const a = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrast(c1: string, c2: string): number {
      const l1 = getLuminance(parseRgba(c1));
      const l2 = getLuminance(parseRgba(c2));
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((t) => {
        localStorage.setItem('markview-theme', t);
      }, theme);
      await page.goto('/');

      // --- 1. 다이어그램 편집 모달 점검 ---
      const wrap = page.locator('.markdown-body .mermaid-wrap').first();
      await expect(wrap).toBeVisible({ timeout: 10000 });
      await wrap.hover();
      await wrap.locator('.mermaid-edit').click();

      const diagramDialog = page.getByRole('dialog', { name: '다이어그램 편집' });
      await expect(diagramDialog).toBeVisible();

      // 모달 패널 요소
      const diagramPanel = diagramDialog.locator('> div').first();

      // (a) 창 패널 배경색 불투명(알파 1) 확인
      const panelBg = await diagramPanel.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      const parsedPanelBg = parseRgba(panelBg);
      expect(parsedPanelBg.a, `[${theme}] 다이어그램 패널 배경 알파는 1이어야 함`).toBe(1);

      // (b), (c) 창 안의 첫 번째 input/select 테두리 및 배경 확인
      const firstInput = diagramPanel.locator('input, select').first();
      await expect(firstInput).toBeVisible();
      const inputStyles = await firstInput.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          bg: cs.backgroundColor,
          border: cs.borderColor,
          color: cs.color,
        };
      });

      // (b) 테두리 색이 글자색과 같지 않아야 함 (정의되지 않은 border-border일 때 currentColor로 떨어지는 버그 방지)
      expect(
        inputStyles.border,
        `[${theme}] 입력칸 테두리 색(${inputStyles.border})은 글자색(${inputStyles.color})과 달라야 함`,
      ).not.toBe(inputStyles.color);

      // (c) 입력칸 배경이 투명이 아니어야 함
      const parsedInputBg = parseRgba(inputStyles.bg);
      expect(parsedInputBg.a, `[${theme}] 입력칸 배경은 투명이 아니어야 함`).toBe(1);

      // (d) 패널 배경색과 제목 글자색의 명도 대비 비율 >= 4.5
      const headingColor = await diagramPanel.locator('h3').evaluate((el) => window.getComputedStyle(el).color);
      const contrast = getContrast(panelBg, headingColor);
      expect(
        contrast,
        `[${theme}] 패널 배경(${panelBg})과 제목 글자(${headingColor})의 명도 대비(${contrast.toFixed(2)})는 4.5 이상이어야 함`,
      ).toBeGreaterThanOrEqual(4.5);

      // 다이어그램 모달 닫기
      await page.keyboard.press('Escape');
      await expect(diagramDialog).not.toBeVisible();

      // --- 2. 템플릿 갤러리 모달 점검 ---
      const templateBtn = page.getByRole('button', { name: '템플릿' });
      await templateBtn.click();
      const galleryDialog = page.getByRole('dialog', { name: /문서 템플릿/ });
      await expect(galleryDialog).toBeVisible();

      const galleryPanel = galleryDialog.locator('> div').first();
      const galleryPanelBg = await galleryPanel.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(parseRgba(galleryPanelBg).a, `[${theme}] 템플릿 갤러리 패널 배경 알파는 1이어야 함`).toBe(1);

      const galleryInput = galleryPanel.locator('input').first();
      const galleryInputStyles = await galleryInput.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          bg: cs.backgroundColor,
          border: cs.borderColor,
          color: cs.color,
        };
      });
      expect(galleryInputStyles.border).not.toBe(galleryInputStyles.color);
      expect(parseRgba(galleryInputStyles.bg).a).toBe(1);

      const galleryHeadingColor = await galleryPanel.locator('h2').first().evaluate((el) => window.getComputedStyle(el).color);
      const galleryContrast = getContrast(galleryPanelBg, galleryHeadingColor);
      expect(galleryContrast).toBeGreaterThanOrEqual(4.5);

      await page.keyboard.press('Escape');
      await expect(galleryDialog).not.toBeVisible();
    }
  });

  // 28. 캔버스에서 "+" 추가: 순서도에서 편집 -> 캔버스 기본 탭 -> "+" 클릭 -> 새 노드 입력 -> 적용 -> 원문 반영 및 Ctrl+Z 복원
  test('28. 캔버스에서 "+" 추가 및 Ctrl+Z 1회 복원 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    const initialText = '# 다이어그램 테스트\n\n```mermaid\nflowchart LR\n  A["시작"] --> B["끝"]\n```\n\n마침 문장';
    await page.keyboard.type(initialText);

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 기본 탭이 "캔버스"인지 확인
    const canvasTabBtn = dialog.getByRole('tab', { name: '캔버스' });
    await expect(canvasTabBtn).toHaveAttribute('aria-selected', 'true');

    // 노드 2개 확인
    const nodeA = dialog.locator('[data-node-id="A"]');
    const nodeB = dialog.locator('[data-node-id="B"]');
    await expect(nodeA).toBeVisible();
    await expect(nodeB).toBeVisible();

    // B 노드에 호버 후 오른쪽 "+" 버튼 클릭 가능 여부(trial) 및 실제 클릭
    await nodeB.hover();
    const plusBtn = nodeB.locator('[data-quick-add="right"]');
    await expect(plusBtn).toBeVisible();
    await plusBtn.click({ trial: true });
    await plusBtn.click();

    // 노드 3개로 증가
    const allNodes = dialog.locator('[data-node-id]');
    await expect(allNodes).toHaveCount(3);

    // 새 노드가 텍스트 입력 상태
    const activeTextarea = dialog.locator('textarea:focus');
    await expect(activeTextarea).toBeVisible();
    await activeTextarea.fill('검토');
    await page.keyboard.press('Enter');

    // 적용 클릭
    await dialog.getByRole('button', { name: '적용' }).click();
    await expect(dialog).not.toBeVisible();

    // 에디터 원문에 "검토"와 연결 추가, 앞뒤 문장 보존 확인
    await expect(editor).toContainText('마침 문장');
    await expect(editor).toContainText('검토');

    // 미리보기 SVG에 "검토" 렌더링 확인
    const previewSvg = page.locator('.markdown-body .mermaid-block svg');
    await expect(previewSvg).toContainText('검토');

    // Ctrl+Z 1회 실행 취소 -> 원문 복원
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor).not.toContainText('검토');
    await expect(editor).toContainText('A["시작"] --> B["끝"]');
  });

  // 29. 노드 라벨, 색상(indigo), 모양(rhombus) 수정 및 classDef 생성 확인
  test('29. 노드 라벨, 색상(indigo), 모양(rhombus) 수정 및 classDef 생성 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('```mermaid\nflowchart TD\n  A["시작단계"]\n```');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // A 노드 더블클릭 -> 라벨 수정
    const nodeA = dialog.locator('[data-node-id="A"]');
    await expect(nodeA).toBeVisible();
    await nodeA.dblclick();

    const labelInput = nodeA.locator('textarea');
    await expect(labelInput).toBeVisible();
    await labelInput.fill('조건판별');
    await page.keyboard.press('Enter');

    // 노드 선택 후 플로팅 바에서 색상 남색(indigo) 선택 (trial 검증 및 실제 클릭)
    await nodeA.click();
    const indigoBtn = dialog.locator('button[aria-label="색상: 남색"]');
    await expect(indigoBtn).toBeVisible();
    await indigoBtn.click({ trial: true });
    await indigoBtn.click();

    // 모양 마름모로 변경
    const shapeSelect = dialog.locator('select[aria-label="도형 모양 변경"]');
    await expect(shapeSelect).toBeVisible();
    await shapeSelect.selectOption('rhombus');

    // 적용 클릭
    await dialog.getByRole('button', { name: '적용' }).click();
    await expect(dialog).not.toBeVisible();

    // 원문에 classDef mv-indigo, class A mv-indigo, 마름모 문법 A{"조건판별"} 포함 확인
    await expect(editor).toContainText('classDef mv-indigo fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b');
    await expect(editor).toContainText('class A mv-indigo');
    await expect(editor).toContainText('A{"조건판별"}');

    // 미리보기 SVG에서 채움색 확인
    const svgNode = page.locator('.markdown-body .mermaid-block svg').first();
    await expect(svgNode).toBeVisible();
  });

  // 30. 포트로 연결: 포트에서 다른 노드로 마우스 드래그 연결선 생성
  test('30. 캔버스 포트 드래그를 통한 노드 간 연결선 생성', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('```mermaid\nflowchart LR\n  A["출발"]\n  B["도착"]\n```');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    const nodeA = dialog.locator('[data-node-id="A"]');
    const nodeB = dialog.locator('[data-node-id="B"]');
    await expect(nodeA).toBeVisible();
    await expect(nodeB).toBeVisible();

    // A 노드 호버 -> right 포트 확인
    await nodeA.hover();
    const portRight = nodeA.locator('[data-port="right"]');
    await expect(portRight).toBeVisible();

    // 포트 중심 좌표에서 B 노드 중심 좌표로 마우스 드래그
    const portBox = await portRight.boundingBox();
    const nodeBBox = await nodeB.boundingBox();
    expect(portBox).toBeTruthy();
    expect(nodeBBox).toBeTruthy();

    if (portBox && nodeBBox) {
      await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(nodeBBox.x + nodeBBox.width / 2, nodeBBox.y + nodeBBox.height / 2, { steps: 5 });
      await page.mouse.up();
    }

    // 엣지가 1개 생겼는지 확인
    const edge = dialog.locator('[data-edge-id]');
    await expect(edge).toHaveCount(1);

    // 적용 클릭 후 원문에 A --> B 연결 확인
    await dialog.getByRole('button', { name: '적용' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(editor).toContainText('A --> B');
  });

  // 31. 삭제와 되돌리기: 노드 선택 후 Delete 키 -> 사라짐 -> 되돌리기 버튼 복구
  test('31. Delete 키로 노드 삭제 후 되돌리기(Undo) 버튼으로 복구', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('```mermaid\nflowchart TD\n  A["노드A"] --> B["노드B"]\n```');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 노드 A 클릭 선택
    const nodeA = dialog.locator('[data-node-id="A"]');
    await nodeA.click();

    // Delete 키 입력
    await page.keyboard.press('Delete');

    // 노드 A 및 연결선 사라짐 확인
    await expect(nodeA).not.toBeVisible();
    const edges = dialog.locator('[data-edge-id]');
    await expect(edges).toHaveCount(0);

    // 되돌리기(Undo) 버튼 클릭
    const undoBtn = dialog.getByRole('button', { name: '되돌리기' });
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // 노드 A 복구 확인
    await expect(nodeA).toBeVisible();
    await expect(dialog.locator('[data-edge-id]')).toHaveCount(1);

    await page.keyboard.press('Escape');
  });

  // 32. 위치 이동은 코드를 바꾸지 않는다: 노드 드래그 이동 후 적용 시 문서 원문 및 Ctrl+Z 불변
  test('32. 캔버스 노드 위치 이동 후 적용 시 코드 미변경 및 히스토리 보존', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    const code = '```mermaid\nflowchart LR\n  A["고정A"] --> B["고정B"]\n```';
    await page.keyboard.type(code);

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 노드 A 드래그 이동
    const nodeA = dialog.locator('[data-node-id="A"]');
    const box = await nodeA.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 5 });
      await page.mouse.up();
    }

    // 적용 클릭 -> 코드가 바뀌지 않았으므로 replaceLines 호출 없이 창만 닫힘
    await dialog.getByRole('button', { name: '적용' }).click();
    await expect(dialog).not.toBeVisible();

    // 원문 텍스트 완전히 동일
    await expect(editor).toContainText('A["고정A"] --> B["고정B"]');

    // 에디터에서 Ctrl+Z 실행 시에도 문서 내용 변경 없음
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor).toContainText('A["고정A"] --> B["고정B"]');
  });

  // 33. 탭 공유: 캔버스에서 노드 추가 후 목록/코드 탭 동기화 및 코드 수정의 캔버스 반영
  test('33. 캔버스, 목록, 코드 탭 간의 양방향 모델 동기화 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('```mermaid\nflowchart LR\n  A["시작"]\n```');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 1) 캔버스에서 A 노드 호버 후 오른쪽 "+" 추가
    const nodeA = dialog.locator('[data-node-id="A"]');
    await nodeA.hover();
    await nodeA.locator('[data-quick-add="right"]').click();
    const activeTextarea = dialog.locator('textarea:focus');
    await activeTextarea.fill('중간단계');
    await page.keyboard.press('Enter');

    // 2) "목록" 탭으로 이동 -> '중간단계' 노드가 목록에 있는지 확인
    await dialog.getByRole('tab', { name: '목록' }).click();
    await expect(dialog.locator('input[value="중간단계"]')).toBeVisible();

    // 3) "코드" 탭으로 이동 -> 코드 에디터에 '중간단계'가 반영되어 있는지 확인
    await dialog.getByRole('tab', { name: '코드' }).click();
    const codeArea = dialog.locator('textarea#mermaid-code-input');
    await expect(codeArea).toContainText('중간단계');

    // 4) 코드 탭에서 새 노드 직접 추가: C["끝단계"]
    await codeArea.fill('flowchart LR\n  A["시작"] --> B["중간단계"]\n  B --> C["끝단계"]');

    // 5) 다시 "캔버스" 탭으로 복귀 -> C 노드 '끝단계'가 캔버스에 렌더링되어 있는지 확인
    await dialog.getByRole('tab', { name: '캔버스' }).click();
    const nodeC = dialog.locator('[data-node-id="C"]');
    await expect(nodeC).toBeVisible();
    await expect(nodeC).toContainText('끝단계');

    await page.keyboard.press('Escape');
  });

  // 34. 모바일(400x800): 주요 버튼 클릭 가능 및 가로 스크롤 없음
  test('34. 모바일(400x800)에서 편집 창 버튼 trial 클릭 성공 및 가로 스크롤 없음 확인', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('/');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 주요 툴바 버튼들이 클릭 가능한지 trial 확인 (되돌리기는 초기 비활성화 확인)
    const undoBtn = dialog.getByRole('button', { name: '되돌리기' });
    const autoLayoutBtn = dialog.getByRole('button', { name: '자동 정돈' });
    const cancelBtn = dialog.getByRole('button', { name: '취소' });
    const applyBtn = dialog.getByRole('button', { name: '적용' });

    await expect(undoBtn).toBeDisabled();
    await autoLayoutBtn.click({ trial: true });
    await cancelBtn.click({ trial: true });
    await applyBtn.click({ trial: true });

    // 모달 컨테이너 가로 스크롤 없음 확인
    const panel = dialog.locator('> div').first();
    const scrollWidth = await panel.evaluate((el) => el.scrollWidth);
    const clientWidth = await panel.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  // 35. 더블클릭 진입: 미리보기 다이어그램을 더블클릭하면 편집 창이 열린다
  test('35. 미리보기 다이어그램 더블클릭으로 편집 창 열림 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });

    // 다이어그램 더블클릭
    await wrap.dblclick();

    // 편집 창 모달이 열리는지 확인
    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 닫기 버튼 클릭으로 정상 닫힘 확인
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // 36. 더블클릭 반응: 로딩 표시(Suspense fallback) 노출 및 글자 선택 방지 확인
  test('36. 다이어그램 더블클릭 시 로딩 표시 노출 및 텍스트 선택 없음 확인', async ({ page }) => {
    // 편집기 청크 요청을 800ms 지연시켜 로딩 인디케이터 포착 보장
    await page.route('**/*MermaidEditor*', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });

    // 더블클릭
    await wrap.dblclick();

    // 1) 로딩 표시("편집기를 여는 중…", role="status")가 나타나는지 확인
    const loading = page.locator('[role="status"]').getByText('편집기를 여는 중…');
    await expect(loading).toBeVisible();

    // 2) 로딩 완료 후 실제 편집 대화 상자가 열림
    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3) 더블클릭으로 인해 선택된 텍스트가 없어야 함 (user-select: none 및 선택 해제)
    const selection = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(selection).toBe('');

    // 닫기
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // 37. 캔버스 겹침 및 가장자리: 위쪽 노드 선택 시 조작 막대가 아래 노드를 가리지 않고, 위쪽 + 추가 시 캔버스 내에 완전히 포함됨
  test('37. 조작 막대 노드 가림 방지 및 새 노드 캔버스 경계 내 자동 포함 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 새 문서 열기 후 세로 2개 노드(A, B) 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();
    const initialText = '# 다이어그램 겹침 테스트\n\n```mermaid\nflowchart TD\n  A["위단계"] --> B["아래단계"]\n```\n';
    await page.keyboard.type(initialText);

    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 10000 });
    await wrap.hover();
    await wrap.locator('.mermaid-edit').click();

    const dialog = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(dialog).toBeVisible();

    // 캔버스 컨테이너
    const canvasContainer = dialog.locator('div.relative.flex-1.min-h-0').first();
    const canvasBox = await canvasContainer.boundingBox();
    expect(canvasBox).not.toBeNull();

    // 위쪽 노드 A 선택
    const nodeA = dialog.locator('[data-node-id="A"]');
    const nodeB = dialog.locator('[data-node-id="B"]');
    await expect(nodeA).toBeVisible();
    await expect(nodeB).toBeVisible();

    await nodeA.click();

    // 조작 막대 나타남 확인
    const floatingBar = dialog.locator('[data-floating-bar="node"]');
    await expect(floatingBar).toBeVisible();

    const barBox = await floatingBar.boundingBox();
    const nodeBBox = await nodeB.boundingBox();
    expect(barBox).not.toBeNull();
    expect(nodeBBox).not.toBeNull();

    // 조작 막대가 노드 B의 중심점(centerX, centerY)을 가리지 않는지 검증
    const bCenterX = nodeBBox!.x + nodeBBox!.width / 2;
    const bCenterY = nodeBBox!.y + nodeBBox!.height / 2;
    const isOverlappingCenter =
      bCenterX >= barBox!.x &&
      bCenterX <= barBox!.x + barBox!.width &&
      bCenterY >= barBox!.y &&
      bCenterY <= barBox!.y + barBox!.height;
    expect(isOverlappingCenter).toBe(false);

    // 노드 A의 위쪽 "+" 버튼 호버 후 클릭하여 위쪽에 새 노드 생성
    await nodeA.hover();
    const plusTopBtn = nodeA.locator('[data-quick-add="top"]');
    await expect(plusTopBtn).toBeVisible();
    await plusTopBtn.click({ trial: true });
    await plusTopBtn.click();

    // 새 노드가 생성되었고 캔버스 컨테이너 경계 안에 완전히 들어왔는지 확인
    const allNodes = dialog.locator('[data-node-id]');
    await expect(allNodes).toHaveCount(3);

    // 가장 최근 추가된 새 노드(링 또는 textarea가 활성인 노드)의 바운딩 박스
    const activeTextarea = dialog.locator('textarea:focus');
    await expect(activeTextarea).toBeVisible();
    const newNodeContainer = activeTextarea.locator('xpath=./ancestor::div[@data-node-id]');
    const newBox = await newNodeContainer.boundingBox();
    expect(newBox).not.toBeNull();

    // 캔버스 컨테이너 상하좌우 안에 온전히 들어있는지 확인
    expect(newBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);
    expect(newBox!.x).toBeGreaterThanOrEqual(canvasBox!.x);
    expect(newBox!.y + newBox!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height);

    page.once('dialog', (d) => d.accept());
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // 38. 6가지 색상 노드 문서 적용 및 라이트/다크 명도 대비(>=4.5) 자동 점검
  test('38. 6가지 색 노드 문서 적용 및 라이트/다크 테마 명도 대비(>=4.5) 검증', async ({ page }) => {
    function parseRgb(colorStr: string): { r: number; g: number; b: number } {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
      const hex = colorStr.replace('#', '');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
      return { r: 0, g: 0, b: 0 };
    }

    function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
      const a = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function contrastRatio(c1: string, c2: string): number {
      const l1 = luminance(parseRgb(c1));
      const l2 = luminance(parseRgb(c2));
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      // 테마 설정
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('markview-theme', t);
      }, theme);

      // 새 문서 생성
      await page.locator('button[title="새 문서"]').first().click();
      const editor = page.locator('.cm-content');
      await editor.click();

      // 6가지 색상 classDef가 모두 적용된 순서도 마크다운 작성
      const sixColorsMermaid = [
        '# 6가지 색상 테스트',
        '',
        '```mermaid',
        'flowchart LR',
        '  classDef mv-indigo fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b',
        '  classDef mv-emerald fill:#d1fae5,stroke:#10b981,color:#064e3b',
        '  classDef mv-amber fill:#fef3c7,stroke:#f59e0b,color:#78350f',
        '  classDef mv-rose fill:#ffe4e6,stroke:#f43f5e,color:#881337',
        '  classDef mv-purple fill:#f3e8ff,stroke:#a855f7,color:#581c87',
        '  classDef mv-slate fill:#e2e8f0,stroke:#64748b,color:#0f172a',
        '  N1["남색"]:::mv-indigo --> N2["초록"]:::mv-emerald',
        '  N2 --> N3["노랑"]:::mv-amber',
        '  N3 --> N4["빨강"]:::mv-rose',
        '  N4 --> N5["보라"]:::mv-purple',
        '  N5 --> N6["회색"]:::mv-slate',
        '```',
      ].join('\n');

      await page.keyboard.type(sixColorsMermaid);

      // 미리보기에 SVG 렌더링 대기
      const wrap = page.locator('.markdown-body .mermaid-wrap').first();
      await expect(wrap).toBeVisible({ timeout: 10000 });
      const svg = wrap.locator('svg');
      await expect(svg).toBeVisible({ timeout: 10000 });

      // 6개 노드의 fill과 text color를 추출하여 명도 대비 검증
      const results = await svg.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('.node'));
        return nodes.map((node) => {
          const shapeEl = node.querySelector('rect, polygon, circle, path');
          const textEl = node.querySelector('text, span, p');
          const shapeStyle = shapeEl ? window.getComputedStyle(shapeEl) : null;
          const textStyle = textEl ? window.getComputedStyle(textEl) : null;
          const fill = shapeStyle?.fill || shapeEl?.getAttribute('fill') || '';
          const color = textStyle?.color || textStyle?.fill || textEl?.getAttribute('fill') || '';
          return {
            text: textEl?.textContent?.trim() || '',
            fill,
            color,
          };
        });
      });

      expect(results.length).toBeGreaterThanOrEqual(6);
      for (const res of results) {
        if (!res.fill || !res.color) continue;
        const ratio = contrastRatio(res.fill, res.color);
        expect(ratio, `[${theme}] 노드 '${res.text}'의 명도 대비(${ratio.toFixed(2)})는 4.5 이상이어야 함`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // 39. 전체 백업과 복원 왕복: 백업 JSON 생성, 새 컨텍스트 복원, 중복 복원 시 (복원) 명명 확인
  test('39. 전체 백업과 복원 왕복: 백업 JSON 다운로드 및 새 세션 복원 검증', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1) 문서 두 개를 만들어 각각 고유 문구 입력
    const newDocBtn = page.locator('button[title="새 문서"]').first();
    await newDocBtn.click();
    let editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('# 백업테스트-가\n첫 번째 문서 내용입니다.\n');

    await newDocBtn.click();
    editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type('# 백업테스트-나\n두 번째 문서 내용입니다.\n');

    // 2) "내보내기" 메뉴 -> "전체 백업 내려받기"
    const exportBtn = page.locator('header button[title="내보내기"]');
    await exportBtn.click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '전체 백업 내려받기' }).click();
    const download = await downloadPromise;

    // 백업 파일 JSON 내용 검증
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const fileContent = fs.readFileSync(downloadPath!, 'utf-8');
    const backupJson = JSON.parse(fileContent);

    expect(backupJson.format).toBe('markview-backup');
    expect(backupJson.version).toBe(1);
    expect(fileContent).toContain('백업테스트-가');
    expect(fileContent).toContain('백업테스트-나');
    // handleId 같은 브라우저 내부 핸들이 백업에 들어가지 않았는지 확인
    for (const doc of backupJson.documents) {
      expect('handleId' in doc).toBe(false);
    }

    // 3) 새 브라우저 컨텍스트(독립된 깨끗한 저장소)에서 복원
    const cleanContext = await browser.newContext();
    const cleanPage = await cleanContext.newPage();
    await cleanPage.setViewportSize({ width: 1280, height: 800 });
    await cleanPage.goto('/');

    // 숨겨진 파일 인풋에 백업 파일 투입
    const fileInput = cleanPage.locator('input[type="file"][accept*="json"]');
    await fileInput.setInputFiles(downloadPath!);

    // 요약 확인 창 확인
    const dialog = cleanPage.getByRole('dialog', { name: '백업 복원' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(new RegExp(`문서 ${backupJson.documents.length}개`))).toBeVisible();
    await expect(dialog.getByText('설정은 복원되지 않습니다')).toBeVisible();

    // 복원하기 클릭
    await dialog.getByRole('button', { name: '복원하기' }).click();
    await expect(dialog).not.toBeVisible();

    // 복원 알림 확인
    await expect(
      cleanPage.locator('[role="status"]').getByText(new RegExp(`문서 ${backupJson.documents.length}개를 새 탭으로 복원했습니다`)),
    ).toBeVisible();

    // 복원된 탭 클릭 후 내용 확인
    const tab1 = cleanPage.locator('nav').getByText('새 문서.md');
    await expect(tab1).toBeVisible();
    await tab1.click();
    const restoredEditor = cleanPage.locator('.cm-content');
    await expect(restoredEditor).toContainText('백업테스트-가');

    const tab2 = cleanPage.locator('nav').getByText('새 문서 2.md');
    await expect(tab2).toBeVisible();
    await tab2.click();
    await expect(restoredEditor).toContainText('백업테스트-나');

    // 4) 같은 컨텍스트에서 한 번 더 복원 시 기존 탭 유지 및 "(복원)" 접미사 확인
    await fileInput.setInputFiles(downloadPath!);
    const secondDialog = cleanPage.getByRole('dialog', { name: '백업 복원' });
    await expect(secondDialog).toBeVisible();
    await secondDialog.getByRole('button', { name: '복원하기' }).click();
    await expect(secondDialog).not.toBeVisible();

    // (복원) 이름의 탭이 존재하는지 확인
    const restoredTabs = cleanPage.locator('nav').getByText(/\(복원\)/);
    await expect(restoredTabs.first()).toBeVisible();

    await cleanContext.close();
  });

  // 40. 잘못된 백업 파일: 깨진 JSON 및 잘못된 포맷 시 오류 안내 및 기존 문서 불변
  test('40. 잘못된 백업 파일 복원 시 한국어 오류 안내 및 기존 탭 데이터 보존', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const fileInput = page.locator('input[type="file"][accept*="json"]');

    // 1) 깨진 JSON 파일 시도
    await fileInput.setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ broken json content...'),
    });

    const errorToast1 = page.locator('[role="status"]').getByText('백업 파일을 읽을 수 없습니다. 다른 파일을 선택해 주세요.');
    await expect(errorToast1).toBeVisible();

    // 복원 확인 대화상자가 뜨지 않아야 함
    const dialog = page.getByRole('dialog', { name: '백업 복원' });
    await expect(dialog).not.toBeVisible();

    // 2) format이 다른 JSON 시도
    await fileInput.setInputFiles({
      name: 'wrong-format.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'unknown-app', version: 1, documents: [] })),
    });

    const errorToast2 = page.locator('[role="status"]').getByText('MarkView 백업 파일이 아닙니다.');
    await expect(errorToast2).toBeVisible();

    // 3) 기존 환영 탭과 본문이 그대로 유지되는지 확인
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('MarkView');
  });

  // 41. 문제 정보 복사: 진단 모달 열림, 개인정보 비누출, 복사 동작
  test('41. 문제 정보 복사 창 열림 및 개인정보(문서 내용/제목) 비누출 검증', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1) 설정 메뉴 -> 문제 정보 복사 창 열기
    const settingsBtn = page.locator('header button[title="보기 설정"]');
    await settingsBtn.click();

    const infoMenuBtn = page.getByRole('button', { name: '문제 정보 복사…' });
    await expect(infoMenuBtn).toBeVisible();
    await infoMenuBtn.click();

    const dialog = page.getByRole('dialog', { name: '문제 정보' });
    await expect(dialog).toBeVisible();

    // 기본 진단 정보 필드 확인 (비동기 로드 완료 대기)
    const textarea = dialog.locator('textarea');
    await expect(textarea).toHaveValue(/MarkView/);
    await expect(textarea).toHaveValue(/버전:/);
    await expect(textarea).toHaveValue(/브라우저:/);
    await expect(textarea).toHaveValue(/저장소 상태/);
    await expect(textarea).toHaveValue(/문서 및 데이터 통계/);

    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    // 2) 고유 비밀문구와 비밀 문서명을 작성
    const secretContent = '비밀문구-절대노출금지-XYZ123';
    const secretTitle = '비밀이름.md';

    const newDocBtn = page.locator('button[title="새 문서"]').first();
    await newDocBtn.click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type(secretContent);

    // 탭 이름 변경
    const tab = page.locator('nav').getByText('새 문서.md');
    await tab.dblclick();
    const renameInput = page.locator('nav input');
    await renameInput.fill('비밀이름');
    await renameInput.press('Enter');
    await expect(page.locator('nav').getByText('비밀이름.md')).toBeVisible();

    // 3) 다시 문제 정보 창을 열었을 때 비밀문구와 비밀이름이 전혀 없어야 함 (개인정보 비누출)
    await settingsBtn.click();
    await infoMenuBtn.click();
    await expect(dialog).toBeVisible();

    await expect(textarea).toHaveValue(/MarkView/);
    const text = await textarea.inputValue();
    expect(text).not.toContain(secretContent);
    expect(text).not.toContain(secretTitle);
    expect(text).toContain('문서 내용, 파일 이름, 로컬 폴더 경로가 일절 포함되지 않습니다');

    // 4) 복사 버튼 클릭
    const copyBtn = dialog.getByRole('button', { name: '복사' });
    await copyBtn.click();
    await expect(dialog.getByRole('button', { name: '복사 완료' })).toBeVisible();

    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  });

  // 42. 메뉴 잘림 점검: 데스크톱(1280px) 및 모바일(400px)에서 새 메뉴 항목 trial click 및 뷰포트 내 수용
  test('42. 새 메뉴 항목(전체 백업 내려받기, 백업에서 복원, 문제 정보 복사) 데스크톱/400px 클릭 가능 및 뷰포트 내 위치 확인', async ({ page }) => {
    for (const width of [1280, 400]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      // 1) "열기" 메뉴 -> "백업에서 복원…"
      const openBtn = page.locator('header button[title="열기"]');
      await openBtn.click();
      const restoreItem = page.getByRole('button', { name: '백업에서 복원…' });
      await expect(restoreItem).toBeVisible();
      await restoreItem.click({ trial: true });

      // 메뉴 박스가 화면 안에 온전히 있는지
      const openMenuBox = page.locator('.shadow-xl.border').first();
      const openBox = await openMenuBox.boundingBox();
      expect(openBox).not.toBeNull();
      expect(openBox!.x).toBeGreaterThanOrEqual(0);
      expect(openBox!.x + openBox!.width).toBeLessThanOrEqual(width + 2);
      await page.keyboard.press('Escape');

      // 2) "내보내기" 메뉴 -> "전체 백업 내려받기"
      const exportBtn = page.locator('header button[title="내보내기"]');
      await exportBtn.click();
      const backupItem = page.getByRole('button', { name: '전체 백업 내려받기' });
      await expect(backupItem).toBeVisible();
      await backupItem.click({ trial: true });

      const exportMenuBox = page.locator('.shadow-xl.border').first();
      const expBox = await exportMenuBox.boundingBox();
      expect(expBox).not.toBeNull();
      expect(expBox!.x).toBeGreaterThanOrEqual(0);
      expect(expBox!.x + expBox!.width).toBeLessThanOrEqual(width + 2);
      await page.keyboard.press('Escape');

      // 3) "보기 설정" 메뉴 -> "문제 정보 복사…"
      const settingsBtn = page.locator('header button[title="보기 설정"]');
      await settingsBtn.click();
      const infoBtn = page.getByRole('button', { name: '문제 정보 복사…' });
      await expect(infoBtn).toBeVisible();
      await infoBtn.click({ trial: true });

      const settingsMenuBox = page.locator('.shadow-xl.border').first();
      const setBox = await settingsMenuBox.boundingBox();
      expect(setBox).not.toBeNull();
      expect(setBox!.x).toBeGreaterThanOrEqual(0);
      expect(setBox!.x + setBox!.width).toBeLessThanOrEqual(width + 2);
      await page.keyboard.press('Escape');
    }
  });

  // 43. 저장 공간 경고: usage 85% 시 경고 알림 노출, 79% 시 미노출
  test('43. 저장 공간 80% 이상 사용 시 경고 토스트 노출 및 백업 버튼 동작 검증', async ({ browser }) => {
    // 1) 85% 사용량 모킹 -> 알림 노출
    const context85 = await browser.newContext();
    const page85 = await context85.newPage();
    await page85.addInitScript(() => {
      if (navigator.storage) {
        navigator.storage.estimate = async () => ({
          usage: 85 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        });
      }
    });

    await page85.goto('/');
    const warnToast = page85.locator('[role="status"]').getByText('브라우저 저장 공간이 거의 찼습니다');
    await expect(warnToast).toBeVisible({ timeout: 5000 });

    const backupActionBtn = page85.locator('[role="status"]').getByRole('button', { name: '백업 내려받기' });
    await expect(backupActionBtn).toBeVisible();
    await context85.close();

    // 2) 79% 사용량 모킹 -> 알림 미노출
    const context79 = await browser.newContext();
    const page79 = await context79.newPage();
    await page79.addInitScript(() => {
      if (navigator.storage) {
        navigator.storage.estimate = async () => ({
          usage: 79 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        });
      }
    });

    await page79.goto('/');
    await page79.waitForTimeout(1000); // 1초 대기 후에도 알림이 뜨지 않아야 함
    const warnToast79 = page79.locator('[role="status"]').getByText('브라우저 저장 공간이 거의 찼습니다');
    await expect(warnToast79).not.toBeVisible();
    await context79.close();
  });

  // 44. 임시 모드(IndexedDB 차단)에서 백업 내려받기 및 복원 검증
  test('44. 저장소(IndexedDB)가 차단된 임시 모드에서 전체 백업 및 복원 성공 확인', async ({ page }) => {
    // IndexedDB 차단 모킹
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        get() {
          throw new Error('IndexedDB blocked in temporary mode test');
        },
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1) 임시 모드 배너 확인
    const banner = page.locator('aside[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('자동 저장을 쓸 수 없습니다');

    // 2) 새 문서 생성 및 고유 문구 작성
    const newDocBtn = page.locator('header').getByRole('button', { name: '새 문서' });
    await newDocBtn.click();

    const uniqueSecret = '임시모드-백업테스트-고유코드-98765';
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type(`# 임시 모드 글\n${uniqueSecret}\n`);

    // 3) "내보내기" 메뉴 -> "전체 백업 내려받기" 실행
    const exportBtn = page.getByRole('button', { name: '내보내기' });
    await exportBtn.click();

    const backupMenuItem = page.getByRole('button', { name: '전체 백업 내려받기' });
    await expect(backupMenuItem).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      backupMenuItem.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^MarkView-백업-.*\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const fs = await import('fs');
    const backupRaw = fs.readFileSync(downloadPath!, 'utf-8');
    const parsedBackup = JSON.parse(backupRaw);

    // 백업 JSON 문서 목록에 고유 문구가 들어있는지 확인
    const hasSecretDoc = parsedBackup.documents.some((d: any) => d.content.includes(uniqueSecret));
    expect(hasSecretDoc).toBe(true);

    // 4) 그 JSON 파일로 "열기" -> "백업에서 복원…" 수행
    const fileInput = page.locator('input[type="file"][accept*="json"]');
    await fileInput.setInputFiles(downloadPath!);

    const restoreDialog = page.getByRole('dialog', { name: '백업 복원' });
    await expect(restoreDialog).toBeVisible();

    // 복원하기 클릭
    await restoreDialog.getByRole('button', { name: '복원하기' }).click();
    await expect(restoreDialog).not.toBeVisible();

    // 임시 모드 복원 안내 토스트 노출 확인
    const tempNoticeToast = page.locator('[role="status"]').getByText('이 환경에서는 자동 저장을 쓸 수 없어 복원한 글은 이 탭이 열려 있는 동안만 유지됩니다');
    await expect(tempNoticeToast).toBeVisible();

    // 기존 탭들이 유지되고 복원된 탭((복원) 접미사)이 추가되었는지 확인
    const restoredTabs = page.locator('nav').getByText(/\(복원\)/);
    await expect(restoredTabs.first()).toBeVisible();

    // 복원된 '새 문서 (복원)' 탭 클릭 시 본문에 고유 문구가 존재하는지 확인
    const restoredDocTab = page.locator('nav').getByText(/새 문서.*\(복원\)/);
    await expect(restoredDocTab).toBeVisible();
    await restoredDocTab.click();
    await expect(editor).toContainText(uniqueSecret);
  });

  test('45. 체크리스트 진행률 카드: 최상위 목록 통계 표시, 클릭 연동, Ctrl+Z 복원, 전체 완료 스타일', async ({ page }) => {
    // 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();

    const checklistDoc = `# 체크리스트 테스트
- [x] 첫 번째 작업
- [x] 두 번째 작업
- [ ] 세 번째 작업
- [ ] 네 번째 작업
- [ ] 다섯 번째 작업
`;
    await page.keyboard.insertText(checklistDoc);

    const progressCard = page.locator('.checklist-progress');
    await expect(progressCard).toBeVisible();
    await expect(progressCard).toContainText('체크리스트 2 / 5 완료');
    await expect(progressCard).toContainText('40%');

    const progressBar = progressCard.locator('progress');
    await expect(progressBar).toHaveAttribute('value', '2');
    await expect(progressBar).toHaveAttribute('max', '5');

    // 미리보기 세 번째 항목(- [ ])의 체크박스 클릭
    const checkboxes = page.locator('.preview-scroll .task-checkbox');
    await expect(checkboxes).toHaveCount(5);
    await checkboxes.nth(2).click();

    // 3 / 5 (60%) 갱신 확인
    await expect(progressCard).toContainText('체크리스트 3 / 5 완료');
    await expect(progressCard).toContainText('60%');
    await expect(progressBar).toHaveAttribute('value', '3');

    // 에디터 원문 확인
    await expect(editor).toContainText('- [x] 세 번째 작업');

    // Ctrl+Z 실행하여 되돌리기
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(progressCard).toContainText('체크리스트 2 / 5 완료');
    await expect(progressCard).toContainText('40%');
    await expect(progressBar).toHaveAttribute('value', '2');

    // 전체 완료 시뮬레이션: 세 번째, 네 번째, 다섯 번째 체크박스 순차 클릭 및 갱신 대기
    await checkboxes.nth(2).click();
    await expect(progressCard).toContainText('체크리스트 3 / 5 완료');
    await checkboxes.nth(3).click();
    await expect(progressCard).toContainText('체크리스트 4 / 5 완료');
    await checkboxes.nth(4).click();

    await expect(progressCard).toContainText('체크리스트 5 / 5 완료');
    await expect(progressCard).toContainText('100%');
    await expect(progressCard).toHaveAttribute('data-completed', 'true');
    await expect(progressCard).toHaveClass(/is-complete/);
  });

  test('46. 한글 굵은 글씨 보정: CJK 인접 강조 정상 렌더링 및 대조군 보존', async ({ page }) => {
    // 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();

    const markdown = `# CJK 강조 테스트
**"인용"**은 중요합니다.
**(괄호)**를 확인하세요.
**텍스트:**내용입니다.
핵심은 **"A"와 "B"**입니다.
~~취소:~~내용입니다.

대조군:
**bold** and *italic*
2 * 3 * 4
snake_case_word
홍길동_이력서_최종.pdf
\`**bold**\`
`;
    await page.keyboard.insertText(markdown);

    const preview = page.locator('.preview-scroll .markdown-body');
    await expect(preview).toBeVisible();

    // 5개 사례가 strong / s 태그로 렌더링되었는지 확인
    await expect(preview.locator('strong').getByText('"인용"')).toBeVisible();
    await expect(preview.locator('strong').getByText('(괄호)')).toBeVisible();
    await expect(preview.locator('strong').getByText('텍스트:')).toBeVisible();
    await expect(preview.locator('strong').getByText('"A"와 "B"')).toBeVisible();
    await expect(preview.locator('s').getByText('취소:')).toBeVisible();

    // 별표나 물결표가 본문 텍스트로 노출되지 않음
    const text = await preview.innerText();
    expect(text).not.toContain('**"인용"**');
    expect(text).not.toContain('**(괄호)**');
    expect(text).not.toContain('**텍스트:**');
    expect(text).not.toContain('~~취소:~~');

    // 대조군 확인
    await expect(preview.locator('strong').getByText('bold')).toBeVisible();
    await expect(preview.locator('em').getByText('italic')).toBeVisible();
    expect(text).toContain('2 * 3 * 4');
    expect(text).toContain('snake_case_word');
    expect(text).toContain('홍길동_이력서_최종.pdf');
    // 밑줄 회귀 방지: 홍길동_이력서_최종.pdf의 밑줄이 기울임(em)으로 변환되지 않음
    await expect(preview.locator('em', { hasText: '이력서' })).not.toBeVisible();
    await expect(preview.locator('code').getByText('**bold**')).toBeVisible();
  });

  test('47. 읽기 진행 막대와 맨 위로 버튼: 스크롤 진행률 연동, 부드러운 맨 위로 이동, 짧은 문서 비노출', async ({ page }) => {
    // 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();

    // 150줄 긴 문서 작성
    const longLines = ['# 긴 문서'];
    for (let i = 1; i <= 150; i++) {
      longLines.push(`- ${i}번째 긴 줄의 본문 내용입니다. 스크롤 테스트용 문장입니다.`);
    }
    await page.keyboard.insertText(longLines.join('\n') + '\n');

    const scroller = page.locator('.preview-scroll');
    await expect(scroller).toBeVisible();

    // 미리보기에 150번째 줄이 렌더링될 때까지 대기
    await expect(scroller.getByText('150번째 긴 줄')).toBeVisible();

    // 초기 상태(상단): 맨 위로 버튼 없음
    const topBtn = page.getByRole('button', { name: '맨 위로 이동' });
    await expect(topBtn).not.toBeVisible();

    // 마우스 휠로 스크롤을 아래로 1000px 내림
    await scroller.hover();
    await page.mouse.wheel(0, 1000);

    // 맨 위로 이동 버튼 표시 및 진행률 막대 확인
    await expect(topBtn).toBeVisible({ timeout: 5000 });
    const progressBar = page.locator('[role="progressbar"][aria-label="읽기 진행률"]');
    await expect(progressBar).toBeVisible();
    const valuenow = await progressBar.getAttribute('aria-valuenow');
    expect(Number(valuenow)).toBeGreaterThan(0);

    // 맨 위로 버튼 클릭
    await topBtn.click();

    // 맨 위로 스크롤되어 버튼 사라짐 및 scrollTop 0 도달 확인
    await expect(topBtn).not.toBeVisible({ timeout: 5000 });
    await expect.poll(async () => scroller.evaluate((el) => el.scrollTop), { timeout: 3000 }).toBeLessThanOrEqual(5);

    // 짧은 문서로 교체: 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();
    await page.keyboard.insertText('# 짧은 문서\n내용 한 줄뿐입니다.\n');
    await expect(scroller.getByText('내용 한 줄뿐입니다.')).toBeVisible();

    // 짧은 문서에서는 스크롤바가 없으므로 진행 막대와 맨 위로 버튼 미노출
    await expect(progressBar).not.toBeVisible();
    await expect(topBtn).not.toBeVisible();
  });

  test('48. 이미지 확대 보기 모달: 클릭 시 모달 열림, ESC 및 닫기 버튼으로 닫힘, 포커스 복귀', async ({ page }) => {
    // 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();

    // 1x1 투명 PNG 데이터 URL 이미지
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.keyboard.insertText(`![테스트 이미지](${dataUri})\n`);

    const previewImg = page.locator('.preview-scroll .markdown-body img').first();
    await expect(previewImg).toBeVisible();

    // 이미지 클릭
    await previewImg.click();

    // 이미지 확대 보기 대화상자 확인
    const dialog = page.getByRole('dialog', { name: '이미지 확대 보기' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('src', dataUri);
    await expect(dialog.getByText('테스트 이미지')).toBeVisible();

    // Esc 키 입력으로 모달 닫기
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // 원래 이미지로 포커스 복귀 확인
    await expect(previewImg).toBeFocused();

    // 다시 클릭 후 닫기 버튼으로 닫기
    await previewImg.click();
    await expect(dialog).toBeVisible();
    const closeBtn = dialog.getByRole('button', { name: '닫기' });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('49. 표 가장자리 +/− 편집: 끝 띠 행·열 추가, 경계 중간 삽입, 행·열 삭제, Ctrl+Z 복구, 호버 유지, HTML 내보내기 제외, 모바일 터치', async ({ page }) => {
    // 새 문서 열기
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();

    const tableDoc = `위쪽 문단 글자입니다.

| 이름 | 역할\\|부서 | 점수 |
| :--- | :---: | ---: |
| 홍길동 | 기획\\|A | 10 |
| 이순신 | 개발\\|B | 20 |

아래쪽 문단 글자입니다.
`;
    await page.keyboard.insertText(tableDoc);

    const table = page.locator('.preview-scroll table.editable-table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveCount(3);
    await expect(table.locator('tbody tr')).toHaveCount(2);

    // 표 본문 첫 셀 위로 마우스 이동
    await table.locator('tbody tr').nth(0).locator('td').first().hover();

    const appendRowBtn = page.getByRole('button', { name: '마지막에 행 추가' });
    const appendColBtn = page.getByRole('button', { name: '마지막에 열 추가' });
    const delRowInitial = page.getByRole('button', { name: '이 행 삭제' });
    const delColInitial = page.getByRole('button', { name: '이 열 삭제' });
    await expect(appendRowBtn).toBeVisible();
    await expect(appendColBtn).toBeVisible();
    await expect(delRowInitial).toBeVisible();
    await expect(delColInitial).toBeVisible();

    // 위·아래 문단 글자를 가리지 않는지 좌표 검증
    const topParaBox = await page.locator('.markdown-body p', { hasText: '위쪽 문단 글자입니다.' }).boundingBox();
    const bottomParaBox = await page.locator('.markdown-body p', { hasText: '아래쪽 문단 글자입니다.' }).boundingBox();
    const delColInitialBox = await delColInitial.boundingBox();
    const appendRowInitialBox = await appendRowBtn.boundingBox();
    expect(topParaBox).toBeTruthy();
    expect(bottomParaBox).toBeTruthy();
    expect(delColInitialBox).toBeTruthy();
    expect(appendRowInitialBox).toBeTruthy();
    if (topParaBox && delColInitialBox) {
      expect(delColInitialBox.y).toBeGreaterThanOrEqual(topParaBox.y + topParaBox.height);
    }
    if (bottomParaBox && appendRowInitialBox) {
      expect(appendRowInitialBox.y + appendRowInitialBox.height).toBeLessThanOrEqual(bottomParaBox.y);
    }

    // 다크 모드에서도 문단 글자 비겹침 및 컨트롤 가시성 확인 후 라이트 모드로 복귀
    await page.getByRole('button', { name: '보기 설정' }).click();
    await page.getByRole('button', { name: 'GitHub 다크', exact: true }).click();
    await page.keyboard.press('Escape');
    await table.locator('tbody tr').nth(0).locator('td').first().hover();
    await expect(appendRowBtn).toBeVisible();
    await expect(delColInitial).toBeVisible();

    await page.getByRole('button', { name: '보기 설정' }).click();
    await page.getByRole('button', { name: 'GitHub 라이트', exact: true }).click();
    await page.keyboard.press('Escape');
    await table.hover();

    // ⑧ 버튼으로 마우스를 옮기는 동안 사라지지 않음 + ① 표 아래 띠 클릭 -> 행 추가
    const appendRowBox = await appendRowBtn.boundingBox();
    expect(appendRowBox).toBeTruthy();
    if (appendRowBox) {
      await page.mouse.move(
        appendRowBox.x + appendRowBox.width / 2,
        appendRowBox.y + appendRowBox.height / 2,
        { steps: 8 },
      );
    }
    await expect(appendRowBtn).toBeVisible();
    await appendRowBtn.click();

    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(editor).toContainText('|  |  |  |');

    // ② 오른쪽 띠 클릭 -> 열 추가 (마우스를 옮기는 동안 사라지지 않음 확인 포함)
    await table.hover();
    await expect(appendColBtn).toBeVisible();
    const appendColBox = await appendColBtn.boundingBox();
    expect(appendColBox).toBeTruthy();
    if (appendColBox) {
      await page.mouse.move(
        appendColBox.x + appendColBox.width / 2,
        appendColBox.y + appendColBox.height / 2,
        { steps: 8 },
      );
    }
    await expect(appendColBtn).toBeVisible();
    await appendColBtn.click();

    await expect(table.locator('thead th')).toHaveCount(4);
    await expect(editor).toContainText('| 이름 | 역할\\|부서 | 점수 |  |');

    // ③ 행 경계 +로 중간 삽입 (헤더 위쪽에는 나타나지 않고, 첫 본문 행과 둘째 본문 행 사이 경계에서 삽입)
    const headRowBox = await table.locator('thead tr').first().boundingBox();
    expect(headRowBox).toBeTruthy();
    if (headRowBox) {
      // 헤더 행 맨 위쪽 경계에 마우스를 가져가도 행 사이 추가 버튼은 뜨지 않아야 함
      await page.mouse.move(headRowBox.x + headRowBox.width / 2, headRowBox.y);
      await expect(page.getByRole('button', { name: '행 사이에 행 추가' })).not.toBeVisible();
    }

    const firstBodyRow = table.locator('tbody tr').nth(0);
    const firstBodyBox = await firstBodyRow.boundingBox();
    expect(firstBodyBox).toBeTruthy();
    if (firstBodyBox) {
      // 첫 번째 본문 행(홍길동)과 두 번째 본문 행(이순신) 사이 경계로 마우스 이동
      await page.mouse.move(
        firstBodyBox.x + firstBodyBox.width / 2,
        firstBodyBox.y + firstBodyBox.height,
        { steps: 5 },
      );
    }
    const insertRowBetweenBtn = page.getByRole('button', { name: '행 사이에 행 추가' });
    await expect(insertRowBetweenBtn).toBeVisible();
    // 경계에서 원형 + 버튼으로 마우스를 옮기는 동안 사라지지 않음 확인
    const insertRowBtnBox = await insertRowBetweenBtn.boundingBox();
    expect(insertRowBtnBox).toBeTruthy();
    if (insertRowBtnBox) {
      await page.mouse.move(
        insertRowBtnBox.x + insertRowBtnBox.width / 2,
        insertRowBtnBox.y + insertRowBtnBox.height / 2,
        { steps: 6 },
      );
    }
    await expect(insertRowBetweenBtn).toBeVisible();
    await insertRowBetweenBtn.click();

    // 본문 행이 4개가 되고, 0번째는 홍길동, 1번째(끼워 넣은 행)는 빈 칸, 2번째는 이순신인지 확인
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(table.locator('tbody tr').nth(0).locator('td').first()).toHaveText('홍길동');
    await expect(table.locator('tbody tr').nth(1).locator('td').first()).toHaveText('');
    await expect(table.locator('tbody tr').nth(2).locator('td').first()).toHaveText('이순신');

    // ④ 열 경계 +로 중간 삽입 (첫 번째 열과 두 번째 열 사이 경계)
    const firstTh = table.locator('thead th').nth(0);
    const firstThBox = await firstTh.boundingBox();
    expect(firstThBox).toBeTruthy();
    if (firstThBox) {
      await page.mouse.move(
        firstThBox.x + firstThBox.width,
        firstThBox.y + firstThBox.height / 2,
        { steps: 5 },
      );
    }
    const insertColBetweenBtn = page.getByRole('button', { name: '열 사이에 열 추가' });
    await expect(insertColBetweenBtn).toBeVisible();
    const insertColBtnBox = await insertColBetweenBtn.boundingBox();
    expect(insertColBtnBox).toBeTruthy();
    if (insertColBtnBox) {
      await page.mouse.move(
        insertColBtnBox.x + insertColBtnBox.width / 2,
        insertColBtnBox.y + insertColBtnBox.height / 2,
        { steps: 6 },
      );
    }
    await expect(insertColBetweenBtn).toBeVisible();
    await insertColBetweenBtn.click();

    // 열이 5개가 되고, 0번째 헤더는 '이름', 1번째(끼워 넣은 열) 헤더는 빈 칸, 2번째 헤더는 '역할|부서'
    await expect(table.locator('thead th')).toHaveCount(5);
    await expect(table.locator('thead th').nth(0)).toHaveText('이름');
    await expect(table.locator('thead th').nth(1)).toHaveText('');
    await expect(table.locator('thead th').nth(2)).toHaveText('역할|부서');

    // ⑤ 행 − 로 삭제 (헤더 행에서는 행 삭제 버튼을 숨기고, 본문 행에서만 표시)
    await table.locator('thead th').first().hover();
    await expect(page.getByRole('button', { name: '이 행 삭제' })).not.toBeVisible();

    // 두 번째 본문 행(방금 끼워 넣은 빈 행)에 호버 후 왼쪽 바깥 "－" 클릭하여 삭제
    await table.locator('tbody tr').nth(1).locator('td').first().hover();
    const deleteRowBtn = page.getByRole('button', { name: '이 행 삭제' });
    await expect(deleteRowBtn).toBeVisible();
    await deleteRowBtn.click();

    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.locator('tbody tr').nth(0).locator('td').first()).toHaveText('홍길동');
    await expect(table.locator('tbody tr').nth(1).locator('td').first()).toHaveText('이순신');

    // ⑥ 열 − 로 삭제 (두 번째 빈 열에 호버 후 위쪽 바깥 "－" 클릭하여 삭제)
    await table.locator('thead th').nth(1).hover();
    const deleteColBtn = page.getByRole('button', { name: '이 열 삭제' });
    await expect(deleteColBtn).toBeVisible();
    await deleteColBtn.click();

    await expect(table.locator('thead th')).toHaveCount(4);
    await expect(table.locator('thead th').nth(0)).toHaveText('이름');
    await expect(table.locator('thead th').nth(1)).toHaveText('역할|부서');

    // ⑦ 삭제 후 Ctrl+Z로 복구 (한 번의 트랜잭션으로 복구 및 정렬 표기 :--- / :---: / ---: · \| 보존 확인)
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(table.locator('thead th')).toHaveCount(5);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(table.locator('tbody tr')).toHaveCount(4);

    // 정렬 표기와 이스케이프된 파이프가 원문에 그대로 보존되어 있는지 확인
    await expect(editor).toContainText('| :--- | --- | :---: | ---: | --- |');
    await expect(editor).toContainText('역할\\|부서');
    await expect(editor).toContainText('기획\\|A');

    // ⑨ 내보낸 HTML에 이 버튼이 없음
    await table.hover();
    await expect(appendRowBtn).toBeVisible();

    const exportMenuBtn = page.getByRole('button', { name: '내보내기' });
    await exportMenuBtn.click();
    const htmlExportItem = page.getByRole('button', { name: 'HTML 파일 (오프라인용)' });
    await expect(htmlExportItem).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      htmlExportItem.click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const fs = await import('fs');
    const exportedHtml = fs.readFileSync(downloadPath!, 'utf-8');
    expect(exportedHtml).toContain('<table');
    expect(exportedHtml).not.toContain('table-edge-controls');
    expect(exportedHtml).not.toContain('마지막에 행 추가');
    expect(exportedHtml).not.toContain('마지막에 열 추가');
    expect(exportedHtml).not.toContain('행 사이에 행 추가');
    expect(exportedHtml).not.toContain('열 사이에 열 추가');
    expect(exportedHtml).not.toContain('이 행 삭제');
    expect(exportedHtml).not.toContain('이 열 삭제');

    // 마지막 칸(1행·1열) 삭제 비활성화 및 툴팁 확인
    await page.locator('button[title="새 문서"]').first().click();
    await expect(page.locator('.cm-placeholder')).toBeVisible();
    await editor.click();
    await page.keyboard.insertText(`| 단일열 |\n| --- |\n| 값1 |\n`);

    const singleTable = page.locator('.preview-scroll table.editable-table');
    await expect(singleTable).toBeVisible();
    await singleTable.locator('tbody td').first().hover();
    await expect(deleteRowBtn).toBeVisible();
    await expect(deleteRowBtn).toBeDisabled();
    await expect(deleteRowBtn).toHaveAttribute('title', '마지막 칸은 삭제할 수 없습니다');
    await expect(deleteColBtn).toBeVisible();
    await expect(deleteColBtn).toBeDisabled();
    await expect(deleteColBtn).toHaveAttribute('title', '마지막 칸은 삭제할 수 없습니다');

    // 모바일 폭(375px)에서 표를 터치(클릭)하면 끝 "＋" 띠가 보이게 함
    await page.setViewportSize({ width: 375, height: 667 });
    // 모바일에서는 미리보기 모드로 전환하여 확인
    await page.getByRole('button', { name: '미리보기' }).click();
    await expect(singleTable).toBeVisible();
    await singleTable.locator('tbody td').first().click();
    await expect(appendRowBtn).toBeVisible();
    await expect(appendColBtn).toBeVisible();
  });

  test('50. Firefox·Brave 가상 디렉터리 폴더 열기: webkitdirectory 선택, 읽기 전용 안내, 중복 방지, Brave 플래그 안내', async ({ page }, testInfo) => {
    // 1. showDirectoryPicker 및 File System Access API가 없는 Firefox/Brave 읽기 전용 환경 에뮬레이션
    await page.addInitScript(() => {
      // @ts-ignore
      delete window.showDirectoryPicker;
      // @ts-ignore
      delete window.showSaveFilePicker;
      // @ts-ignore
      delete window.showOpenFilePicker;
    });
    await page.goto('/');

    // 2. '열기' 드롭다운 메뉴 열기
    const openMenuBtn = page.getByRole('button', { name: '열기' });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();

    // '폴더 열기' 메뉴 항목이 활성화되어 있는지 확인
    const openFolderItem = page.getByRole('button', { name: '폴더 열기' });
    await expect(openFolderItem).toBeVisible();
    await expect(openFolderItem).toBeEnabled();

    // 파일 선택(filechooser) 이벤트 대기 설정
    const fileChooserPromise = page.waitForEvent('filechooser');
    await openFolderItem.click();
    const fileChooser = await fileChooserPromise;

    // 가상 폴더 내 파일 디렉터리 경로 전달 (Playwright webkitdirectory 지원)
    await fileChooser.setFiles(path.resolve('e2e/fixtures/test-folder'));

    // 읽기 전용 안내 토스트 노출 확인
    const readonlyToast = page.getByText('이 브라우저에서는 폴더 안 파일을 직접 덮어쓸 수 없어 다운로드로 저장됩니다');
    await expect(readonlyToast).toBeVisible({ timeout: 5000 });

    // 폴더 열림 성공 토스트 및 파일 트리 탭 확인
    await expect(page.getByText('폴더를 열었습니다.')).toBeVisible();

    // 파일 트리의 파일 목록 확인
    const fileTree = page.locator('aside');
    await expect(fileTree).toBeVisible();
    const introFileItem = fileTree.getByText('intro.md');
    const guideFileItem = fileTree.getByText('guide.md');
    await expect(introFileItem).toBeVisible();
    await expect(guideFileItem).toBeVisible();

    // intro.md 파일 클릭하여 탭으로 열기
    await introFileItem.click();
    await expect(page.locator('.cm-content')).toContainText('가상 폴더 첫 번째 파일입니다.');

    // 같은 intro.md 파일을 다시 클릭했을 때 탭이 중복 생성되지 않고 1개만 유지되는지 확인
    const introTab = page.locator('nav').getByText('intro.md');
    await expect(introTab).toHaveCount(1);
    await introFileItem.click();
    await expect(introTab).toHaveCount(1);

    // 가상 폴더 파일 저장 시도: 다운로드로 처리되고 안내 유지 확인
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('intro.md');

    // 3. Brave 브라우저 플래그 안내 토스트 및 [주소 복사] 버튼 동작 검증
    // Brave 모킹 주입 후 새 페이지 열기
    if (testInfo.project.name === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const bravePage = await page.context().newPage();
    await bravePage.addInitScript(() => {
      // @ts-ignore
      delete window.showDirectoryPicker;
      // @ts-ignore
      delete window.showSaveFilePicker;
      // @ts-ignore
      delete window.showOpenFilePicker;
      // @ts-ignore
      navigator.brave = { isBrave: async () => true };
    });
    await bravePage.goto('/');

    const braveOpenBtn = bravePage.getByRole('button', { name: '열기' });
    await braveOpenBtn.click();
    const braveFolderItem = bravePage.getByRole('button', { name: '폴더 열기' });

    // Brave 환경에서 폴더 열기 클릭 시 플래그 안내 토스트 노출
    await braveFolderItem.click();
    const braveToast = bravePage.getByText('Brave에서는 주소창에 brave://flags/#file-system-access-api 를 입력해 사용 설정하면 폴더 저장까지 됩니다');
    await expect(braveToast).toBeVisible({ timeout: 5000 });

    // [주소 복사] 버튼 클릭
    const copyAddrBtn = bravePage.getByRole('button', { name: '주소 복사' });
    await expect(copyAddrBtn).toBeVisible();
    await copyAddrBtn.click();

    // 복사 완료 토스트 확인
    await expect(bravePage.getByText('주소를 복사했습니다.')).toBeVisible();
    await bravePage.close();
  });

  // 51. 문서 템플릿 갤러리: 카테고리 필터링, 검색, 미리보기 및 오늘 날짜 치환 새 문서 생성
  test('51. 템플릿 갤러리 카테고리 필터링, 한글 검색, 실시간 미리보기 및 날짜 치환 새 문서 생성', async ({ page }) => {
    // 1. 헤더의 '템플릿' 버튼을 클릭하여 템플릿 갤러리 모달 오픈
    const templateBtn = page.locator('button[title="템플릿"]').first();
    await expect(templateBtn).toBeVisible();
    await templateBtn.click();

    const dialog = page.getByRole('dialog', { name: '문서 템플릿 갤러리' });
    await expect(dialog).toBeVisible();

    // 2. 카테고리 목록 및 개수 뱃지 확인
    const categoriesContainer = dialog.locator('[data-testid="template-categories"]');
    await expect(categoriesContainer).toBeVisible();
    // '전체' 뱃지에 35개 이상 수량 표시 확인
    const allCatBtn = categoriesContainer.locator('button[data-category="전체"]');
    await expect(allCatBtn).toBeVisible();

    // 3. '개발' 카테고리 클릭 필터링
    const devCatBtn = categoriesContainer.locator('button[data-category="개발"]');
    await expect(devCatBtn).toBeVisible();
    await devCatBtn.click();

    // 개발 템플릿 목록 노출 확인 (예: API 문서, README 기본형 등)
    const listContainer = dialog.locator('[data-testid="template-list"]');
    await expect(listContainer.getByText('API 문서')).toBeVisible();
    await expect(listContainer.getByText('README 기본형')).toBeVisible();

    // 4. 검색창에 검색어 입력 필터링
    const searchInput = dialog.locator('[data-testid="template-search-input"]');
    await searchInput.fill('API');

    // 검색 결과로 'API 문서'만 남고 'README 기본형'은 사라짐 확인
    await expect(listContainer.getByText('API 문서')).toBeVisible();
    await expect(listContainer.getByText('README 기본형')).not.toBeVisible();

    // 5. 'API 문서' 카드 클릭 선택 및 미리보기 확인
    const apiDocCard = listContainer.locator('button[data-template-id="api-specification"]');
    await apiDocCard.click();

    const preview = dialog.locator('[data-testid="template-preview-content"]');
    await expect(preview).toBeVisible();
    await expect(preview.getByText('API 명세서: (서비스명)')).toBeVisible();

    // 6. '이 템플릿으로 새 문서' 버튼 클릭하여 문서 생성
    const applyBtn = dialog.locator('[data-testid="template-apply-button"]');
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();

    // 모달 닫힘 확인
    await expect(dialog).not.toBeVisible();

    // 7. 새 문서 탭 생성 및 에디터 내용 검증
    const newTab = page.locator('nav').getByText('API 문서.md');
    await expect(newTab).toBeVisible();

    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('API 명세서: (서비스명)');
    await expect(editor).toContainText('공통 응답 규격');

    // {{날짜}} 자리표시자가 남아있지 않고 오늘 날짜가 적용되었는지 확인
    const editorText = await editor.innerText();
    expect(editorText).not.toContain('{{날짜}}');
    expect(editorText).not.toContain('{{');
  });

  // 52. 템플릿 갤러리 다이어그램(Mermaid) 5종 SVG 렌더링 무결성 및 카테고리별 서식 미리보기 검증
  test('52. 템플릿 갤러리 내 Mermaid 포함 5개 템플릿 전체 SVG 정상 렌더링 및 문법 오류 없음 확인', async ({ page }) => {
    const templateBtn = page.locator('button[title="템플릿"]').first();
    await expect(templateBtn).toBeVisible();
    await templateBtn.click();

    const dialog = page.getByRole('dialog', { name: '문서 템플릿 갤러리' });
    await expect(dialog).toBeVisible();

    const listContainer = dialog.locator('[data-testid="template-list"]');
    const preview = dialog.locator('[data-testid="template-preview-content"]');

    // Mermaid 코드 블록이 들어 있는 5개 템플릿 이름을 명시 (단위 테스트에서 개수 5개와 동기화 검증)
    const mermaidTemplateNames = [
      '프로세스 문서',
      '프로젝트 일정표(gantt/표)',
      '순서도 예시',
      '시퀀스 다이어그램 예시',
      '조직도(mermaid)',
    ];

    for (const name of mermaidTemplateNames) {
      const card = listContainer.locator('button').filter({ hasText: name }).first();
      await card.scrollIntoViewIfNeeded();
      await card.click();

      // 선택된 템플릿으로 미리보기가 전환되었는지 확인
      await expect(dialog.getByText(`> ${name}`)).toBeVisible();

      // 미리보기에 .mermaid-block svg가 정상 생성되고 문법 오류가 없는지 확인
      const svg = preview.locator('.mermaid-block svg').first();
      await expect(svg).toBeVisible({ timeout: 10000 });
      await expect(preview.locator('.mermaid-error')).toHaveCount(0);
      await expect(preview).not.toContainText('다이어그램 문법 오류');
      await expect(preview).not.toContainText('Parse error');
    }

    // 카테고리별 대표 템플릿 미리보기 렌더링 점검 (표, 수식, 콜아웃, 체크리스트)
    const sampleChecks: Array<{ name: string; selector: string }> = [
      { name: '업무 인수인계서', selector: 'table' },
      { name: '견적서·제안 요약', selector: '.callout' },
      { name: 'README 기본형', selector: 'pre code' },
      { name: '코드 리뷰 체크리스트', selector: '.checklist-progress' },
      { name: '여행 계획', selector: '.checklist-progress' },
      { name: '가계부(월별 표)', selector: 'table' },
      { name: '강의 노트(코넬식)', selector: '.katex' },
      { name: '논문 읽기 노트', selector: '.math-block .katex' },
      { name: '수학 공식 정리(수식 KaTeX)', selector: '.math-block .katex' },
      { name: '블로그 글 초안', selector: '.callout' },
      { name: '이력서', selector: 'table' },
      { name: '월간 계획', selector: '.checklist-progress' },
      { name: '주간 식단표', selector: 'table' },
      { name: '마인드맵형 정리(목록 중첩)', selector: 'table' },
    ];

    for (const item of sampleChecks) {
      const card = listContainer.locator('button').filter({ hasText: item.name }).first();
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await expect(dialog.getByText(`> ${item.name}`)).toBeVisible();
      await expect(preview.locator(item.selector).first()).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  // 53. 미리보기 전용 모드에서 Ctrl+F 검색, 개수 표시, 다음/이전, 편집 시 자동 갱신, Esc 닫기
  test('53. 미리보기 전용 모드에서 Ctrl+F로 문서 내 검색, 개수 표시, 다음/이전 이동 및 Esc 닫기 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    const docText = [
      '# 미리보기 검색 문서',
      '',
      '첫 번째 사과가 문단에 있습니다.',
      '',
      '```ts',
      'const item = "두 번째 사과";',
      '```',
      '',
      '| 번호 | 품목 |',
      '| --- | --- |',
      '| 3 | 세 번째 사과 |',
    ].join('\n');
    await page.keyboard.insertText(docText);

    // 미리보기 렌더링 완료 대기
    await expect(page.locator('.markdown-body table')).toBeVisible();

    // 미리보기 전용 모드로 전환
    await page.getByRole('button', { name: '미리보기', exact: true }).click();

    // Ctrl+F로 미리보기 검색 막대 열기
    await page.keyboard.press('ControlOrMeta+f');
    const searchBar = page.getByRole('search', { name: '미리보기 문서 내 검색' });
    await expect(searchBar).toBeVisible();

    const searchInput = page.getByRole('textbox', { name: '미리보기 검색어 입력' });
    await expect(searchInput).toBeFocused();

    // 한글 검색어 입력 -> 문단, 코드블록, 표 안의 3개 모두 검출
    await searchInput.fill('사과');
    const countBadge = searchBar.getByRole('status', { name: '검색 결과 개수' });
    await expect(countBadge).toHaveText('1 / 3');

    // Enter로 다음 이동, Shift+Enter로 이전 이동
    await page.keyboard.press('Enter');
    await expect(countBadge).toHaveText('2 / 3');
    await page.keyboard.press('Enter');
    await expect(countBadge).toHaveText('3 / 3');
    await page.keyboard.press('Enter');
    await expect(countBadge).toHaveText('1 / 3');
    await page.keyboard.press('Shift+Enter');
    await expect(countBadge).toHaveText('3 / 3');

    // 이전/다음 버튼 클릭 확인
    await searchBar.getByRole('button', { name: '이전 검색 결과' }).click();
    await expect(countBadge).toHaveText('2 / 3');
    await searchBar.getByRole('button', { name: '다음 검색 결과' }).click();
    await expect(countBadge).toHaveText('3 / 3');

    // 분할 모드로 전환 후 본문을 편집했을 때 검색 개수가 자동 갱신되는지 확인
    await page.getByRole('button', { name: '분할', exact: true }).click();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n\n네 번째 사과 추가');
    await expect(countBadge).toHaveText('3 / 4');

    // Esc로 검색 닫기
    await searchInput.click();
    await page.keyboard.press('Escape');
    await expect(searchBar).not.toBeVisible();
  });

  // 54. 목차 검색 + 깊이 필터 + 접기
  test('54. 목차 검색, 깊이 필터(전체/H2까지/H3까지 설정 유지), 하위 제목 접기/펼치기 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    const md = [
      '# 1장 개요',
      '본문 1',
      '## 1.1 배경 설명',
      '본문 1.1',
      '### 세부 배경 A',
      '본문 A',
      '## 1.2 핵심 목표',
      '본문 1.2',
      '### 세부 목표 B',
      '본문 B',
    ].join('\n');
    await page.keyboard.insertText(md);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('button', { name: '1장 개요', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1.1 배경 설명', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1.2 핵심 목표', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 목표 B', exact: true })).toBeVisible();

    // 1) 하위 제목 접기 / 펼치기
    await sidebar.getByRole('button', { name: '1.1 배경 설명 접기' }).click();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1.2 핵심 목표', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 목표 B', exact: true })).toBeVisible();

    await sidebar.getByRole('button', { name: '1.1 배경 설명 펼치기' }).click();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).toBeVisible();

    // 2) 깊이 필터 "H2까지" 선택 및 새로고침 후 유지 확인
    await sidebar.getByRole('button', { name: 'H2까지', exact: true }).click();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 목표 B', exact: true })).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1.1 배경 설명', exact: true })).toBeVisible();

    await page.waitForTimeout(600);
    await page.reload();
    await expect(sidebar.getByRole('button', { name: '1.1 배경 설명', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).not.toBeVisible();

    // 다시 "전체"로 복구
    await sidebar.getByRole('button', { name: '전체', exact: true }).click();
    await expect(sidebar.getByRole('button', { name: '세부 배경 A', exact: true })).toBeVisible();

    // 3) 목차 검색 (한글 부분 일치)
    const tocSearch = sidebar.getByRole('textbox', { name: '목차 검색' });
    await tocSearch.fill('목표');
    await expect(sidebar.getByRole('button', { name: '1.2 핵심 목표', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '세부 목표 B', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '1.1 배경 설명', exact: true })).not.toBeVisible();
  });

  // 55. 저장 상태 글자가 편집 직후 "저장 중…" -> "자동 저장됨 HH:MM"으로 바뀜 + 모바일 폭 비넘침 확인
  test('55. 저장 상태 표시: 편집 직후 "저장 중…"에서 "자동 저장됨"으로 전환 및 모바일(375px) 폭 확인', async ({ page }) => {
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    await page.keyboard.type('저장 상태 변화 확인용 텍스트');

    // 편집 직후 "저장 중…" 표시 확인
    const nav = page.locator('nav');
    await expect(nav.getByText('저장 중…')).toBeVisible();

    // 자동 저장 완료 후 "자동 저장됨 HH:MM"으로 전환 확인
    await expect(nav.getByText(/자동 저장됨 \d{2}:\d{2}/)).toBeVisible({ timeout: 3000 });

    // 모바일 폭(375px)에서 헤더와 탭 줄이 가로로 넘치지 않는지 검증
    await page.setViewportSize({ width: 375, height: 800 });
    const headerOverflow = await page.locator('header').evaluate((el) => el.scrollWidth > el.clientWidth);
    const navOverflow = await nav.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(headerOverflow).toBe(false);
    expect(navOverflow).toBe(false);
  });

  // 56. 줄 간격·정렬·글꼴·테마 변경이 본문 계산 스타일에 반영되고 재시작 후에도 유지
  test('56. 읽기 설정(줄 간격·정렬·글꼴·코드블록 줄바꿈·테마) 본문 반영, 재시작 후 유지 및 초기화 확인', async ({ page }) => {
    await page.locator('header button[title="보기 설정"]').click();

    // 테마: Dracula 선택
    await page.getByRole('button', { name: 'Dracula', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');

    // 본문 정렬: 양쪽
    await page.getByRole('button', { name: '양쪽', exact: true }).click();

    // 본문 글꼴: 고정폭
    await page.getByRole('button', { name: '고정폭', exact: true }).click();

    // 코드블록 줄바꿈 켜기
    await page.getByLabel('코드블록 줄바꿈').click();

    // 줄 간격 슬라이더 변경 (기본 1.75에서 ArrowRight 5회 -> 2.00)
    const lineHeightSlider = page.getByRole('slider', { name: '줄 간격' });
    await lineHeightSlider.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }

    // 설정 팝오버 닫기
    await page.keyboard.press('Escape');

    // 본문(.markdown-body) 계산 스타일 확인
    const bodyStyle = await page.locator('.markdown-body').evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const lineHeight = parseFloat(cs.lineHeight);
      return {
        textAlign: cs.textAlign,
        fontFamily: cs.fontFamily.toLowerCase(),
        lineHeightRatio: Math.round((lineHeight / fontSize) * 100) / 100,
        hasCodeWrap: el.classList.contains('code-wrap'),
      };
    });

    expect(bodyStyle.textAlign).toBe('justify');
    expect(bodyStyle.fontFamily).toContain('monospace');
    expect(bodyStyle.lineHeightRatio).toBeCloseTo(2, 1);
    expect(bodyStyle.hasCodeWrap).toBe(true);

    // 새로고침 후에도 설정이 그대로 유지되는지 확인
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');

    const reloadedStyle = await page.locator('.markdown-body').evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const lineHeight = parseFloat(cs.lineHeight);
      return {
        textAlign: cs.textAlign,
        fontFamily: cs.fontFamily.toLowerCase(),
        lineHeightRatio: Math.round((lineHeight / fontSize) * 100) / 100,
        hasCodeWrap: el.classList.contains('code-wrap'),
      };
    });
    expect(reloadedStyle.textAlign).toBe('justify');
    expect(reloadedStyle.fontFamily).toContain('monospace');
    expect(reloadedStyle.lineHeightRatio).toBeCloseTo(2, 1);
    expect(reloadedStyle.hasCodeWrap).toBe(true);

    // 설정 초기화 버튼 동작 확인
    await page.locator('header button[title="보기 설정"]').click();
    await page.getByRole('button', { name: '설정 초기화' }).click();
    await page.keyboard.press('Escape');

    const resetStyle = await page.locator('.markdown-body').evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        textAlign: cs.textAlign,
        hasCodeWrap: el.classList.contains('code-wrap'),
      };
    });
    expect(resetStyle.textAlign).toBe('left');
    expect(resetStyle.hasCodeWrap).toBe(false);
  });

  // 57. 모든 테마(8종 프리셋)에서 본문 글자 대비(배경 대비 4.5:1 이상)를 계산으로 검증
  test('57. 8종 테마 프리셋 전체에서 본문 배경 대비 본문 글자 명도 대비(>=4.5:1) 검증', async ({ page }) => {
    const presetNames = [
      'GitHub 라이트',
      'GitHub 다크',
      'Dracula',
      'Nord',
      'Sepia',
      'Monokai',
      'Tokyo Night',
      'Forest',
    ];

    await page.locator('header button[title="보기 설정"]').click();

    for (const presetName of presetNames) {
      await page.getByRole('button', { name: presetName, exact: true }).click();

      const contrastInfo = await page.evaluate(() => {
        function parseRgb(str: string) {
          const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
          return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : { r: 0, g: 0, b: 0 };
        }
        function lum({ r, g, b }: { r: number; g: number; b: number }) {
          const [rs, gs, bs] = [r, g, b].map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        }
        function ratio(c1: string, c2: string) {
          const l1 = lum(parseRgb(c1));
          const l2 = lum(parseRgb(c2));
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        }

        const bodyEl = document.querySelector('.markdown-body')!;
        const paneEl = document.querySelector('.preview-pane')!;
        const headerEl = document.querySelector('header')!;

        const docText = window.getComputedStyle(bodyEl).color;
        const docBg = window.getComputedStyle(paneEl).backgroundColor;
        const uiText = window.getComputedStyle(headerEl).color;
        const uiBg = window.getComputedStyle(headerEl).backgroundColor;

        return {
          docBg,
          docText,
          docContrast: ratio(docBg, docText),
          uiContrast: ratio(uiBg, uiText),
        };
      });

      expect(
        contrastInfo.docContrast,
        `[${presetName}] 본문 대비(${contrastInfo.docContrast.toFixed(2)})는 4.5 이상이어야 함`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastInfo.uiContrast,
        `[${presetName}] 헤더 UI 대비(${contrastInfo.uiContrast.toFixed(2)})는 4.5 이상이어야 함`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    await page.keyboard.press('Escape');
  });

  // 58. 수식 템플릿 갤러리: 모달 열기, 검색, 수식 선택 삽입 및 Ctrl+Z 취소 확인
  test('58. 수식 템플릿 갤러리: 모달 열기, 검색, 수식 선택 삽입 및 Ctrl+Z 취소 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 에디터 도구 막대의 "수식 삽입" 버튼 클릭
    const mathBtn = page.locator('button[title="수식 삽입"]');
    await expect(mathBtn).toBeVisible();
    await mathBtn.click();

    // 수식 템플릿 갤러리 모달 노출 확인
    const dialog = page.locator('div[role="dialog"][aria-label="수식 템플릿 갤러리"]');
    await expect(dialog).toBeVisible();

    // 검색창에 "근의 공식" 입력
    const searchInput = dialog.locator('input[type="text"]');
    await searchInput.fill('근의 공식');

    // 검색된 카드 클릭
    const formulaCard = dialog.getByRole('button', { name: /이차방정식 근의 공식/ }).first();
    await expect(formulaCard).toBeVisible();
    await formulaCard.click();

    // 모달 닫힘 확인
    await expect(dialog).not.toBeVisible();

    // 에디터에 수식 코드가 삽입되었는지 확인
    await expect(editor).toContainText('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');

    // 미리보기에 KaTeX 수식이 렌더링되었는지 확인
    const katexEl = page.locator('.markdown-body .katex');
    await expect(katexEl).toBeVisible();

    // Ctrl+Z로 1회 실행 취소하여 수식 삽입 전으로 복원 확인
    await editor.click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor).not.toContainText('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  });

  // 59. 다이어그램 템플릿 갤러리: 20종 전체 SVG 렌더링 무결성 및 삽입 확인
  test('59. 다이어그램 템플릿 갤러리: 20종 전체 SVG 렌더링 무결성 및 삽입 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 도구 막대의 "다이어그램 삽입" 버튼 클릭
    const diagramBtn = page.locator('button[title="다이어그램 삽입"]');
    await expect(diagramBtn).toBeVisible();
    await diagramBtn.click();

    // 다이어그램 템플릿 갤러리 모달 노출 확인
    const dialog = page.locator('div[role="dialog"][aria-label="다이어그램 템플릿 갤러리"]');
    await expect(dialog).toBeVisible();

    // 20개 예시 전체 목록 (이름을 테스트 안에 명시)
    const expectedDiagramNames = [
      '업무 기안 및 결재 프로세스',
      '로그인 및 2단계 인증 분기',
      'CI/CD 자동 빌드·배포 파이프라인',
      '서비스 장애 감지 및 대응 절차',
      '온라인 결제 승인 흐름',
      'JWT 로그인 및 API 인가',
      '고객 문의 챗봇 및 상담원 연결',
      '주문·결제 도메인 클래스 구조',
      '회원 권한 및 역할 상속 구조',
      '쇼핑몰 주문·배송 상태 전이도',
      '이슈 티켓 생명주기 상태도',
      '전자상거래 핵심 데이터베이스 ERD',
      '블로그 게시글·댓글·작성자 ERD',
      '신규 서비스 4주 출시 로드맵',
      '애자일 2주 스프린트 일정표',
      '연간 IT 인프라 예산 비중',
      '서비스 유입 채널 점유율',
      '신규 프로덕트 기획 마인드맵',
      '웹 프론트엔드 학습 로드맵',
      '서비스 분기별 주요 마일스톤 타임라인',
    ];

    // 각 예시 카드를 순서대로 클릭하며 오른쪽 미리보기에 SVG가 오류 없이 렌더링되는지 확인
    for (const name of expectedDiagramNames) {
      const card = dialog.locator('button', { hasText: name }).first();
      await expect(card).toBeVisible();
      await card.click();

      // 미리보기 영역에 SVG 렌더링 및 에러 부재 검증
      const previewSvg = dialog.locator('.diagram-preview-svg svg');
      await expect(previewSvg).toBeVisible({ timeout: 10000 });
      await expect(dialog.locator('.diagram-preview-svg')).not.toContainText('다이어그램 문법 오류');
    }

    // 순서도 템플릿 선택 시 캔버스 편집기 안내 문구 노출 확인
    const flowchartCard = dialog.locator('button', { hasText: '업무 기안 및 결재 프로세스' }).first();
    await flowchartCard.click();
    await expect(dialog.getByText('기존 다이어그램 편집기(캔버스)로 바로 열 수 있습니다')).toBeVisible();

    // "다이어그램 삽입" 버튼 클릭
    const insertBtn = dialog.locator('[data-testid="diagram-insert-button"], button:has-text("다이어그램 삽입")').first();
    await expect(insertBtn).toBeVisible();
    await insertBtn.click();

    // 모달 닫힘 확인
    await expect(dialog).not.toBeVisible();

    // 에디터에 mermaid 블록 삽입 확인
    await expect(editor).toContainText('```mermaid');
    await expect(editor).toContainText('flowchart TD');

    // 미리보기에 다이어그램 SVG 렌더링 확인
    const previewDiagram = page.locator('.markdown-body .mermaid-block svg');
    await expect(previewDiagram).toBeVisible({ timeout: 10000 });
  });

  // 60. 다이어그램 PNG / SVG 저장 (다운로드 이벤트 및 PNG 매직 넘버 검증)
  test('60. 다이어그램 PNG / SVG 저장: 미리보기 호버 오버레이에서 PNG/SVG 다운로드 및 89 50 4E 47 시그니처 검증', async ({ page }) => {
    // 시작하기.md의 첫 번째 다이어그램 블록 대기
    const wrap = page.locator('.markdown-body .mermaid-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 15000 });
    await expect(wrap.locator('.mermaid-block svg')).toBeVisible({ timeout: 15000 });
    await wrap.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // 다이어그램에 마우스 올리기
    await wrap.hover();

    // 오버레이의 "PNG로 저장" 버튼 노출 대기
    const overlay = page.locator('.mermaid-export-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    const pngBtn = overlay.getByRole('button', { name: 'PNG로 저장' });
    await expect(pngBtn).toBeVisible();

    // PNG 다운로드 트리거
    const pngDownloadPromise = page.waitForEvent('download');
    await pngBtn.click();
    const pngDownload = await pngDownloadPromise;

    // 파일 이름 패턴 검증 (<문서제목>-diagram.png)
    const suggestedPngName = pngDownload.suggestedFilename();
    expect(suggestedPngName).toContain('-diagram.png');

    // 다운로드 파일 앞 4바이트 PNG 시그니처(89 50 4E 47) 검증
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();
    if (pngPath) {
      const buffer = fs.readFileSync(pngPath);
      expect(buffer.length).toBeGreaterThan(16);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x4e); // 'N'
      expect(buffer[3]).toBe(0x47); // 'G'
    }

    // "SVG로 저장" 버튼도 다운로드 검증
    await wrap.hover();
    const svgBtn = overlay.getByRole('button', { name: 'SVG로 저장' });
    await expect(svgBtn).toBeVisible();

    const svgDownloadPromise = page.waitForEvent('download');
    await svgBtn.click();
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toContain('-diagram.svg');
    const svgPath = await svgDownload.path();
    if (svgPath) {
      const svgText = fs.readFileSync(svgPath, 'utf8');
      expect(svgText).toContain('<svg');
    }

    // 다이어그램 편집기 모달 내 "PNG로 저장" 버튼도 검증
    await wrap.locator('.mermaid-edit').click();
    const editorModal = page.getByRole('dialog', { name: '다이어그램 편집' });
    await expect(editorModal).toBeVisible();
    const modalPngBtn = editorModal.getByRole('button', { name: 'PNG로 저장' });
    await expect(modalPngBtn).toBeVisible();
    const modalPngDownloadPromise = page.waitForEvent('download');
    await modalPngBtn.click();
    const modalPngDownload = await modalPngDownloadPromise;
    expect(modalPngDownload.suggestedFilename()).toContain('-diagram.png');
    await editorModal.getByRole('button', { name: '취소' }).click();
    await expect(editorModal).not.toBeVisible();
  });

  // 61. 이모지 단축코드 자동완성 및 이모지 콜아웃 렌더링 확인
  test('61. 이모지 단축코드 자동완성 및 이모지 콜아웃 렌더링 확인', async ({ page }) => {
    // 새 문서 생성
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // 빈 줄에서 :sm 입력 -> 자동완성 목록 확인
    await page.keyboard.type(':sm');
    await page.waitForTimeout(300);

    // 자동완성 툴팁 노출 확인 후 Enter로 삽입
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // 이모지 콜아웃 마크다운 입력
    await page.keyboard.type('\n\n> 💡 팁 콜아웃 내용입니다.\n\n> 🔥 핵심 콜아웃 내용입니다.\n');
    await page.waitForTimeout(300);

    // 미리보기에 이모지 콜아웃 박스들이 각각 렌더링되었는지 확인
    const tipCallout = page.locator('.markdown-body .emoji-callout-tip');
    await expect(tipCallout).toBeVisible();
    await expect(tipCallout).toContainText('팁 콜아웃 내용입니다.');
    await expect(tipCallout).toHaveAttribute('data-callout-emoji', '💡');

    const fireCallout = page.locator('.markdown-body .emoji-callout-fire');
    await expect(fireCallout).toBeVisible();
    await expect(fireCallout).toContainText('핵심 콜아웃 내용입니다.');
    await expect(fireCallout).toHaveAttribute('data-callout-emoji', '🔥');
  });

  // 62. "/" 삽입 메뉴 개선: 초보자용 안내(placeholder), 아이콘·설명·예시, 검색, 삽입＋ 버튼, 이모지 연결, 모바일 폭 및 테마 대비, 크기·중복·높이 검증
  test('62. "/" 삽입 메뉴 개선 검증: placeholder, 항목 표시, 검색, 삽입＋ 버튼, 이모지 연결, 모바일 375px 및 테마 대비', async ({ page }) => {
    // 1. 새 문서 생성 후 placeholder 확인
    await page.locator('button[title="새 문서"]').first().click();
    const editor = page.locator('.cm-content');
    await editor.click();

    // placeholder 문구 확인: "/ 를 눌러 제목·표·수식·그림을 넣어 보세요"
    const placeholderEl = page.locator('.cm-placeholder');
    await expect(placeholderEl).toBeVisible();
    await expect(placeholderEl).toContainText('/ 를 눌러 제목·표·수식·그림을 넣어 보세요');

    // 글을 쓰면 placeholder가 사라짐
    await page.keyboard.type('A');
    await expect(placeholderEl).not.toBeVisible();
    await page.keyboard.press('Backspace');
    await expect(placeholderEl).toBeVisible();

    // 2. 빈 줄에서 "/" 입력 시 메뉴가 뜨고 항목 설명 및 예시 확인
    await page.keyboard.type('/');
    const tooltip = page.locator('.cm-tooltip-autocomplete');
    await expect(tooltip).toBeVisible();

    // 버그 1 검증: ul의 계산된 max-height가 300px 이상(설정 360px)
    const ulMaxHeight = await page.evaluate(() => {
      const ul = document.querySelector('.cm-tooltip.cm-tooltip-autocomplete > ul');
      if (!ul) return 0;
      return parseFloat(window.getComputedStyle(ul).maxHeight) || 0;
    });
    expect(ulMaxHeight).toBeGreaterThanOrEqual(300);

    // 버그 2 검증:
    // a. 한 번에 완전히 보이는 항목(li) 6개 이상
    // b. 각 항목의 innerText에서 이름 중복(동일 이름 2번 이상 노출) 0건
    // c. 항목 한 개의 높이가 56px 이하
    const checkVisibleAndDuplicate = await page.evaluate(() => {
      const ul = document.querySelector('.cm-tooltip.cm-tooltip-autocomplete > ul');
      if (!ul) return { fullyVisibleCount: 0, duplicateCount: 0, maxItemHeight: 0, itemHeights: [] };
      const ulRect = ul.getBoundingClientRect();
      const items = Array.from(ul.querySelectorAll('li.cm-slash-item')) as HTMLElement[];

      let fullyVisibleCount = 0;
      let duplicateCount = 0;
      let maxItemHeight = 0;
      const itemHeights: number[] = [];

      for (const li of items) {
        const rect = li.getBoundingClientRect();
        const height = rect.height;
        itemHeights.push(height);
        if (height > maxItemHeight) maxItemHeight = height;

        // li가 ul의 보이는 영역 내에 완전히 들어있는지 검사
        if (rect.top >= ulRect.top - 1 && rect.bottom <= ulRect.bottom + 1) {
          fullyVisibleCount++;
        }

        // 이름 중복 확인: innerText를 줄 단위로 쪼갰을 때 라벨 이름이 2번 이상 등장하는지 검사
        const labelEl = li.querySelector('.cm-slash-label');
        const labelText = labelEl ? (labelEl.textContent || '').trim() : '';
        if (labelText) {
          const lines = li.innerText.split('\n').map((s) => s.trim()).filter((s) => s === labelText);
          if (lines.length > 1) {
            duplicateCount++;
          }
        }
      }

      return { fullyVisibleCount, duplicateCount, maxItemHeight, itemHeights };
    });

    expect(checkVisibleAndDuplicate.fullyVisibleCount).toBeGreaterThanOrEqual(6);
    expect(checkVisibleAndDuplicate.duplicateCount).toBe(0);
    expect(checkVisibleAndDuplicate.maxItemHeight).toBeLessThanOrEqual(56);

    // 큰 제목, 중간 제목, 설명 글자("글 맨 위 제목에 씁니다") 노출 확인
    await expect(tooltip.locator('.cm-slash-label').first()).toContainText('큰 제목');
    await expect(tooltip.locator('.cm-slash-desc').first()).toContainText('글 맨 위 제목에 씁니다');
    await expect(tooltip.locator('.cm-slash-example').first()).toContainText('큰 글씨');

    // 아래 화살표를 연속으로 눌러 목록 끝 항목이 뷰포트 안으로 스크롤되는지 검증 (항목 20개 중 19번 이동 시 마지막 항목 도달)
    for (let i = 0; i < 19; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(200);

    const isLastItemVisible = await page.evaluate(() => {
      const ul = document.querySelector('.cm-tooltip.cm-tooltip-autocomplete > ul');
      if (!ul) return false;
      const ulRect = ul.getBoundingClientRect();
      const items = Array.from(ul.querySelectorAll('li.cm-slash-item')) as HTMLElement[];
      const lastItem = items[items.length - 1];
      if (!lastItem) return false;
      const rect = lastItem.getBoundingClientRect();
      // 마지막 항목이 ul의 뷰포트 내에 들어와 있는지 확인
      return rect.top >= ulRect.top - 5 && rect.bottom <= ulRect.bottom + 5;
    });
    expect(isLastItemVisible).toBe(true);

    // 3. 기존 입력을 지우고 "표"를 검색해 Enter로 삽입
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace'); // 기존 '/' 삭제
    await page.waitForTimeout(100);
    await page.keyboard.type('/표');
    await page.waitForTimeout(200);
    await expect(tooltip.locator('.cm-slash-label').first()).toContainText('표');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    // 에디터에 마크다운 표가 삽입되었는지 확인
    await expect(editor).toContainText('| 항목 | 내용 | 비고 |');

    // 4. "삽입 ＋" 버튼으로 같은 메뉴가 열림
    const insertPlusBtn = page.getByRole('button', { name: '삽입 ＋' });
    await expect(insertPlusBtn).toBeVisible();
    await insertPlusBtn.click();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.cm-slash-label').first()).toContainText('큰 제목');

    // 5. "이모지" 항목 선택 시 ":"가 들어가고 자동완성이 뜸
    await page.keyboard.type('이모지');
    await page.waitForTimeout(200);
    await expect(tooltip.locator('.cm-slash-label').first()).toContainText('이모지');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // 에디터에 ":"가 입력되어 이모지 자동완성 툴팁이 떴는지 확인
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(':');

    // Esc로 자동완성 닫기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 6. 이모지 직접 입력(":smi") 시 목록에 이모지 이름(기본 label)이 정상 표시되는지 검증 (부작용 없음)
    await page.keyboard.type(' :smi');
    await page.waitForTimeout(300);
    const emojiLabelVisible = await page.evaluate(() => {
      const ul = document.querySelector('.cm-tooltip.cm-tooltip-autocomplete > ul');
      if (!ul) return false;
      const firstItem = ul.querySelector('li');
      if (!firstItem) return false;
      const label = firstItem.querySelector('.cm-completionLabel') as HTMLElement;
      return !!label && window.getComputedStyle(label).display !== 'none' && label.textContent?.includes('smile');
    });
    expect(emojiLabelVisible).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 7. 375px 모바일 폭에서 메뉴가 화면 밖으로 나가지 않고, 보이는 항목이 4개 이상인지 확인
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('button[title="새 문서"]').first().click();
    await editor.click();
    await page.keyboard.type('/');
    await expect(tooltip).toBeVisible();

    const mobileChecks = await page.evaluate(() => {
      const ul = document.querySelector('.cm-tooltip.cm-tooltip-autocomplete > ul');
      if (!ul) return { fullyVisibleCount: 0, box: null };
      const ulRect = ul.getBoundingClientRect();
      const items = Array.from(ul.querySelectorAll('li.cm-slash-item')) as HTMLElement[];
      let fullyVisibleCount = 0;
      for (const li of items) {
        const rect = li.getBoundingClientRect();
        if (rect.top >= ulRect.top - 1 && rect.bottom <= ulRect.bottom + 1) {
          fullyVisibleCount++;
        }
      }
      return {
        fullyVisibleCount,
        box: { x: ulRect.x, width: ulRect.width, right: ulRect.right }
      };
    });

    expect(mobileChecks.fullyVisibleCount).toBeGreaterThanOrEqual(4);
    expect(mobileChecks.box).toBeTruthy();
    if (mobileChecks.box) {
      expect(mobileChecks.box.x).toBeGreaterThanOrEqual(0);
      expect(mobileChecks.box.right).toBeLessThanOrEqual(375 + 10);
    }
    await page.keyboard.press('Escape');

    // 8. 라이트/다크에서 선택 항목 대비가 4.5:1 이상
    await page.setViewportSize({ width: 1280, height: 800 });
    // 라이트 모드 새 문서에서 대비 검증
    await page.locator('button[title="새 문서"]').first().click();
    await editor.click();
    await page.keyboard.type('/');
    await expect(tooltip).toBeVisible();

    const lightContrast = await page.evaluate(() => {
      function parseRgb(str: string) {
        const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : { r: 0, g: 0, b: 0 };
      }
      function lum({ r, g, b }: { r: number; g: number; b: number }) {
        const [rs, gs, bs] = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      function contrast(c1: string, c2: string) {
        const l1 = lum(parseRgb(c1));
        const l2 = lum(parseRgb(c2));
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      const sel = document.querySelector('.cm-tooltip-autocomplete li[aria-selected]');
      if (!sel) return 0;
      const bg = window.getComputedStyle(sel).backgroundColor;
      const text = sel.querySelector('.cm-slash-label') || sel;
      const fg = window.getComputedStyle(text).color;
      return contrast(bg, fg);
    });
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Escape');

    // 다크 모드 전환 후 대비 검증
    await page.locator('header button[title="보기 설정"]').click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'GitHub 다크', exact: true }).click();
    await page.waitForTimeout(300);

    await page.locator('button[title="새 문서"]').first().click();
    await editor.click();
    await page.keyboard.type('/');
    await expect(tooltip).toBeVisible();

    const darkContrast = await page.evaluate(() => {
      function parseRgb(str: string) {
        const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : { r: 0, g: 0, b: 0 };
      }
      function lum({ r, g, b }: { r: number; g: number; b: number }) {
        const [rs, gs, bs] = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      function contrast(c1: string, c2: string) {
        const l1 = lum(parseRgb(c1));
        const l2 = lum(parseRgb(c2));
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      const sel = document.querySelector('.cm-tooltip-autocomplete li[aria-selected]');
      if (!sel) return 0;
      const bg = window.getComputedStyle(sel).backgroundColor;
      const text = sel.querySelector('.cm-slash-label') || sel;
      const fg = window.getComputedStyle(text).color;
      return contrast(bg, fg);
    });
    expect(darkContrast).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Escape');
  });
});

