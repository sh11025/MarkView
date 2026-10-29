/**
 * 문서 템플릿 데이터 인터페이스
 */
export type TemplateCategory =
  | '업무'
  | '개발'
  | '개인'
  | '학습'
  | '기획·창작'
  | '일정·관리'
  | '다이어그램';

export interface DocumentTemplate {
  id: string;
  category: TemplateCategory | string;
  name: string;
  description: string;
  content: string;
}
