const TASK_LINE_RE = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

/** 체크리스트 한 줄의 체크 상태를 바꾼다. 체크리스트 줄이 아니면 null */
export function setTaskChecked(line: string, checked: boolean): string | null {
  if (!TASK_LINE_RE.test(line)) return null;
  return line.replace(TASK_LINE_RE, `$1${checked ? 'x' : ' '}$3`);
}
