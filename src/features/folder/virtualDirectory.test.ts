// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createVirtualDirectoryHandle } from './virtualDirectory';
import { scanDirectory, getFileHandleByPath, readFileByPath } from '../../storage/folder';
import { useDocuments } from '../../stores/documents';

// 가짜 File 객체 생성 유틸리티
function makeFile(name: string, content: string, relativePath?: string): File {
  const blob = new Blob([content], { type: 'text/markdown' });
  const file = new File([blob], name, { lastModified: 1000 });
  if (relativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: relativePath,
      writable: false,
    });
  }
  return file;
}

describe('가상 디렉터리 핸들 (Virtual Directory Handle)', () => {
  it('1. 하위 항목 순회(values) 및 계층 트리 스캔이 정상 동작한다', async () => {
    const files = [
      makeFile('README.md', '# 루트 리드미', 'my-project/README.md'),
      makeFile('guide.md', '# 가이드 문서', 'my-project/docs/guide.md'),
      makeFile('architecture.md', '# 구조 문서', 'my-project/docs/architecture.md'),
      makeFile('sub.md', '# 깊은 문서', 'my-project/docs/sub/sub.md'),
      makeFile('logo.png', 'PNGDATA', 'my-project/assets/logo.png'),
    ];

    const virtualDir = createVirtualDirectoryHandle(files, 'my-project');
    expect(virtualDir.name).toBe('my-project');
    expect(virtualDir.kind).toBe('directory');

    // scanDirectory를 통한 마크다운 파일 트리 생성 검증
    const scanResult = await scanDirectory(virtualDir);
    expect(scanResult.totalFiles).toBe(4); // README, guide, architecture, sub (logo.png 제외)
    expect(scanResult.tree).toHaveLength(2); // README.md 파일, docs 디렉터리

    const readmeEntry = scanResult.tree.find((e) => e.name === 'README.md');
    expect(readmeEntry?.kind).toBe('file');

    const docsEntry = scanResult.tree.find((e) => e.name === 'docs');
    expect(docsEntry?.kind).toBe('directory');
    if (docsEntry?.kind === 'directory') {
      expect(docsEntry.children.some((c) => c.name === 'guide.md')).toBe(true);
      expect(docsEntry.children.some((c) => c.name === 'architecture.md')).toBe(true);
      const subDir = docsEntry.children.find((c) => c.name === 'sub');
      expect(subDir?.kind).toBe('directory');
    }
  });

  it('2. 파일 읽기(getFile, readFileByPath)가 정상 동작한다', async () => {
    const files = [
      makeFile('README.md', '# 루트 내용', 'project/README.md'),
      makeFile('intro.md', '# 소개 내용', 'project/docs/intro.md'),
    ];

    const virtualDir = createVirtualDirectoryHandle(files, 'project');

    // 직속 getFileHandle
    const fileHandle = await virtualDir.getFileHandle!('README.md');
    expect(fileHandle.name).toBe('README.md');
    const fileObj = await fileHandle.getFile();
    expect(await fileObj.text()).toBe('# 루트 내용');

    // 상대 경로로 readFileByPath
    const introFile = await readFileByPath(virtualDir, 'docs/intro.md');
    expect(introFile).not.toBeNull();
    expect(await introFile!.text()).toBe('# 소개 내용');
  });

  it('3. 경로 탈출(..) 및 유효하지 않은 경로는 엄격히 거부된다', async () => {
    const files = [
      makeFile('secret.md', '# 비밀 문서', 'project/secret.md'),
      makeFile('safe.md', '# 안전 문서', 'project/docs/safe.md'),
    ];

    const virtualDir = createVirtualDirectoryHandle(files, 'project');

    // 직접 getFileHandle에 '..' 전달 시 예외 발생
    await expect(virtualDir.getFileHandle!('..')).rejects.toThrow();
    await expect(virtualDir.getFileHandle!('../secret.md')).rejects.toThrow();

    // 직접 getDirectoryHandle에 '..' 전달 시 예외 발생
    await expect(virtualDir.getDirectoryHandle!('..')).rejects.toThrow();
    await expect(virtualDir.getDirectoryHandle!('/root')).rejects.toThrow();

    // getFileHandleByPath를 통한 탈출 시도 차단 (null 반환)
    const escaped1 = await getFileHandleByPath(virtualDir, '../secret.md');
    expect(escaped1).toBeNull();

    const escaped2 = await getFileHandleByPath(virtualDir, 'docs/../../secret.md');
    expect(escaped2).toBeNull();

    const escaped3 = await getFileHandleByPath(virtualDir, './docs/safe.md');
    expect(escaped3).toBeNull();
  });

  it('4. 같은 폴더 문서를 다시 열 때 (sourceFolder, folderPath) 기준으로 중복 제거된다', () => {
    useDocuments.setState({ docs: {}, order: [], activeId: null });

    // 1차 열기
    useDocuments.getState().addOpenedFiles([
      {
        name: 'guide.md',
        content: '# 초판 가이드',
        lastModified: 1000,
        handleId: null, // 가상 폴더는 handleId 없음
        folderPath: 'docs/guide.md',
        sourceFolder: 'my-repo',
      },
      {
        name: 'notes.md',
        content: '# 메모',
        lastModified: 1000,
        handleId: null,
        folderPath: 'notes.md',
        sourceFolder: 'my-repo',
      },
    ]);

    expect(Object.keys(useDocuments.getState().docs)).toHaveLength(2);
    expect(useDocuments.getState().order).toHaveLength(2);

    // 2차 열기: 같은 폴더의 같은 파일 (내용이 변경된 상태)
    useDocuments.getState().addOpenedFiles([
      {
        name: 'guide.md',
        content: '# 갱신된 가이드',
        lastModified: 2000,
        handleId: null,
        folderPath: 'docs/guide.md',
        sourceFolder: 'my-repo',
      },
    ]);

    // 탭 개수는 여전히 2개 유지되어야 함 (중복 생성 방지)
    const docs = Object.values(useDocuments.getState().docs);
    expect(docs).toHaveLength(2);
    expect(useDocuments.getState().order).toHaveLength(2);

    // 미수정 상태였으므로 새 내용으로 갱신됨
    const updatedGuide = docs.find((d) => d.name === 'guide.md');
    expect(updatedGuide?.content).toBe('# 갱신된 가이드');

    // 다른 폴더의 동일 상대경로 문서를 여는 경우는 별도 탭으로 정상 추가되어야 함
    useDocuments.getState().addOpenedFiles([
      {
        name: 'guide.md',
        content: '# 다른 프로젝트 가이드',
        lastModified: 3000,
        handleId: null,
        folderPath: 'docs/guide.md',
        sourceFolder: 'other-repo',
      },
    ]);

    expect(Object.keys(useDocuments.getState().docs)).toHaveLength(3);
    expect(useDocuments.getState().order).toHaveLength(3);
  });
});
