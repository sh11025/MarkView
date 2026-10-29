/**
 * Mermaid 다이어그램 PNG(2배 해상도, 흰색 배경) 및 SVG 저장 순수 유틸리티.
 * file:// 포터블 환경에서도 동작하며 캔버스 오염(Tainted Canvas)과 외부 네트워크 요청이 없다.
 */

/** 문서 제목에서 확장자와 금지 문자를 정리해 다이어그램 저장 파일 이름을 만든다 */
export function buildDiagramFileName(docName?: string, ext: 'png' | 'svg' = 'png'): string {
  const raw = (docName ?? '').trim();
  const withoutExt = raw.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '').trim();
  const sanitized = withoutExt
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const base = sanitized || '문서';
  return `${base}-diagram.${ext}`;
}

export interface PreparedSvg {
  svgString: string;
  width: number;
  height: number;
}

/**
 * SVG 요소를 복제해 독립 파일 및 캔버스 렌더링에 안전하도록 정돈한다.
 * - viewBox 또는 실제 렌더링 크기에서 픽셀 폭·높이 추출
 * - <foreignObject>가 있으면 순수 SVG <text>로 변환해 캔버스 오염(SecurityError) 원천 차단
 */
export function prepareSvgForExport(svgEl: SVGSVGElement): PreparedSvg {
  let width = 0;
  let height = 0;

  const viewBoxAttr = svgEl.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = parts[2];
      height = parts[3];
    }
  }

  if (width <= 0 || height <= 0) {
    const rect = svgEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      width = rect.width;
      height = rect.height;
    }
  }

  if (width <= 0 || height <= 0) {
    const attrW = parseFloat(svgEl.getAttribute('width') ?? '');
    const attrH = parseFloat(svgEl.getAttribute('height') ?? '');
    width = Number.isFinite(attrW) && attrW > 0 ? attrW : 800;
    height = Number.isFinite(attrH) && attrH > 0 ? attrH : 450;
  }

  const finalWidth = Math.max(64, Math.ceil(width));
  const finalHeight = Math.max(48, Math.ceil(height));

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(finalWidth));
  clone.setAttribute('height', String(finalHeight));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${finalWidth} ${finalHeight}`);
  }
  clone.style.maxWidth = 'none';
  clone.style.backgroundColor = '#ffffff';

  // foreignObject가 있으면 캔버스 오염을 막기 위해 순수 SVG <text>로 교체
  const foreignObjects = Array.from(clone.querySelectorAll('foreignObject'));
  for (const fo of foreignObjects) {
    const label = (fo.textContent ?? '').replace(/\s+/g, ' ').trim();
    const x = parseFloat(fo.getAttribute('x') ?? '0') || 0;
    const y = parseFloat(fo.getAttribute('y') ?? '0') || 0;
    const w = parseFloat(fo.getAttribute('width') ?? '0') || 0;
    const h = parseFloat(fo.getAttribute('height') ?? '0') || 0;

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(x + w / 2));
    textEl.setAttribute('y', String(y + h / 2));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('fill', '#1f2328');
    textEl.setAttribute('font-size', '13');
    textEl.setAttribute('font-family', 'sans-serif');
    textEl.textContent = label;
    fo.replaceWith(textEl);
  }

  const svgString = new XMLSerializer().serializeToString(clone);
  return { svgString, width: finalWidth, height: finalHeight };
}

/** data URL 문자열에서 바이너리 Blob을 생성한다 (toBlob 폴백용) */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(parts[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** SVG 요소를 2배 해상도(scale=2), 흰색(#ffffff) 배경의 PNG Blob으로 변환한다 */
export async function svgElementToPngBlob(svgEl: SVGSVGElement, scale = 2): Promise<Blob> {
  const { svgString, width, height } = prepareSvgForExport(svgEl);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG 이미지를 불러오지 못했습니다.'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 2D 컨텍스트를 생성할 수 없습니다.');
  }

  // 흰색 배경 채우기
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          try {
            resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
          } catch (err) {
            reject(err);
          }
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/** 브라우저 파일 다운로드 실행 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** SVG 요소를 2배 해상도 흰색 배경 PNG 파일로 다운로드한다 */
export async function downloadDiagramAsPng(svgEl: SVGSVGElement, docName?: string): Promise<void> {
  const blob = await svgElementToPngBlob(svgEl, 2);
  triggerBlobDownload(blob, buildDiagramFileName(docName, 'png'));
}

/** SVG 요소를 SVG 파일로 다운로드한다 */
export function downloadDiagramAsSvg(svgEl: SVGSVGElement, docName?: string): void {
  const { svgString } = prepareSvgForExport(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerBlobDownload(blob, buildDiagramFileName(docName, 'svg'));
}
