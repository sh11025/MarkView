// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { deactivateRelativeLinks, inlineRelativeImages } from './exportHtml';
import type { DirectoryHandleLike, FileHandleLike } from '../../storage/folderTypes';

function mockFile(name: string, content: string, type = 'text/plain'): FileHandleLike {
  return {
    kind: 'file',
    name,
    async getFile() {
      return new File([content], name, { type, lastModified: 1000 });
    },
  };
}

function mockDir(name: string, children: (FileHandleLike | DirectoryHandleLike)[]): DirectoryHandleLike {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const child of children) yield child;
    },
    async getFileHandle(fileName: string) {
      const found = children.find((c) => c.kind === 'file' && c.name === fileName);
      if (!found) throw new Error(`File not found: ${fileName}`);
      return found as FileHandleLike;
    },
    async getDirectoryHandle(dirName: string) {
      const found = children.find((c) => c.kind === 'directory' && c.name === dirName);
      if (!found) throw new Error(`Directory not found: ${dirName}`);
      return found as DirectoryHandleLike;
    },
  };
}

describe('exportHtml 단위 테스트', () => {
  describe('deactivateRelativeLinks', () => {
    it('상대 경로 문서 링크의 <a> 태그를 비활성화하고 텍스트만 남기며 외부/앵커 링크는 유지한다', () => {
      // Node 환경에서 가상 DOM 생성
      const container = document.createElement('div');
      container.innerHTML = `
        <p>
          <a href="#section">내부 앵커</a>
          <a href="https://example.com">외부 링크</a>
          <a href="mailto:test@example.com">메일 링크</a>
          <a href="./docs/guide.md">가이드 문서</a>
          <a href="../2장.md#끝">2장 문서</a>
        </p>
      `;

      deactivateRelativeLinks(container);

      // 앵커 및 외부 링크는 a 태그 유지
      expect(container.querySelector('a[href="#section"]')).not.toBeNull();
      expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull();
      expect(container.querySelector('a[href="mailto:test@example.com"]')).not.toBeNull();

      // 상대 링크는 a 태그가 제거되고 텍스트 내용 유지
      expect(container.querySelector('a[href="./docs/guide.md"]')).toBeNull();
      expect(container.querySelector('a[href="../2장.md#끝"]')).toBeNull();
      expect(container.textContent).toContain('가이드 문서');
      expect(container.textContent).toContain('2장 문서');
    });
  });

  describe('inlineRelativeImages', () => {
    it('폴더 컨텍스트가 있고 유효한 상대 경로 이미지는 data URL로 치환된다', async () => {
      const root = mockDir('root', [
        mockDir('img', [
          mockFile('logo.png', 'fake image bytes', 'image/png'),
        ]),
      ]);

      const container = document.createElement('div');
      container.innerHTML = `
        <img class="img-pending" data-rel-src="../img/logo.png" alt="로고">
      `;

      await inlineRelativeImages(container, {
        folderPath: 'docs/guide.md',
        folderHandle: root,
      });

      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.src).toMatch(/^data:image\/png;base64,/);
      expect(img?.hasAttribute('data-rel-src')).toBe(false);
      expect(img?.classList.contains('img-pending')).toBe(false);
    });

    it('폴더가 없거나 이미지를 찾지 못하면 대체 텍스트(img-missing)로 치환된다', async () => {
      const root = mockDir('root', []);

      const container = document.createElement('div');
      container.innerHTML = `
        <img class="img-pending" data-rel-src="./missing.png" alt="없는그림">
      `;

      await inlineRelativeImages(container, {
        folderPath: 'docs/guide.md',
        folderHandle: root,
      });

      expect(container.querySelector('img')).toBeNull();
      const missingSpan = container.querySelector('.img-missing');
      expect(missingSpan).not.toBeNull();
      expect(missingSpan?.textContent).toBe('(이미지를 포함하지 못했습니다: ./missing.png)');
    });
  });
});
