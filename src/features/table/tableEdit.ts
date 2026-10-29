/**
 * 마크다운 표 편집. 표의 원문 줄 배열을 받아 새 줄 배열을 돌려주는 순수 함수.
 * 행 번호: 0 = 머리글, 1 = 구분선, 2부터 본문 (표 안에서의 줄 위치와 같다).
 */
export type TableOp =
  | { type: 'set-cell'; row: number; col: number; value: string }
  | { type: 'insert-row'; after: number }
  | { type: 'delete-row'; row: number }
  | { type: 'insert-col'; after: number; emptyHeader?: boolean }
  | { type: 'delete-col'; col: number };

/** `\|`는 나누지 않고 셀 경계 `|`로만 나눈다. */
export function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && text[i + 1] === '|') {
      current += '\\|';
      i++;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function formatRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/** 편집 입력창에 보여줄 셀 값 (`\|` → `|`) */
export function readCell(tableLines: string[], row: number, col: number): string {
  return (splitRow(tableLines[row] ?? '')[col] ?? '').replace(/\\\|/g, '|');
}

/** 입력값을 셀에 넣을 수 있게 바꾼다: 줄바꿈 → `<br>`, `|` → `\|` */
export function encodeCell(value: string): string {
  return value
    .trim()
    .replace(/\r?\n/g, '<br>')
    .replace(/(?<!\\)\|/g, '\\|');
}

export function applyTableOp(tableLines: string[], op: TableOp): string[] {
  const rows = tableLines.map(splitRow);
  const colCount = rows[0]?.length ?? 0;
  for (const r of rows) {
    while (r.length < colCount) r.push(r === rows[1] ? '---' : '');
    r.length = colCount;
  }

  switch (op.type) {
    case 'set-cell':
      if (op.row !== 1 && rows[op.row] && op.col >= 0 && op.col < colCount) {
        rows[op.row][op.col] = encodeCell(op.value);
      }
      break;
    case 'insert-row': {
      // 헤더 행 위쪽(after < 0) 또는 표 범위를 벗어난 위치에는 행을 넣지 않는다
      if (op.after < 0 || op.after >= rows.length) break;
      const at = Math.max(2, op.after + 1);
      rows.splice(at, 0, new Array(colCount).fill(''));
      break;
    }
    case 'delete-row':
      // 헤더·구분선(row < 2) 및 본문 행이 1개만 남은 경우(rows.length <= 3)는 삭제를 막는다
      if (rows.length > 3 && op.row >= 2 && op.row < rows.length) {
        rows.splice(op.row, 1);
      }
      break;
    case 'insert-col': {
      if (op.after < -1 || op.after >= colCount) break;
      const at = Math.max(0, Math.min(colCount, op.after + 1));
      const headerCell = op.emptyHeader ? '' : `열 ${colCount + 1}`;
      rows.forEach((r, i) => r.splice(at, 0, i === 0 ? headerCell : i === 1 ? '---' : ''));
      break;
    }
    case 'delete-col':
      // 열이 1개만 남은 경우(colCount <= 1)는 삭제를 막는다
      if (colCount > 1 && op.col >= 0 && op.col < colCount) {
        rows.forEach((r) => r.splice(op.col, 1));
      }
      break;
  }

  return rows.map(formatRow);
}
