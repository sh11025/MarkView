import { describe, it, expect } from 'vitest';
import { applyTableOp } from './tableEdit';
import {
  computeTableToolbarOps,
  createInsertRowOp,
  createInsertColOp,
  createDeleteRowOp,
  createDeleteColOp,
  applyEdgeTableOp,
  findNearRowBoundary,
  findNearColBoundary,
  LAST_CELL_TOOLTIP,
} from './tableToolbar';

describe('표 가장자리 +/− 편집 순수 로직 (tableToolbar & tableEdit)', () => {
  const sampleTable = [
    '| 이름 | 정렬\\|테스트 | 수치 |',
    '| :--- | :---: | ---: |',
    '| 홍길동 | A\\|B | 10 |',
    '| 이순신 | C\\|D | 20 |',
  ];

  it('1) 끝에 추가: 마지막 행 아래에 빈 행 추가, 마지막 열 오른쪽에 빈 열 추가', () => {
    const ops = computeTableToolbarOps(sampleTable);
    expect(ops.canDeleteRow).toBe(true);
    expect(ops.canDeleteCol).toBe(true);

    // 마지막에 행 추가
    const withLastRow = applyTableOp(sampleTable, ops.insertRowOp);
    expect(withLastRow).toEqual([
      '| 이름 | 정렬\\|테스트 | 수치 |',
      '| :--- | :---: | ---: |',
      '| 홍길동 | A\\|B | 10 |',
      '| 이순신 | C\\|D | 20 |',
      '|  |  |  |',
    ]);

    // 마지막에 열 추가 (삽입된 칸은 빈 칸으로 두고 포맷터 규칙 유지)
    const withLastCol = applyTableOp(sampleTable, ops.insertColOp);
    expect(withLastCol).toEqual([
      '| 이름 | 정렬\\|테스트 | 수치 |  |',
      '| :--- | :---: | ---: | --- |',
      '| 홍길동 | A\\|B | 10 |  |',
      '| 이순신 | C\\|D | 20 |  |',
    ]);
  });

  it('2) 중간에 끼워 넣기: 헤더 아래·본문 행 사이에 빈 행 삽입, 열 사이에 빈 열 삽입', () => {
    // 헤더 바로 아래(afterRow = 0 -> after: 1)에 빈 행 삽입
    const opAfterHeader = createInsertRowOp(sampleTable, 0);
    expect(opAfterHeader).toEqual({ type: 'insert-row', after: 1 });
    expect(applyEdgeTableOp(sampleTable, opAfterHeader)).toEqual([
      '| 이름 | 정렬\\|테스트 | 수치 |',
      '| :--- | :---: | ---: |',
      '|  |  |  |',
      '| 홍길동 | A\\|B | 10 |',
      '| 이순신 | C\\|D | 20 |',
    ]);

    // 첫 번째 본문 행(row 2)과 두 번째 본문 행(row 3) 사이에 빈 행 삽입
    const opBetweenRows = createInsertRowOp(sampleTable, 2);
    expect(opBetweenRows).toEqual({ type: 'insert-row', after: 2 });
    expect(applyEdgeTableOp(sampleTable, opBetweenRows)).toEqual([
      '| 이름 | 정렬\\|테스트 | 수치 |',
      '| :--- | :---: | ---: |',
      '| 홍길동 | A\\|B | 10 |',
      '|  |  |  |',
      '| 이순신 | C\\|D | 20 |',
    ]);

    // 첫 번째 열(col 0)과 두 번째 열(col 1) 사이에 빈 열 삽입
    const opBetweenCols = createInsertColOp(sampleTable, 0);
    expect(opBetweenCols).toEqual({ type: 'insert-col', after: 0, emptyHeader: true });
    expect(applyEdgeTableOp(sampleTable, opBetweenCols)).toEqual([
      '| 이름 |  | 정렬\\|테스트 | 수치 |',
      '| :--- | --- | :---: | ---: |',
      '| 홍길동 |  | A\\|B | 10 |',
      '| 이순신 |  | C\\|D | 20 |',
    ]);
  });

  it('3) 헤더 위 삽입 거부: after < 0 이면 삽입하지 않고 원문을 그대로 유지한다', () => {
    expect(createInsertRowOp(sampleTable, -1)).toBeNull();
    expect(applyTableOp(sampleTable, { type: 'insert-row', after: -1 })).toEqual(sampleTable);
    expect(applyTableOp(sampleTable, { type: 'insert-row', after: 99 })).toEqual(sampleTable);
  });

  it('4) 행·열 삭제 및 정렬 표기(:---:)·이스케이프된 파이프(\\|) 보존', () => {
    // 첫 번째 본문 행(row 2) 삭제
    const delRow2 = createDeleteRowOp(sampleTable, 2);
    expect(delRow2).toEqual({ type: 'delete-row', row: 2 });
    expect(applyEdgeTableOp(sampleTable, delRow2)).toEqual([
      '| 이름 | 정렬\\|테스트 | 수치 |',
      '| :--- | :---: | ---: |',
      '| 이순신 | C\\|D | 20 |',
    ]);

    // 세 번째 열(col 2) 삭제 시 남은 열의 정렬 표기(:---, :---:)와 \| 보존
    const delCol2 = createDeleteColOp(sampleTable, 2);
    expect(delCol2).toEqual({ type: 'delete-col', col: 2 });
    expect(applyEdgeTableOp(sampleTable, delCol2)).toEqual([
      '| 이름 | 정렬\\|테스트 |',
      '| :--- | :---: |',
      '| 홍길동 | A\\|B |',
      '| 이순신 | C\\|D |',
    ]);

    // 헤더 행(row 0)이나 구분선(row 1) 삭제 시도는 거부
    expect(createDeleteRowOp(sampleTable, 0)).toBeNull();
    expect(createDeleteRowOp(sampleTable, 1)).toBeNull();
    expect(applyTableOp(sampleTable, { type: 'delete-row', row: 0 })).toEqual(sampleTable);
    expect(applyTableOp(sampleTable, { type: 'delete-row', row: 1 })).toEqual(sampleTable);
  });

  it('5) 마지막 칸 삭제 거부: 본문 행이 1개뿐이거나 열이 1개뿐이면 삭제를 거부한다', () => {
    expect(LAST_CELL_TOOLTIP).toBe('마지막 칸은 삭제할 수 없습니다');

    // 본문 행이 1개만 남은 표 (총 3줄)
    const oneBodyRowTable = [
      '| 이름 | 상태 |',
      '| :--- | ---: |',
      '| 홍길동 | 완료\\|확인 |',
    ];
    const rowOps = computeTableToolbarOps(oneBodyRowTable);
    expect(rowOps.canDeleteRow).toBe(false);
    expect(rowOps.deleteRowOp).toBeNull();
    expect(createDeleteRowOp(oneBodyRowTable, 2)).toBeNull();
    // applyTableOp에 직접 delete-row를 넘겨도 본문 행이 0개가 되는 삭제는 거부
    expect(applyTableOp(oneBodyRowTable, { type: 'delete-row', row: 2 })).toEqual(oneBodyRowTable);

    // 열이 1개만 남은 표
    const oneColTable = [
      '| 메모 |',
      '| :---: |',
      '| 첫째\\|줄 |',
      '| 둘째\\|줄 |',
    ];
    const colOps = computeTableToolbarOps(oneColTable);
    expect(colOps.canDeleteCol).toBe(false);
    expect(colOps.deleteColOp).toBeNull();
    expect(createDeleteColOp(oneColTable, 0)).toBeNull();
    // applyTableOp에 직접 delete-col을 넘겨도 마지막 1열 삭제는 거부
    expect(applyTableOp(oneColTable, { type: 'delete-col', col: 0 })).toEqual(oneColTable);
  });

  it('6) 행·열 경계 감지: 헤더 위쪽은 제외하고 행 사이·열 사이 경계를 정확히 찾는다', () => {
    const rows = [
      { rowIndex: 0, top: 100, bottom: 136, height: 36 },
      { rowIndex: 2, top: 136, bottom: 172, height: 36 },
      { rowIndex: 3, top: 172, bottom: 208, height: 36 },
    ];
    // 헤더 위쪽(y = 100)은 경계로 감지하지 않는다
    expect(findNearRowBoundary(rows, 100, 10)).toBeNull();
    // 헤더와 첫 본문 행 사이(y = 136) 감지 -> afterRow = 1
    expect(findNearRowBoundary(rows, 134, 10)).toEqual({ index: 0, y: 136, afterRow: 1 });
    // 첫 본문 행과 둘째 본문 행 사이(y = 172) 감지 -> afterRow = 2
    expect(findNearRowBoundary(rows, 175, 10)).toEqual({ index: 1, y: 172, afterRow: 2 });

    const cols = [
      { colIndex: 0, left: 200, right: 320, width: 120 },
      { colIndex: 1, left: 320, right: 440, width: 120 },
    ];
    // 첫 열과 둘째 열 사이(x = 320) 감지 -> afterCol = 0
    expect(findNearColBoundary(cols, 318, 10)).toEqual({ index: 0, x: 320, afterCol: 0 });
    // 마지막 열 오른쪽 바깥(x = 440)은 사이 경계가 아님 (오른쪽 끝 + 띠가 담당)
    expect(findNearColBoundary(cols, 440, 10)).toBeNull();
  });
});
