import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('compareVersions', () => {
  it('按数字逐段比较，忽略前缀 v 和预发布后缀', () => {
    expect(compareVersions('0.7.17', '0.7.9')).toBeGreaterThan(0)
    expect(compareVersions('v0.8.0', '0.7.17')).toBeGreaterThan(0)
    expect(compareVersions('0.7.17', 'v0.7.17')).toBe(0)
    expect(compareVersions('0.7', '0.7.0')).toBe(0)
    expect(compareVersions('0.7.16', '0.7.17')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(0)
  })
})
