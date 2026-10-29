// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml, sanitizeSvg } from './sanitize';

describe('sanitize', () => {
  it('<script> 태그를 제거한다', () => {
    const dirty = '<p>안전한 문장</p><script>alert("xss")</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<p>안전한 문장</p>');
  });

  it('이벤트 핸들러(onerror, onclick 등)를 제거한다', () => {
    const dirty = '<img src="invalid.jpg" onerror="alert(1)"><button onclick="doBad()">클릭</button>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<img src="invalid.jpg">');
  });

  it('javascript: 링크를 제거한다', () => {
    const dirty = '<a href="javascript:alert(1)">악성 링크</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('악성 링크');
  });

  it('안전한 태그와 허용된 속성을 보존한다', () => {
    const safeHtml = [
      '<p data-line="1">단락 내용 <strong>굵게</strong> <em>기울임</em></p>',
      '<table data-line="3" data-line-end="5"><thead><tr data-line="3"><th data-col="0">열1</th></tr></thead><tbody><tr data-line="4"><td data-col="0">값</td></tr></tbody></table>',
      '<input type="checkbox" checked="" disabled="" data-task-line="6">',
      '<img src="blob:http://localhost/test-uuid" data-attachment="test-uuid" data-rel-src="./img.png">',
    ].join('\n');

    const clean = sanitizeHtml(safeHtml);
    expect(clean).toContain('data-line="1"');
    expect(clean).toContain('<strong>굵게</strong>');
    expect(clean).toContain('<em>기울임</em>');
    expect(clean).toContain('data-line="3"');
    expect(clean).toContain('data-col="0"');
    expect(clean).toContain('data-task-line="6"');
    expect(clean).toContain('src="blob:http://localhost/test-uuid"');
    expect(clean).toContain('data-attachment="test-uuid"');
    expect(clean).toContain('data-rel-src="./img.png"');
  });

  it('외부 링크(https://, mailto:)에 target="_blank"와 rel="noopener noreferrer"를 추가한다', () => {
    const html = '<a href="https://example.com">외부 사이트</a><a href="mailto:test@example.com">이메일</a>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('sanitizeSvg에서 위험한 태그(<script> 등) 및 핸들러가 지워지고 정상 SVG 요소는 보존된다', () => {
    const dirtySvg = '<svg><rect width="100" height="100" onload="alert(1)" /><path d="M0 0" /><script>alert(2)</script></svg>';
    const clean = sanitizeSvg(dirtySvg);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<rect width="100" height="100"');
    expect(clean).toContain('<path d="M0 0"');
  });
});
