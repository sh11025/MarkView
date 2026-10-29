import { describe, it, expect } from 'vitest';
import { EDITOR_ACTIONS, SLASH_SECTION_TITLES } from './commands';
import { matchAction, SLASH_SVG_ICONS } from './slashMenu';

describe('슬래시(/) 삽입 메뉴 개선 단위 테스트', () => {
  const slashActions = EDITOR_ACTIONS.filter((a) => a.inSlashMenu);

  it('모든 슬래시 메뉴 항목에 id, 이름(label), 설명(description), 그룹(group), 예시(example), 아이콘(iconId)이 존재한다', () => {
    expect(slashActions.length).toBeGreaterThanOrEqual(15);

    for (const a of slashActions) {
      expect(a.id, `id가 비어있지 않음: ${JSON.stringify(a)}`).toBeTruthy();
      expect(a.label, `이름(label) 존재: ${a.id}`).toBeTruthy();
      expect(a.description, `설명(description) 존재: ${a.id}`).toBeTruthy();
      expect(a.example, `예시(example) 존재: ${a.id}`).toBeTruthy();
      expect(a.group, `그룹(group) 존재: ${a.id}`).toBeTruthy();
      expect(SLASH_SECTION_TITLES[a.group], `유효한 그룹 타이틀 존재: ${a.group}`).toBeTruthy();
      expect(a.iconId, `아이콘 식별자 존재: ${a.id}`).toBeTruthy();
      expect(SLASH_SVG_ICONS[a.iconId], `SVG 아이콘 매핑 존재: ${a.iconId}`).toBeTruthy();
    }
  });

  it('슬래시 메뉴 항목 간에 id 중복이 없다', () => {
    const ids = slashActions.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('키워드 검색(한글 부분 일치 및 일반인 어휘)이 의도한 항목을 정확히 찾는다', () => {
    // 1. "큰 글씨" -> 큰 제목
    const bigTextResults = slashActions.filter((a) => matchAction(a, '큰 글씨'));
    expect(bigTextResults.some((a) => a.id === 'h1')).toBe(true);

    // 2. "표" 및 "엑셀" -> 표
    const tableResults = slashActions.filter((a) => matchAction(a, '표'));
    expect(tableResults.some((a) => a.id === 'table')).toBe(true);
    const excelResults = slashActions.filter((a) => matchAction(a, '엑셀'));
    expect(excelResults.some((a) => a.id === 'table')).toBe(true);

    // 3. "공식" -> 수식(공식)
    const formulaResults = slashActions.filter((a) => matchAction(a, '공식'));
    expect(formulaResults.some((a) => a.id === 'math')).toBe(true);

    // 4. "그림", "순서도", "사진은 아님" -> 다이어그램(그림)
    const picResults = slashActions.filter((a) => matchAction(a, '그림'));
    expect(picResults.some((a) => a.id === 'mermaid')).toBe(true);
    const flowResults = slashActions.filter((a) => matchAction(a, '순서도'));
    expect(flowResults.some((a) => a.id === 'mermaid')).toBe(true);
    const notPhotoResults = slashActions.filter((a) => matchAction(a, '사진은 아님'));
    expect(notPhotoResults.some((a) => a.id === 'mermaid')).toBe(true);

    // 5. "웃음", "스마일" -> 이모지
    const laughResults = slashActions.filter((a) => matchAction(a, '웃음'));
    expect(laughResults.some((a) => a.id === 'emoji')).toBe(true);

    // 6. "목록" -> 점 목록, 번호 목록
    const listResults = slashActions.filter((a) => matchAction(a, '목록'));
    expect(listResults.some((a) => a.id === 'bullet')).toBe(true);
    expect(listResults.some((a) => a.id === 'numbered')).toBe(true);

    // 7. "할일", "체크" -> 체크리스트
    const todoResults = slashActions.filter((a) => matchAction(a, '할일'));
    expect(todoResults.some((a) => a.id === 'task')).toBe(true);
    const checkResults = slashActions.filter((a) => matchAction(a, '체크'));
    expect(checkResults.some((a) => a.id === 'task')).toBe(true);

    // 8. "새문서", "양식", "서식" -> 템플릿으로 새 문서 만들기
    const templateResults = slashActions.filter((a) => matchAction(a, '새문서'));
    expect(templateResults.some((a) => a.id === 'template-new')).toBe(true);
  });

  it('서식(굵게, 기울임, 취소선, 인라인 코드)은 슬래시 메뉴에 포함되지 않는다 (도구 막대 전용)', () => {
    const inlineActions = EDITOR_ACTIONS.filter((a) => a.group === 'inline');
    for (const a of inlineActions) {
      expect(a.inSlashMenu).toBe(false);
    }
  });

  it('그룹 타이틀은 "글 모양(제목·목록)", "넣기(표·수식·그림·이모지)", "상자(참고·팁·주의)", "링크·기타" 4종으로 구성된다', () => {
    const usedGroupTitles = new Set(slashActions.map((a) => SLASH_SECTION_TITLES[a.group]));
    expect(usedGroupTitles.has('글 모양(제목·목록)')).toBe(true);
    expect(usedGroupTitles.has('넣기(표·수식·그림·이모지)')).toBe(true);
    expect(usedGroupTitles.has('상자(참고·팁·주의)')).toBe(true);
    expect(usedGroupTitles.has('링크·기타')).toBe(true);
  });
});
