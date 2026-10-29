/**
 * @file 미리보기 표 가장자리 +/− 편집 컨트롤에서 사용하는 연산·비활성 조건·경계 감지 순수 로직
 */

import { applyTableOp, splitRow, type TableOp } from './tableEdit';

export const LAST_CELL_TOOLTIP = '마지막 칸은 삭제할 수 없습니다';

export interface TableRowMetric {
  /** 원문 줄 오프셋: 0 = 머리글, 2부터 본문 행 */
  rowIndex: number;
  top: number;
  bottom: number;
  height: number;
}

export interface TableColMetric {
  /** 열 번호: 0부터 colCount - 1 */
  colIndex: number;
  left: number;
  right: number;
  width: number;
}

export interface RowBoundary {
  /** rows 배열 내 위쪽 행 인덱스 (0 .. rows.length - 2) */
  index: number;
  /** 경계선의 화면 Y 좌표(px) */
  y: number;
  /** insert-row에 넘길 after 값 (헤더 아래는 1, 본문 행 아래는 해당 rowIndex) */
  afterRow: number;
}

export interface ColBoundary {
  /** cols 배열 내 왼쪽 열 인덱스 (0 .. cols.length - 2) */
  index: number;
  /** 경계선의 화면 X 좌표(px) */
  x: number;
  /** insert-col에 넘길 after 값 */
  afterCol: number;
}

export interface TableToolbarOps {
  lineCount: number;
  colCount: number;
  canDeleteRow: boolean;
  canDeleteCol: boolean;
  /** 표 아래쪽 끝 띠: 마지막에 행 추가 */
  insertRowOp: TableOp;
  /** 표 오른쪽 끝 띠: 마지막에 빈 열 추가 */
  insertColOp: TableOp;
  /** 마지막 본문 행 삭제 (가능할 때만) */
  deleteRowOp: TableOp | null;
  /** 마지막 열 삭제 (가능할 때만) */
  deleteColOp: TableOp | null;
}

/**
 * 표 원문 줄 배열로부터 가장자리 컨트롤의 기본 상태와 끝 추가/삭제 연산을 계산합니다.
 * - 행 번호: 0 = 머리글, 1 = 구분선, 2부터 본문 행
 * - 본문 행이 1개만 남으면(lineCount <= 3) 행 삭제 불가
 * - 열이 1개만 남으면(colCount <= 1) 열 삭제 불가
 */
export function computeTableToolbarOps(tableLines: string[]): TableToolbarOps {
  const lineCount = tableLines.length;
  const colCount = tableLines[0] ? splitRow(tableLines[0]).length : 1;

  const canDeleteRow = lineCount > 3;
  const canDeleteCol = colCount > 1;

  return {
    lineCount,
    colCount,
    canDeleteRow,
    canDeleteCol,
    insertRowOp: { type: 'insert-row', after: lineCount - 1 },
    insertColOp: { type: 'insert-col', after: colCount - 1, emptyHeader: true },
    deleteRowOp: canDeleteRow ? { type: 'delete-row', row: lineCount - 1 } : null,
    deleteColOp: canDeleteCol ? { type: 'delete-col', col: colCount - 1 } : null,
  };
}

/**
 * 행 사이 또는 끝에 빈 행을 끼워 넣는 TableOp를 생성합니다.
 * 헤더 행 위쪽(afterRow < 0)이나 범위를 벗어난 위치는 거부(null 반환)합니다.
 */
export function createInsertRowOp(tableLines: string[], afterRow: number): TableOp | null {
  const lineCount = tableLines.length;
  if (afterRow < 0 || afterRow >= lineCount) return null;
  return { type: 'insert-row', after: afterRow === 0 ? 1 : afterRow };
}

/**
 * 열 사이 또는 끝에 빈 열을 끼워 넣는 TableOp를 생성합니다.
 * 삽입된 칸은 헤더를 포함해 모두 빈 칸으로 둡니다.
 */
export function createInsertColOp(tableLines: string[], afterCol: number): TableOp | null {
  const colCount = tableLines[0] ? splitRow(tableLines[0]).length : 0;
  if (colCount <= 0 || afterCol < -1 || afterCol >= colCount) return null;
  return { type: 'insert-col', after: afterCol, emptyHeader: true };
}

/**
 * 특정 본문 행을 삭제하는 TableOp를 생성합니다.
 * 헤더 행(row < 2)이거나 본문 행이 1개뿐인 경우(lineCount <= 3) 거부(null 반환)합니다.
 */
export function createDeleteRowOp(tableLines: string[], row: number): TableOp | null {
  const lineCount = tableLines.length;
  if (lineCount <= 3 || row < 2 || row >= lineCount) return null;
  return { type: 'delete-row', row };
}

/**
 * 특정 열을 삭제하는 TableOp를 생성합니다.
 * 열이 1개뿐인 경우(colCount <= 1) 거부(null 반환)합니다.
 */
export function createDeleteColOp(tableLines: string[], col: number): TableOp | null {
  const colCount = tableLines[0] ? splitRow(tableLines[0]).length : 0;
  if (colCount <= 1 || col < 0 || col >= colCount) return null;
  return { type: 'delete-col', col };
}

/**
 * 표 가장자리 작업을 원문 줄 배열에 적용하여 새 줄 배열을 반환합니다.
 * 거부된 작업(null)이면 원본 배열을 그대로 돌려줍니다.
 */
export function applyEdgeTableOp(tableLines: string[], op: TableOp | null): string[] {
  if (!op) return tableLines;
  return applyTableOp(tableLines, op);
}

/**
 * 행 목록에서 삽입 가능한 모든 행 사이 경계(헤더 아래 ~ 마지막 행 위)를 계산합니다.
 * 헤더 위쪽 경계는 포함하지 않습니다.
 */
export function getRowBoundaries(rows: TableRowMetric[]): RowBoundary[] {
  const result: RowBoundary[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const r = rows[i];
    result.push({
      index: i,
      y: r.bottom,
      afterRow: r.rowIndex === 0 ? 1 : r.rowIndex,
    });
  }
  return result;
}

/**
 * 열 목록에서 삽입 가능한 모든 열 사이 경계(첫 열 오른쪽 ~ 마지막 열 왼쪽)를 계산합니다.
 */
export function getColBoundaries(cols: TableColMetric[]): ColBoundary[] {
  const result: ColBoundary[] = [];
  for (let j = 0; j < cols.length - 1; j++) {
    const c = cols[j];
    result.push({
      index: j,
      x: c.right,
      afterCol: c.colIndex,
    });
  }
  return result;
}

/**
 * 마우스 Y 좌표가 어느 행 위에 있는지 찾습니다.
 */
export function findHoveredRow(rows: TableRowMetric[], clientY: number): TableRowMetric | null {
  for (const r of rows) {
    if (clientY >= r.top && clientY <= r.bottom) {
      return r;
    }
  }
  return null;
}

/**
 * 마우스 X 좌표가 어느 열 위에 있는지 찾습니다.
 */
export function findHoveredCol(cols: TableColMetric[], clientX: number): TableColMetric | null {
  for (const c of cols) {
    if (clientX >= c.left && clientX <= c.right) {
      return c;
    }
  }
  return null;
}

/**
 * 마우스 Y 좌표에서 threshold(px) 이내에 있는 가장 가까운 행 사이 경계를 찾습니다.
 */
export function findNearRowBoundary(
  rows: TableRowMetric[],
  clientY: number,
  threshold = 10,
): RowBoundary | null {
  const boundaries = getRowBoundaries(rows);
  let best: RowBoundary | null = null;
  let bestDist = threshold + 1;
  for (const b of boundaries) {
    const dist = Math.abs(clientY - b.y);
    if (dist <= threshold && dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 마우스 X 좌표에서 threshold(px) 이내에 있는 가장 가까운 열 사이 경계를 찾습니다.
 */
export function findNearColBoundary(
  cols: TableColMetric[],
  clientX: number,
  threshold = 10,
): ColBoundary | null {
  const boundaries = getColBoundaries(cols);
  let best: ColBoundary | null = null;
  let bestDist = threshold + 1;
  for (const b of boundaries) {
    const dist = Math.abs(clientX - b.x);
    if (dist <= threshold && dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}
