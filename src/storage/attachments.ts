/**
 * 붙여넣거나 드롭한 이미지는 본문에 base64로 넣지 않고 IndexedDB에 Blob으로 저장한다.
 * 본문에는 `![설명](attachment:ID)`만 남는다.
 */
import { getDb, newId } from './db';

const urlCache = new Map<string, string>();

export async function addAttachment(blob: Blob, name: string): Promise<string> {
  const id = newId('img');
  await (await getDb()).put('attachments', { id, name, blob, createdAt: Date.now() });
  urlCache.set(id, URL.createObjectURL(blob));
  return id;
}

export function getAttachmentUrl(id: string): string | undefined {
  return urlCache.get(id);
}

/** 아직 메모리에 없는 첨부를 불러온다. 새로 불러온 것이 있으면 true */
export async function loadAttachments(ids: string[]): Promise<boolean> {
  const missing = ids.filter((id) => !urlCache.has(id));
  if (missing.length === 0) return false;
  const db = await getDb();
  let loaded = false;
  for (const id of missing) {
    const item = await db.get('attachments', id);
    if (item) {
      urlCache.set(id, URL.createObjectURL(item.blob));
      loaded = true;
    }
  }
  return loaded;
}

export async function getAttachmentBlob(id: string): Promise<Blob | undefined> {
  return (await (await getDb()).get('attachments', id))?.blob;
}

/** 메모리에 캐시된 이미지 URL을 해제하고 캐시에서 제거한다 */
export function revokeAttachmentUrls(ids: string[]): void {
  for (const id of ids) {
    const url = urlCache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.delete(id);
    }
  }
}
