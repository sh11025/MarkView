/**
 * 템플릿 마크다운 내의 날짜 자리표시자({{날짜}})를 주어진 일자의 YYYY-MM-DD 형식으로 치환한다.
 * 순수 함수 (React 의존성 금지).
 */

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function applyTemplate(content: string, date: Date = new Date()): string {
  const formattedDate = formatDate(date);
  return content.replace(/\{\{날짜\}\}/g, formattedDate);
}
