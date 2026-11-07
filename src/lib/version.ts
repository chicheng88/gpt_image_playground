/** 按数字逐段比较版本号，忽略前缀 v 和预发布后缀 */
export function compareVersions(a: string, b: string) {
  const toParts = (v: string) => v.trim().replace(/^v/i, '').split(/[-+]/)[0].split('.').map((part) => Number.parseInt(part, 10) || 0)
  const aParts = toParts(a)
  const bParts = toParts(b)
  const length = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
