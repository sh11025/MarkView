import DOMPurify from 'dompurify';

// 외부 링크는 새 탭으로
if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') ?? '')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// blob: (첨부 이미지) 허용, 그 밖은 DOMPurify 기본 규칙
const ALLOWED_URI = /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: [
      'target',
      'data-rel-src',
      'data-attachment',
      'data-line',
      'data-line-end',
      'data-task-line',
      'data-col',
      'data-callout-emoji',
    ],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  });
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['style'] });
}
