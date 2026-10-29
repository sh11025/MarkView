/**
 * 클립보드의 표(엑셀·구글 시트·웹 표)를 마크다운 표로 바꾼다.
 * 오인을 막기 위해 2행 이상 × 2열 이상이고 모든 행의 열 수가 같을 때만 표로 본다.
 */

type Rows = string[][];

function isRectangular(rows: Rows): boolean {
  return rows.length >= 2 && rows[0].length >= 2 && rows.every((r) => r.length === rows[0].length);
}

export function tsvToRows(text: string): Rows | null {
  if (!text.includes('\t')) return null;
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const rows = lines.map((l) => l.split('\t').map((c) => c.trim()));
  return isRectangular(rows) ? rows : null;
}

/** HTML이 사실상 표 하나일 때만 변환 (표가 섞인 기사 본문 복사는 제외) */
export function htmlToRows(html: string): Rows | null {
  if (!/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const bodyText = (doc.body.textContent ?? '').replace(/\s+/g, '');
  const tableText = (table.textContent ?? '').replace(/\s+/g, '');
  if (tableText.length < bodyText.length * 0.9) return null;

  const rows: Rows = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = [...tr.querySelectorAll('th, td')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
    if (cells.length > 0) rows.push(cells);
  });
  const width = Math.max(0, ...rows.map((r) => r.length));
  rows.forEach((r) => {
    while (r.length < width) r.push('');
  });
  return isRectangular(rows) ? rows : null;
}

export function rowsToMarkdown(rows: Rows): string {
  const esc = (c: string) => c.replace(/\|/g, '\\|');
  const header = rows[0].map((c, i) => esc(c) || `열 ${i + 1}`);
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.slice(1).map((r) => `| ${r.map(esc).join(' | ')} |`),
  ];
  return lines.join('\n');
}

export function clipboardToMarkdownTable(html: string, text: string): string | null {
  const rows = tsvToRows(text) ?? (html ? htmlToRows(html) : null);
  return rows ? rowsToMarkdown(rows) : null;
}
