// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTableOp, readCell, splitRow } from './table/tableEdit';
import { setTaskChecked } from './tasks/toggleTask';
import { clipboardToMarkdownTable, tsvToRows } from './paste/clipboardTable';

const table = ['| 이름 | 값 |', '| :--- | ---: |', '| a | 1 |', '| b | 2 |'];

describe('tableEdit', () => {
  it('이스케이프된 파이프는 나누지 않는다', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a \\| b', 'c']);
    expect(readCell(['| a \\| b | c |'], 0, 0)).toBe('a | b');
  });

  it('셀 값을 바꾸고 파이프·줄바꿈을 안전하게 넣는다', () => {
    const out = applyTableOp(table, { type: 'set-cell', row: 3, col: 1, value: 'x|y\nz' });
    expect(out[3]).toBe('| b | x\\|y<br>z |');
    expect(out[1]).toBe('| :--- | ---: |');
  });

  it('지정한 위치에 행과 열을 추가·삭제한다', () => {
    expect(applyTableOp(table, { type: 'insert-row', after: 2 })).toEqual([
      table[0], table[1], '| a | 1 |', '|  |  |', '| b | 2 |',
    ]);
    expect(applyTableOp(table, { type: 'insert-row', after: 0 })[2]).toBe('|  |  |');
    expect(applyTableOp(table, { type: 'delete-row', row: 2 })).toEqual([table[0], table[1], table[3]]);
    expect(applyTableOp(table, { type: 'delete-row', row: 0 })).toEqual(table);

    const withCol = applyTableOp(table, { type: 'insert-col', after: 0 });
    expect(withCol[0]).toBe('| 이름 | 열 3 | 값 |');
    expect(withCol[1]).toBe('| :--- | --- | ---: |');
    expect(withCol[2]).toBe('| a |  | 1 |');

    expect(applyTableOp(table, { type: 'delete-col', col: 0 })[0]).toBe('| 값 |');
  });
});

describe('setTaskChecked', () => {
  it('글머리·번호·인용문 속 체크리스트를 바꾼다', () => {
    expect(setTaskChecked('- [ ] 할 일', true)).toBe('- [x] 할 일');
    expect(setTaskChecked('  1. [x] 완료', false)).toBe('  1. [ ] 완료');
    expect(setTaskChecked('> * [ ] 인용', true)).toBe('> * [x] 인용');
    expect(setTaskChecked('그냥 문장 [ ]', true)).toBeNull();
  });
});

describe('clipboardToMarkdownTable', () => {
  it('엑셀 TSV를 표로 바꾼다', () => {
    expect(clipboardToMarkdownTable('', '이름\t값\na\t1\n')).toBe('| 이름 | 값 |\n| --- | --- |\n| a | 1 |');
  });

  it('탭 들여쓰기 코드나 한 줄짜리는 표로 보지 않는다', () => {
    expect(tsvToRows('if (x) {\n\treturn 1;\n}')).toBeNull();
    expect(tsvToRows('a\tb')).toBeNull();
  });

  it('HTML 표를 바꾸되, 표가 일부인 본문은 무시한다', () => {
    const only = '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(clipboardToMarkdownTable(only, 'a b 1 2')).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
    const mixed = `<p>${'긴 본문 '.repeat(30)}</p>${only}`;
    expect(clipboardToMarkdownTable(mixed, '긴 본문')).toBeNull();
  });
});
