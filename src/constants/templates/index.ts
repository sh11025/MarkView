import type { DocumentTemplate, TemplateCategory } from './types';
import { WORK_TEMPLATES } from './work';
import { DEV_TEMPLATES } from './dev';
import { PERSONAL_TEMPLATES } from './personal';
import { STUDY_TEMPLATES } from './study';
import { CREATION_TEMPLATES } from './creation';
import { MANAGEMENT_TEMPLATES } from './management';
import { DIAGRAM_TEMPLATES } from './diagram';

export * from './types';

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  '업무',
  '개발',
  '개인',
  '학습',
  '기획·창작',
  '일정·관리',
  '다이어그램',
] as const;

/**
 * 전체 기본 문서 템플릿 목록 (약 40종)
 */
export const TEMPLATES: DocumentTemplate[] = [
  ...WORK_TEMPLATES,
  ...DEV_TEMPLATES,
  ...PERSONAL_TEMPLATES,
  ...STUDY_TEMPLATES,
  ...CREATION_TEMPLATES,
  ...MANAGEMENT_TEMPLATES,
  ...DIAGRAM_TEMPLATES,
];
