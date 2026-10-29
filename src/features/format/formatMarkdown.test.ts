import { describe, expect, it } from 'vitest';
import { formatMarkdown } from './formatMarkdown';
import { getStringWidth } from './stringWidth';

describe('formatMarkdown', () => {
  describe('1. 표 정렬', () => {
    it('한글이 섞인 표의 모든 줄 시각적 폭이 일치하도록 정렬한다', () => {
      const input = [
        '|이름|담당|상태|',
        '|---|---|---|',
        '|기획서|김|완료|',
        '|디자인초안|이|진행 중|',
      ].join('\n');

      const formatted = formatMarkdown(input);
      const lines = formatted.trimEnd().split('\n');

      expect(lines).toHaveLength(4);
      const width = getStringWidth(lines[0]);
      for (const line of lines) {
        expect(getStringWidth(line)).toBe(width);
      }
    });

    it('구분선의 정렬 표시(:---:, ---:)와 좌측 콜론이 유지된다', () => {
      const input = [
        '| 기본 | 중앙 | 오른쪽 | 왼쪽콜론 |',
        '| --- | :---: | ---: | :--- |',
        '| a | b | c | d |',
      ].join('\n');

      const formatted = formatMarkdown(input);
      const lines = formatted.trimEnd().split('\n');
      const delimiter = lines[1];

      expect(delimiter).toContain(':');
      expect(delimiter).toMatch(/\| :--+: \|/); // 중앙
      expect(delimiter).toMatch(/\| ---+: \|/); // 우측
      expect(delimiter).toMatch(/\| :---+ \|/); // 좌측
    });

    it('셀 안의 이스케이프된 파이프(\\|)가 보존된다', () => {
      const input = [
        '| 함수 | 설명 |',
        '| --- | --- |',
        '| a\\|b | 파이프 포함 |',
      ].join('\n');

      const formatted = formatMarkdown(input);
      expect(formatted).toContain('a\\|b');
    });
  });

  describe('2. 글머리 목록 기호 통일', () => {
    it('*와 + 기호를 -로 변환하고 들여쓰기와 중첩 구조를 유지한다', () => {
      const input = [
        '* 첫번째',
        '  * 중첩 첫번째',
        '+ 두번째',
        '    + 더 깊은 중첩',
        '- 이미 대시인 항목',
      ].join('\n');

      const expected = [
        '- 첫번째',
        '  - 중첩 첫번째',
        '- 두번째',
        '    - 더 깊은 중첩',
        '- 이미 대시인 항목',
        '',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(expected);
    });

    it('인용문 안의 글머리 기호도 접두어를 유지하며 변환한다', () => {
      const input = '> * 인용 안 별표\n>   + 인용 안 십자';
      const expected = '> - 인용 안 별표\n>   - 인용 안 십자\n';
      expect(formatMarkdown(input)).toBe(expected);
    });

    it('번호 목록, **굵게** 시작 줄, * * * 가로줄은 건드리지 않는다', () => {
      const input = [
        '1. 첫번째',
        '2. 두번째',
        '',
        '**굵은 텍스트**로 시작하는 일반 문장',
        '',
        '* * *',
        '***',
        '---',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });
  });

  describe('3. 줄 끝 공백 정리', () => {
    it('일반 줄 끝 공백(1칸, 3칸 이상, 탭)을 제거한다', () => {
      const input = '줄 끝 1칸 \n줄 끝 3칸   \n줄 끝 탭\t';
      const expected = '줄 끝 1칸\n줄 끝 3칸\n줄 끝 탭\n';
      expect(formatMarkdown(input)).toBe(expected);
    });

    it('정확히 2칸 공백으로 끝나는 강제 줄바꿈은 유지한다', () => {
      const input = '강제 줄바꿈 뒤 2칸  \n다음 줄';
      const expected = '강제 줄바꿈 뒤 2칸  \n다음 줄\n';
      expect(formatMarkdown(input)).toBe(expected);
    });

    it('공백만으로 이루어진 줄은 빈 줄로 만든다', () => {
      const input = '내용\n   \n다음 내용';
      const expected = '내용\n\n다음 내용\n';
      expect(formatMarkdown(input)).toBe(expected);
    });
  });

  describe('4. 빈 줄 압축 및 5. 문서 끝 줄바꿈', () => {
    it('3개 이상 연속된 빈 줄을 2개로 줄인다', () => {
      const input = '문단 1\n\n\n\n\n문단 2\n\n\n\n문단 3';
      const expected = '문단 1\n\n\n문단 2\n\n\n문단 3\n';
      expect(formatMarkdown(input)).toBe(expected);
    });

    it('문서 끝에 줄바꿈이 없으면 정확히 1개를 추가한다', () => {
      expect(formatMarkdown('Hello World')).toBe('Hello World\n');
    });

    it('문서 끝에 줄바꿈이 여러 개면 1개로 줄인다', () => {
      expect(formatMarkdown('Hello World\n\n\n\n')).toBe('Hello World\n');
    });

    it('빈 문서는 빈 문자열을 유지한다', () => {
      expect(formatMarkdown('')).toBe('');
    });

    it('줄바꿈만 있는 문서는 줄바꿈 1개로 정리한다', () => {
      expect(formatMarkdown('\n\n\n\n')).toBe('\n');
    });
  });

  describe('절대 지킬 것: 보호 구간 불변', () => {
    it('코드 블록(``` 및 ~~~) 내부는 공백, 빈 줄, 별표, 표가 있어도 한 글자도 바꾸지 않는다', () => {
      const input = [
        '```ts',
        '* 코드 속 별표   ',
        '',
        '',
        '',
        '| a | b |',
        '|---|---|',
        'const x = 1;  ',
        '```',
        '',
        '~~~python',
        '+ 파이썬 십자    ',
        '',
        '',
        '~~~',
      ].join('\n');

      // 외부 문단이 없으므로 끝 줄바꿈만 추가되고 내부는 100% 동일해야 함
      expect(formatMarkdown(input)).toBe(input + '\n');
    });

    it('들여쓰기 4칸 코드 블록 내부는 변경하지 않는다', () => {
      const input = [
        '일반 문단',
        '',
        '    * 들여쓰기 코드 속 별표   ',
        '    ',
        '    ',
        '    const a = 1;',
        '',
        '다음 문단',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });

    it('$$ 수식 블록 내부는 공백과 빈 줄을 보존한다', () => {
      const input = [
        '$$',
        '\\int f(x) dx   ',
        '',
        '',
        '\\sum x_i',
        '$$',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });

    it('HTML 블록 내부는 공백과 빈 줄을 보존한다', () => {
      const input = [
        '<div>',
        '  <p>* html 항목   </p>',
        '',
        '',
        '</div>',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });
  });

  describe('인용문과 목록 안의 표 보존', () => {
    it('인용문(>) 안의 표는 정렬하지 않고 원본을 유지한다', () => {
      const input = [
        '> |이름|값|',
        '> |--|--|',
        '> |a|b|',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });

    it('목록 안의 표는 정렬하지 않고 원본을 유지한다', () => {
      const input = [
        '- 항목',
        '  |이름|값|',
        '  |--|--|',
        '  |a|b|',
      ].join('\n');

      expect(formatMarkdown(input)).toBe(input + '\n');
    });
  });

  describe('멱등성', () => {
    it('한 번 서식 정리를 한 결과를 다시 정리해도 완전히 일치한다', () => {
      const sampleInputs = [
        '|이름|값|\n|--|--|\n|가나다|1|\n\n* 항목 1   \n+ 항목 2\n\n\n\n끝',
        '# 제목\n\n```bash\n* test   \n\n\n```\n\n1. 번호\n\n',
        '강제 줄바꿈  \n다음 줄\n\n> [!NOTE]\n> 내용',
      ];

      for (const input of sampleInputs) {
        const once = formatMarkdown(input);
        const twice = formatMarkdown(once);
        expect(twice).toBe(once);
      }
    });
  });
});
