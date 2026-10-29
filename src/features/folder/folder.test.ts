import { describe, it, expect } from 'vitest';
import { scanDirectory, readFileByPath, getFileHandleByPath } from '../../storage/folder';
import type { DirectoryHandleLike, FileHandleLike } from '../../storage/folderTypes';
import { sortFolderEntries } from './sort';
import { pruneEmptyDirectories } from './prune';
import { joinPath, resolveRelativePath } from './path';
import type { FolderEntry, DirectoryEntry, FileEntry } from './types';

// 가짜 파일 핸들 생성 헬퍼
function mockFile(name: string, content = '# ' + name): FileHandleLike {
  return {
    kind: 'file',
    name,
    async getFile() {
      return new File([content], name, { type: 'text/markdown', lastModified: 1000 });
    },
  };
}

// 가짜 디렉토리 핸들 생성 헬퍼
function mockDir(name: string, children: (FileHandleLike | DirectoryHandleLike)[]): DirectoryHandleLike {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const child of children) {
        yield child;
      }
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

describe('features/folder 단위 테스트', () => {
  describe('joinPath', () => {
    it('(f) 상대 경로 구분자는 항상 / 이어야 한다', () => {
      expect(joinPath('', 'file.md')).toBe('file.md');
      expect(joinPath('docs', 'file.md')).toBe('docs/file.md');
      expect(joinPath('docs/sub', 'readme.md')).toBe('docs/sub/readme.md');
      expect(joinPath('docs\\sub', 'readme.md')).toBe('docs/sub/readme.md');
    });
  });

  describe('resolveRelativePath', () => {
    it('기본 상대 경로 (./a.md, ../img/x.png, sub/../a.md)를 올바르게 해석한다', () => {
      // 루트 문서 "guide.md"에서
      expect(resolveRelativePath('guide.md', './a.md')).toEqual({ ok: true, path: 'a.md', hash: '' });
      expect(resolveRelativePath('guide.md', 'sub/../a.md')).toEqual({ ok: true, path: 'a.md', hash: '' });

      // 하위 문서 "docs/guide.md"에서
      expect(resolveRelativePath('docs/guide.md', './a.md')).toEqual({ ok: true, path: 'docs/a.md', hash: '' });
      expect(resolveRelativePath('docs/guide.md', '../img/x.png')).toEqual({ ok: true, path: 'img/x.png', hash: '' });
      expect(resolveRelativePath('docs/sub/deep.md', '../../img/x.png')).toEqual({ ok: true, path: 'img/x.png', hash: '' });
    });

    it('%20 공백 및 한글 퍼센트 인코딩을 안전하게 디코딩한다', () => {
      expect(resolveRelativePath('docs/guide.md', './내%20문서.md')).toEqual({ ok: true, path: 'docs/내 문서.md', hash: '' });
      expect(resolveRelativePath('docs/guide.md', '../%EA%B0%80%EB%82%98%EB%8B%A4.png')).toEqual({ ok: true, path: '가나다.png', hash: '' });
    });

    it('hash와 query를 분리하고 hash는 디코딩된 문자열로 반환한다', () => {
      expect(resolveRelativePath('docs/guide.md', 'a.md#제목')).toEqual({ ok: true, path: 'docs/a.md', hash: '제목' });
      expect(resolveRelativePath('docs/guide.md', 'a.md?x=1#h')).toEqual({ ok: true, path: 'docs/a.md', hash: 'h' });
      expect(resolveRelativePath('docs/guide.md', 'a.md?version=2&foo=bar#%EC%86%8C%EA%B0%9C')).toEqual({
        ok: true,
        path: 'docs/a.md',
        hash: '소개',
      });
    });

    it('작업 폴더 루트 밖으로 나가는 경로(outside)를 정확히 탐지하고 차단한다', () => {
      // 루트 문서에서 상위로 탈출 시도
      expect(resolveRelativePath('a.md', '../x.md')).toEqual({ ok: false, reason: 'outside' });
      expect(resolveRelativePath('a.md', '../../x.md')).toEqual({ ok: false, reason: 'outside' });
      // docs 하위 문서에서 2단계 이상 상위로 탈출 시도
      expect(resolveRelativePath('docs/guide.md', '../../밖.png')).toEqual({ ok: false, reason: 'outside' });
    });

    it('외부 URL, 절대경로, 드라이브 경로를 external로 분류한다', () => {
      expect(resolveRelativePath('docs/guide.md', 'https://example.com/logo.png')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'http://example.com')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'mailto:user@test.com')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'attachment:att-1234')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'data:image/png;base64,abc')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'blob:http://localhost/123')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', '//cdn.example.com/lib.js')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', '/root/path/file.md')).toEqual({ ok: false, reason: 'external' });
      expect(resolveRelativePath('docs/guide.md', 'C:\\Windows\\file.txt')).toEqual({ ok: false, reason: 'external' });
    });

    it('백슬래시(\\)를 슬래시(/)와 동일하게 처리한다', () => {
      expect(resolveRelativePath('docs/guide.md', '..\\img\\x.png')).toEqual({ ok: true, path: 'img/x.png', hash: '' });
      expect(resolveRelativePath('docs\\guide.md', '.\\sub\\doc.md')).toEqual({ ok: true, path: 'docs/sub/doc.md', hash: '' });
    });

    it('잘못된 퍼센트 인코딩이어도 예외 없이 원문을 안전하게 처리한다', () => {
      expect(resolveRelativePath('docs/guide.md', './bad%E0%A4%A.md')).toEqual({
        ok: true,
        path: 'docs/bad%E0%A4%A.md',
        hash: '',
      });
    });

    it('경로가 비어있거나 hash만 있는 경우 empty를 반환한다', () => {
      expect(resolveRelativePath('docs/guide.md', '')).toEqual({ ok: false, reason: 'empty' });
      expect(resolveRelativePath('docs/guide.md', '#내부제목')).toEqual({ ok: false, reason: 'empty' });
      expect(resolveRelativePath('docs/guide.md', '?query=1#hash')).toEqual({ ok: false, reason: 'empty' });
    });
  });

  describe('sortFolderEntries', () => {
    it('폴더가 파일보다 먼저 오고, 한글/숫자 자연 정렬(2장.md < 10장.md, 가.md 등)로 정렬된다', () => {
      const entries: FolderEntry[] = [
        { kind: 'file', name: '10장.md', path: '10장.md', handle: mockFile('10장.md') },
        { kind: 'file', name: '가.md', path: '가.md', handle: mockFile('가.md') },
        { kind: 'file', name: '2장.md', path: '2장.md', handle: mockFile('2장.md') },
        { kind: 'directory', name: 'sub-b', path: 'sub-b', children: [] },
        { kind: 'directory', name: 'sub-a', path: 'sub-a', children: [] },
      ];

      const sorted = sortFolderEntries(entries);
      expect(sorted.map((e) => e.name)).toEqual([
        'sub-a',
        'sub-b',
        '2장.md',
        '10장.md',
        '가.md',
      ]);
    });
  });

  describe('pruneEmptyDirectories', () => {
    it('(c) 마크다운 파일이 없는 빈 폴더나 빈 하위 폴더만 가진 폴더는 제거된다', () => {
      const entries: FolderEntry[] = [
        {
          kind: 'directory',
          name: 'empty-dir',
          path: 'empty-dir',
          children: [],
        },
        {
          kind: 'directory',
          name: 'nested-empty',
          path: 'nested-empty',
          children: [
            { kind: 'directory', name: 'deep-empty', path: 'nested-empty/deep-empty', children: [] },
          ],
        },
        {
          kind: 'directory',
          name: 'valid-dir',
          path: 'valid-dir',
          children: [
            { kind: 'file', name: 'doc.md', path: 'valid-dir/doc.md', handle: mockFile('doc.md') },
          ],
        },
      ];

      const pruned = pruneEmptyDirectories(entries);
      expect(pruned).toHaveLength(1);
      expect(pruned[0].name).toBe('valid-dir');
    });
  });

  describe('scanDirectory (가짜 핸들)', () => {
    it('(a) 확장자 필터와 대소문자 (.md, .markdown, .txt, .TXT)를 허용하고 그 외 확장자는 무시한다', async () => {
      const root = mockDir('root', [
        mockFile('note.md'),
        mockFile('guide.MARKDOWN'),
        mockFile('memo.txt'),
        mockFile('TODO.TXT'),
        mockFile('image.png'),
        mockFile('script.js'),
      ]);

      const result = await scanDirectory(root);
      const fileNames = result.tree.map((e) => e.name);

      expect(fileNames).toContain('note.md');
      expect(fileNames).toContain('guide.MARKDOWN');
      expect(fileNames).toContain('memo.txt');
      expect(fileNames).toContain('TODO.TXT');
      expect(fileNames).not.toContain('image.png');
      expect(fileNames).not.toContain('script.js');
    });

    it('(b) 숨김 폴더/파일 및 node_modules, dist, build, .git을 제외한다', async () => {
      const root = mockDir('root', [
        mockFile('valid.md'),
        mockFile('.hidden.md'),
        mockDir('.git', [mockFile('commit.md')]),
        mockDir('node_modules', [mockFile('package.md')]),
        mockDir('dist', [mockFile('bundle.md')]),
        mockDir('build', [mockFile('out.md')]),
        mockDir('valid-folder', [mockFile('sub.md')]),
      ]);

      const result = await scanDirectory(root);
      const names = result.tree.map((e) => e.name);

      expect(names).toContain('valid-folder');
      expect(names).toContain('valid.md');
      expect(names).not.toContain('.hidden.md');
      expect(names).not.toContain('.git');
      expect(names).not.toContain('node_modules');
      expect(names).not.toContain('dist');
      expect(names).not.toContain('build');
    });

    it('(c) 마크다운 없는 폴더는 최종 목록에서 제외된다', async () => {
      const root = mockDir('root', [
        mockDir('images', [mockFile('photo.png'), mockFile('logo.svg')]),
        mockDir('docs', [mockFile('readme.md')]),
      ]);

      const result = await scanDirectory(root);
      expect(result.tree.map((e) => e.name)).toEqual(['docs']);
    });

    it('(d) 최대 깊이 한도를 초과하는 하위 폴더의 파일은 스캔하지 않는다', async () => {
      // 루트(깊이 1) -> level1(깊이 2) -> level2(깊이 3) -> level3(깊이 4)
      // maxDepth = 2 이면 level2(깊이 3) 하위는 탐색하지 않음
      const deepDir = mockDir('root', [
        mockDir('level1', [
          mockFile('at_level1.md'),
          mockDir('level2', [
            mockFile('at_level2.md'),
            mockDir('level3', [
              mockFile('at_level3.md'),
            ]),
          ]),
        ]),
      ]);

      const result = await scanDirectory(deepDir, { maxDepth: 2 });
      
      const level1 = result.tree[0] as DirectoryEntry;
      expect(level1.name).toBe('level1');
      const level1Files = level1.children.map((c) => c.name);
      expect(level1Files).toContain('at_level1.md');
      // maxDepth가 2이므로 level2(깊이 3)는 스캔되지 않아야 함
      expect(level1Files).not.toContain('level2');
    });

    it('(e) 파일 수 한도를 초과하면 스캔을 중단하고 truncated 플래그를 true로 반환한다', async () => {
      const files: FileHandleLike[] = [];
      for (let i = 0; i < 15; i++) {
        files.push(mockFile(`doc_${i}.md`));
      }
      const root = mockDir('root', files);

      const result = await scanDirectory(root, { maxFiles: 10 });
      expect(result.truncated).toBe(true);
      expect(result.tree.length).toBeLessThanOrEqual(11);
    });

    it('(f) 파일의 path가 항상 / 구분자로 올바르게 생성된다', async () => {
      const root = mockDir('root', [
        mockFile('root_doc.md'),
        mockDir('category', [
          mockDir('topic', [
            mockFile('article.md'),
          ]),
        ]),
      ]);

      const result = await scanDirectory(root);
      const rootDoc = result.tree.find((e) => e.name === 'root_doc.md') as FileEntry;
      expect(rootDoc.path).toBe('root_doc.md');

      const cat = result.tree.find((e) => e.name === 'category') as DirectoryEntry;
      expect(cat.path).toBe('category');

      const topic = cat.children.find((e) => e.name === 'topic') as DirectoryEntry;
      expect(topic.path).toBe('category/topic');

      const article = topic.children.find((e) => e.name === 'article.md') as FileEntry;
      expect(article.path).toBe('category/topic/article.md');
    });
  });

  describe('readFileByPath & getFileHandleByPath (가짜 핸들)', () => {
    const root = mockDir('root', [
      mockFile('a.md', '# 루트 문서'),
      mockDir('docs', [
        mockFile('guide.md', '# 가이드 문서'),
        mockDir('sub', [
          mockFile('deep.md', '# 심층 문서'),
        ]),
      ]),
    ]);

    it('루트 직하 파일 및 중첩 디렉토리의 파일을 정상적으로 읽는다', async () => {
      const file1 = await readFileByPath(root, 'a.md');
      expect(file1).not.toBeNull();
      expect(file1?.name).toBe('a.md');
      expect(await file1?.text()).toBe('# 루트 문서');

      const file2 = await readFileByPath(root, 'docs/guide.md');
      expect(file2).not.toBeNull();
      expect(file2?.name).toBe('guide.md');

      const file3 = await readFileByPath(root, 'docs/sub/deep.md');
      expect(file3).not.toBeNull();
      expect(file3?.name).toBe('deep.md');

      const handle = await getFileHandleByPath(root, 'docs/guide.md');
      expect(handle).not.toBeNull();
      expect(handle?.name).toBe('guide.md');
    });

    it('존재하지 않는 파일이나 중간 폴더가 없으면 null을 반환한다', async () => {
      expect(await readFileByPath(root, 'none.md')).toBeNull();
      expect(await readFileByPath(root, 'docs/none.md')).toBeNull();
      expect(await readFileByPath(root, 'not_found_dir/doc.md')).toBeNull();
      expect(await getFileHandleByPath(root, 'none.md')).toBeNull();
    });

    it('경로에 .. 나 . 또는 빈 세그먼트가 포함되어 있으면 방어적으로 null을 반환한다', async () => {
      expect(await readFileByPath(root, '../a.md')).toBeNull();
      expect(await readFileByPath(root, 'docs/../a.md')).toBeNull();
      expect(await readFileByPath(root, './a.md')).toBeNull();
      expect(await readFileByPath(root, 'docs//guide.md')).toBeNull();
      expect(await readFileByPath(root, '')).toBeNull();
    });
  });
});
