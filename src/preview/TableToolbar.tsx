import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { TableOp } from '../features/table/tableEdit';
import {
  computeTableToolbarOps,
  createInsertRowOp,
  createInsertColOp,
  createDeleteRowOp,
  createDeleteColOp,
  getRowBoundaries,
  getColBoundaries,
  LAST_CELL_TOOLTIP,
  type TableRowMetric,
  type TableColMetric,
} from '../features/table/tableToolbar';

export interface TableToolbarProps {
  tableLines: string[];
  rect: DOMRect;
  scrollerRect?: DOMRect;
  /** 표 바로 위쪽의 여유 공간(px) */
  spaceAbove?: number;
  /** 표 바로 아래쪽의 여유 공간(px) */
  spaceBelow?: number;
  rows: TableRowMetric[];
  cols: TableColMetric[];
  /** 현재 마우스가 올라간 행의 원문 줄 오프셋 (0=헤더, 2부터 본문) */
  hoveredRowIndex: number | null;
  /** 현재 마우스가 올라간 열 번호 (0부터 colCount - 1) */
  hoveredColIndex: number | null;
  /** 현재 마우스가 가까워진 행 사이 경계 인덱스 */
  hoveredRowBoundary: number | null;
  /** 현재 마우스가 가까워진 열 사이 경계 인덱스 */
  hoveredColBoundary: number | null;
  onApplyOp: (op: TableOp) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TableToolbar({
  tableLines,
  rect,
  scrollerRect,
  spaceAbove = 16,
  spaceBelow = 16,
  rows,
  cols,
  hoveredRowIndex,
  hoveredColIndex,
  hoveredRowBoundary,
  hoveredColBoundary,
  onApplyOp,
  onMouseEnter,
  onMouseLeave,
}: TableToolbarProps) {
  const [btnRowBoundary, setBtnRowBoundary] = useState<number | null>(null);
  const [btnColBoundary, setBtnColBoundary] = useState<number | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const ops = computeTableToolbarOps(tableLines);
  const rowBoundaries = getRowBoundaries(rows);
  const colBoundaries = getColBoundaries(cols);

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const minTop = scrollerRect ? Math.max(46, scrollerRect.top + 4) : 46;
  const maxBottom = scrollerRect ? Math.min(viewportH - 6, scrollerRect.bottom - 4) : viewportH - 6;

  // 표의 현재 보이는 가로/세로 범위 (가로 스크롤 및 화면 가장자리 고려)
  const visibleLeft = Math.max(4, rect.left);
  const visibleRight = Math.min(viewportW - 4, rect.right);
  const visibleWidth = Math.max(40, visibleRight - visibleLeft);
  const visibleTop = Math.max(minTop, rect.top);
  const visibleBottom = Math.min(maxBottom, rect.bottom);
  const visibleHeight = Math.max(28, visibleBottom - visibleTop);

  // 1) 아래쪽 끝 "＋" 띠 좌표 (아래 문단 글자를 가리지 않도록 여백 내 슬림 배치)
  const bottomBarHeight = Math.min(15, Math.max(12, spaceBelow - 1));
  const bottomBarTop = Math.min(maxBottom - bottomBarHeight, rect.bottom - 1);

  // 2) 오른쪽 끝 "＋" 띠 좌표 (화면 오른쪽 끝에 가까워도 잘리지 않게 클램핑)
  const rightBarWidth = 15;
  const rightBarLeft = Math.min(viewportW - rightBarWidth - 2, rect.right - 1);

  // 3) 현재 호버된 행 정보 (헤더 행 rowIndex === 0 은 행 삭제 버튼을 숨김)
  const activeRow =
    hoveredRowIndex !== null && hoveredRowIndex >= 2
      ? rows.find((r) => r.rowIndex === hoveredRowIndex) ?? null
      : null;

  // 4) 현재 호버된 열 정보 (가로 스크롤 범위 내에 보이는 열만 표시)
  const activeCol =
    hoveredColIndex !== null
      ? cols.find(
          (c) =>
            c.colIndex === hoveredColIndex &&
            c.right > visibleLeft + 8 &&
            c.left < visibleRight - 8,
        ) ?? null
      : null;

  // 위쪽 문단 글자를 가리지 않는 상단 컨트롤 Y 오프셋 계산
  const topControlOffset = spaceAbove >= 20 ? 17 : Math.min(14, Math.max(2, spaceAbove - 2));
  const colControlTop = Math.max(minTop, rect.top - topControlOffset);
  const colBoundaryTop = Math.max(minTop, rect.top - Math.min(9, Math.max(2, spaceAbove - 3)));

  // 현재 표시할 행 경계 (마우스 근접, 버튼 호버, 또는 키보드 포커스 시)
  const activeRowBoundaryIdx =
    btnRowBoundary ??
    hoveredRowBoundary ??
    (focusedKey !== null && rowBoundaries.length > 0 ? 0 : null);
  const activeRowBoundary =
    activeRowBoundaryIdx !== null
      ? rowBoundaries.find((b) => b.index === activeRowBoundaryIdx) ?? null
      : null;

  // 현재 표시할 열 경계 (마우스 근접, 버튼 호버, 또는 키보드 포커스 시)
  const activeColBoundaryIdx =
    btnColBoundary ??
    hoveredColBoundary ??
    (focusedKey !== null && colBoundaries.length > 0 ? 0 : null);
  const activeColBoundary =
    activeColBoundaryIdx !== null
      ? colBoundaries.find((b) => b.index === activeColBoundaryIdx) ?? null
      : null;

  const handleFocus = (key: string, e: React.FocusEvent<HTMLButtonElement>) => {
    if (e.currentTarget.matches(':focus-visible')) {
      setFocusedKey(key);
    }
    onMouseEnter?.();
  };

  const handleBlur = () => {
    setFocusedKey(null);
  };

  return (
    <div
      className="no-print pointer-events-none fixed inset-0 z-40 select-none"
      data-testid="table-edge-controls"
    >
      {/* a-1) 표 아래쪽 전체 폭의 얇은 "＋" 띠 (마지막에 행 추가) */}
      <div
        className="pointer-events-auto fixed pt-1"
        style={{
          top: bottomBarTop - 3,
          left: visibleLeft,
          width: visibleWidth,
          height: bottomBarHeight + 4,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          type="button"
          aria-label="마지막에 행 추가"
          title="마지막에 행 추가"
          data-table-action="append-row"
          onFocus={(e) => handleFocus('append-row', e)}
          onBlur={handleBlur}
          onClick={() => onApplyOp(ops.insertRowOp)}
          className="flex h-full w-full items-center justify-center rounded-b border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] shadow-xs transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--surface)] focus-visible:border-[var(--accent)] focus-visible:bg-[var(--accent)] focus-visible:text-[var(--surface)] focus-visible:outline-none"
        >
          <Plus className="size-3 stroke-[2.5]" />
        </button>
      </div>

      {/* a-2) 표 오른쪽 전체 높이의 얇은 "＋" 띠 (마지막에 열 추가) */}
      <div
        className="pointer-events-auto fixed pl-1"
        style={{
          top: visibleTop,
          left: rightBarLeft - 3,
          width: rightBarWidth + 4,
          height: visibleHeight,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          type="button"
          aria-label="마지막에 열 추가"
          title="마지막에 열 추가"
          data-table-action="append-col"
          onFocus={(e) => handleFocus('append-col', e)}
          onBlur={handleBlur}
          onClick={() => onApplyOp(ops.insertColOp)}
          className="flex h-full w-full items-center justify-center rounded-r border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] shadow-xs transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--surface)] focus-visible:border-[var(--accent)] focus-visible:bg-[var(--accent)] focus-visible:text-[var(--surface)] focus-visible:outline-none"
        >
          <Plus className="size-3 stroke-[2.5]" />
        </button>
      </div>

      {/* b-1) 행과 행 사이 경계 원형 "＋" 버튼 (헤더 위쪽은 제외, 헤더 아래부터 가능) */}
      {activeRowBoundary &&
        activeRowBoundary.y >= visibleTop - 4 &&
        activeRowBoundary.y <= visibleBottom + 4 && (
          <div>
            <div
              className="pointer-events-none fixed h-[2px] bg-[var(--accent)] opacity-70"
              style={{
                top: activeRowBoundary.y - 1,
                left: visibleLeft,
                width: visibleWidth,
              }}
            />
            <div
              className="pointer-events-auto fixed flex items-center justify-center p-1"
              style={{
                top: activeRowBoundary.y - 13,
                left: Math.max(2, visibleLeft - 9) - 4,
                width: 26,
                height: 26,
              }}
              onMouseEnter={() => {
                setBtnRowBoundary(activeRowBoundary.index);
                onMouseEnter?.();
              }}
              onMouseLeave={() => {
                setBtnRowBoundary(null);
                onMouseLeave?.();
              }}
            >
              <button
                type="button"
                aria-label="행 사이에 행 추가"
                title="이 위치에 빈 행 추가"
                data-table-action="insert-row"
                data-boundary-index={activeRowBoundary.index}
                onFocus={(e) => handleFocus(`row-boundary-${activeRowBoundary.index}`, e)}
                onBlur={handleBlur}
                onClick={() => {
                  const op = createInsertRowOp(tableLines, activeRowBoundary.afterRow);
                  if (op) onApplyOp(op);
                }}
                className="flex size-[18px] items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] shadow-sm transition-colors hover:bg-[var(--accent)] hover:text-[var(--surface)] focus-visible:bg-[var(--accent)] focus-visible:text-[var(--surface)] focus-visible:outline-none"
              >
                <Plus className="size-3 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

      {/* b-2) 열과 열 사이 경계 원형 "＋" 버튼 (헤더 포함) */}
      {activeColBoundary &&
        activeColBoundary.x >= visibleLeft + 6 &&
        activeColBoundary.x <= visibleRight - 6 && (
          <div>
            <div
              className="pointer-events-none fixed w-[2px] bg-[var(--accent)] opacity-70"
              style={{
                top: visibleTop,
                left: activeColBoundary.x - 1,
                height: visibleHeight,
              }}
            />
            <div
              className="pointer-events-auto fixed flex items-center justify-center p-1"
              style={{
                top: colBoundaryTop - 4,
                left: activeColBoundary.x - 13,
                width: 26,
                height: 26,
              }}
              onMouseEnter={() => {
                setBtnColBoundary(activeColBoundary.index);
                onMouseEnter?.();
              }}
              onMouseLeave={() => {
                setBtnColBoundary(null);
                onMouseLeave?.();
              }}
            >
              <button
                type="button"
                aria-label="열 사이에 열 추가"
                title="이 위치에 빈 열 추가"
                data-table-action="insert-col"
                data-boundary-index={activeColBoundary.index}
                onFocus={(e) => handleFocus(`col-boundary-${activeColBoundary.index}`, e)}
                onBlur={handleBlur}
                onClick={() => {
                  const op = createInsertColOp(tableLines, activeColBoundary.afterCol);
                  if (op) onApplyOp(op);
                }}
                className="flex size-[18px] items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] shadow-sm transition-colors hover:bg-[var(--accent)] hover:text-[var(--surface)] focus-visible:bg-[var(--accent)] focus-visible:text-[var(--surface)] focus-visible:outline-none"
              >
                <Plus className="size-3 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

      {/* c-1) 마우스가 올라간 본문 행의 왼쪽 바깥 "－" 버튼 (헤더 행은 숨김) */}
      {activeRow && activeRow.bottom > visibleTop && activeRow.top < visibleBottom && (
        <div
          className="pointer-events-auto fixed flex items-center pr-1.5"
          style={{
            top: Math.max(minTop, Math.min(maxBottom - 20, activeRow.top + activeRow.height / 2 - 10)),
            left: Math.max(2, visibleLeft - 20),
            width: 24,
            height: 20,
          }}
          title={!ops.canDeleteRow ? LAST_CELL_TOOLTIP : '이 행 삭제'}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <button
            type="button"
            aria-label="이 행 삭제"
            title={!ops.canDeleteRow ? LAST_CELL_TOOLTIP : '이 행 삭제'}
            data-table-action="delete-row"
            disabled={!ops.canDeleteRow}
            onFocus={(e) => handleFocus('delete-row', e)}
            onBlur={handleBlur}
            onClick={() => {
              const op = createDeleteRowOp(tableLines, activeRow.rowIndex);
              if (op) onApplyOp(op);
            }}
            className="flex size-[18px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-xs transition-colors hover:border-[var(--accent)] hover:bg-[var(--hover)] hover:text-[var(--text)] focus-visible:border-[var(--accent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--surface)]"
          >
            <Minus className="size-3 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* c-2) 마우스가 올라간 열의 위쪽 바깥 "－" 버튼 */}
      {activeCol && (
        <div
          className="pointer-events-auto fixed flex justify-center pb-1.5"
          style={{
            top: colControlTop,
            left: Math.max(
              visibleLeft + 2,
              Math.min(
                visibleRight - 20,
                Math.max(visibleLeft, activeCol.left) +
                  (Math.min(visibleRight, activeCol.right) - Math.max(visibleLeft, activeCol.left)) / 2 -
                  10,
              ),
            ),
            width: 20,
            height: 22,
          }}
          title={!ops.canDeleteCol ? LAST_CELL_TOOLTIP : '이 열 삭제'}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <button
            type="button"
            aria-label="이 열 삭제"
            title={!ops.canDeleteCol ? LAST_CELL_TOOLTIP : '이 열 삭제'}
            data-table-action="delete-col"
            disabled={!ops.canDeleteCol}
            onFocus={(e) => handleFocus('delete-col', e)}
            onBlur={handleBlur}
            onClick={() => {
              const op = createDeleteColOp(tableLines, activeCol.colIndex);
              if (op) onApplyOp(op);
            }}
            className="flex h-[16px] w-[18px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-xs transition-colors hover:border-[var(--accent)] hover:bg-[var(--hover)] hover:text-[var(--text)] focus-visible:border-[var(--accent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--surface)]"
          >
            <Minus className="size-3 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
}
