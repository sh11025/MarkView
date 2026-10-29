/**
 * 마크다운 서식 정리 순수 함수 (React import 금지).
 *
 * 정리 규칙 (5개):
 * 1. 표: 칸 너비를 맞춰 정렬 (넓은 글자 폭 2, 영문/기호 폭 1, 구분선 정렬 유지, 최소 너비 3)
 * 2. 글머리 목록 기호 통일: '*'와 '+'를 '-'로 변경 (들여쓰기·인용 접두어 유지)
 * 3. 줄 끝 공백 제거 (정확히 공백 2칸 강제 줄바꿈은 보존)
 * 4. 빈 줄 압축: 3개 이상 연속 빈 줄을 2개로 줄임
 * 5. 문서 끝 줄바꿈 정확히 하나 유지 (빈 문서는 빈 문자열 유지)
 *
 * 보호 구간(코드 블록, 수식 블록, HTML 블록) 내부는 한 글자도 변경하지 않음.
 */

import { splitRow } from '../table/tableEdit';
import { getStringWidth } from './stringWidth';
import { parseMarkdownTokens } from '../../render/markdown';

/** 표 줄 배열을 칸 너비에 맞게 정렬된 줄 배열로 변환 */
export function formatTableLines(lines: string[]): string[] {
  if (lines.length < 2) return lines;
  const rows = lines.map((line) => splitRow(line));
  const numCols = Math.max(...rows.map((r) => r.length));
  if (numCols === 0) return lines;

  // 구분선 행에서 정렬 방식 파악
  const aligns: Array<{ align: 'left' | 'right' | 'center'; hasColon: boolean }> = [];
  const delimiterRow = rows[1] || [];
  for (let c = 0; c < numCols; c++) {
    const cell = (delimiterRow[c] || '').trim();
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) aligns.push({ align: 'center', hasColon: true });
    else if (right) aligns.push({ align: 'right', hasColon: false });
    else if (left) aligns.push({ align: 'left', hasColon: true });
    else aligns.push({ align: 'left', hasColon: false });
  }

  // 각 열의 목표 너비 (최소 3)
  const colWidths = new Array(numCols).fill(3);
  for (let c = 0; c < numCols; c++) {
    let maxW = 3;
    for (let r = 0; r < rows.length; r++) {
      if (r === 1) continue; // 구분선 행 자체는 텍스트 너비 계산에서 제외
      const cell = rows[r][c] || '';
      const w = getStringWidth(cell);
      if (w > maxW) maxW = w;
    }
    colWidths[c] = maxW;
  }

  // 각 행 포맷팅
  const result: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const formattedCells: string[] = [];
    for (let c = 0; c < numCols; c++) {
      const w = colWidths[c];
      const align = aligns[c];
      if (r === 1) {
        // 구분선 행 포맷팅
        if (align.align === 'center') {
          formattedCells.push(':' + '-'.repeat(Math.max(1, w - 2)) + ':');
        } else if (align.align === 'right') {
          formattedCells.push('-'.repeat(Math.max(2, w - 1)) + ':');
        } else if (align.hasColon) {
          formattedCells.push(':' + '-'.repeat(Math.max(2, w - 1)));
        } else {
          formattedCells.push('-'.repeat(w));
        }
      } else {
        const text = row[c] || '';
        const tw = getStringWidth(text);
        const pad = Math.max(0, w - tw);
        if (align.align === 'right') {
          formattedCells.push(' '.repeat(pad) + text);
        } else if (align.align === 'center') {
          const lp = Math.floor(pad / 2);
          const rp = pad - lp;
          formattedCells.push(' '.repeat(lp) + text + ' '.repeat(rp));
        } else {
          formattedCells.push(text + ' '.repeat(pad));
        }
      }
    }
    result.push(`| ${formattedCells.join(' | ')} |`);
  }
  return result;
}

/** 줄 끝 공백 정리 (정확히 공백 2칸 강제 줄바꿈은 보존) */
function formatTrailingSpaces(line: string): string {
  if (/^\s+$/.test(line)) return '';
  if (/(?<=\S)  $/.test(line)) return line;
  return line.trimEnd();
}

/**
 * 마크다운 문자열을 깔끔하게 서식 정리한다.
 */
export function formatMarkdown(source: string): string {
  if (source === '') return '';

  const rawLines = source.split(/\r?\n/);
  const tokens = parseMarkdownTokens(source);

  // 1. 보호 구간 ([startLine, endLine) 줄 범위)
  const protectedRanges: Array<[number, number]> = [];
  // 2. 최상위 표 구간
  const tableRanges: Array<[number, number]> = [];
  // 3. 기호 변경 대상 글머리 목록 첫 줄
  const bulletLines = new Set<number>();

  let bulletListDepth = 0;
  for (const token of tokens) {
    if (token.type === 'bullet_list_open') {
      bulletListDepth++;
    } else if (token.type === 'bullet_list_close') {
      bulletListDepth = Math.max(0, bulletListDepth - 1);
    } else if (token.type === 'list_item_open') {
      if (bulletListDepth > 0 && (token.markup === '*' || token.markup === '+')) {
        if (token.map) {
          bulletLines.add(token.map[0]);
        }
      }
    } else if (
      token.type === 'fence' ||
      token.type === 'code_block' ||
      token.type === 'math_block' ||
      token.type === 'html_block'
    ) {
      if (token.map) {
        protectedRanges.push([token.map[0], token.map[1]]);
      }
    } else if (token.type === 'table_open' && token.level === 0) {
      if (token.map) {
        tableRanges.push([token.map[0], token.map[1]]);
      }
    }
  }

  const isProtected = (lineIdx: number): boolean =>
    protectedRanges.some(([start, end]) => lineIdx >= start && lineIdx < end);

  const isTableLine = (lineIdx: number): boolean =>
    tableRanges.some(([start, end]) => lineIdx >= start && lineIdx < end);

  // 1단계: 줄 단위 변환 (줄 수가 그대로 유지됨)
  const modifiedLines = [...rawLines];

  // 규칙 1: 표 정렬
  for (const [start, end] of tableRanges) {
    const tableSlice = rawLines.slice(start, end);
    const formattedTable = formatTableLines(tableSlice);
    for (let i = 0; i < formattedTable.length; i++) {
      modifiedLines[start + i] = formattedTable[i];
    }
  }

  // 규칙 2: 글머리 기호 통일 & 규칙 3: 줄 끝 공백 정리
  for (let i = 0; i < modifiedLines.length; i++) {
    if (isProtected(i)) {
      modifiedLines[i] = rawLines[i];
      continue;
    }

    let line = modifiedLines[i];

    // 규칙 2: 글머리 목록 기호 통일 (*, + -> -)
    if (bulletLines.has(i)) {
      line = line.replace(/^([\s>]*)[\*+](\s.*|\s*)$/, '$1-$2');
    }

    // 규칙 3: 줄 끝 공백 정리 (표 줄은 이미 정렬 공백이 계산되었으므로 건너뜀)
    if (!isTableLine(i)) {
      line = formatTrailingSpaces(line);
    }

    modifiedLines[i] = line;
  }

  // 2단계: 빈 줄 압축 (보호 구간 밖에서 3개 이상 연속 빈 줄을 2개로 줄임)
  const compressedLines: string[] = [];
  let emptyCount = 0;

  for (let i = 0; i < modifiedLines.length; i++) {
    const line = modifiedLines[i];
    if (isProtected(i)) {
      compressedLines.push(line);
      emptyCount = 0;
    } else {
      if (line === '') {
        emptyCount++;
        if (emptyCount <= 2) {
          compressedLines.push('');
        }
      } else {
        emptyCount = 0;
        compressedLines.push(line);
      }
    }
  }

  // 3단계: 문서 끝 줄바꿈 정리 (보호 구간 밖의 끝 빈 줄들 제거 후 \n 하나로 종료)
  while (compressedLines.length > 0) {
    const last = compressedLines[compressedLines.length - 1];
    if (last === '') {
      compressedLines.pop();
    } else {
      break;
    }
  }

  if (compressedLines.length === 0) {
    return '\n';
  }

  return compressedLines.join('\n') + '\n';
}
