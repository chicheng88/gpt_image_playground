import { useState } from 'react'
import type { ApiKeyEntry, ApiProfile, AppSettings } from '../../types'
import { TrashIcon } from '../icons'

interface ApiKeySettingsTabProps {
  draft: AppSettings
  commitSettings: (nextDraft: AppSettings) => void
}

interface KeyGroup {
  key: string
  profiles: ApiProfile[]
}

function createKeyId() {
  return `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function maskKey(key: string) {
  if (key.length <= 12) return '••••••••'
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`
}

/** 同一服务商的多条配置共用一个密钥列表 */
function groupByProvider(profiles: ApiProfile[]): KeyGroup[] {
  const groups: KeyGroup[] = []
  for (const profile of profiles) {
    const key = profile.provider
    const group = groups.find((item) => item.key === key)
    if (group) group.profiles.push(profile)
    else groups.push({ key, profiles: [profile] })
  }
  return groups
}

function collectKeys(profiles: ApiProfile[]) {
  const seen = new Map<string, ApiKeyEntry>()
  for (const profile of profiles) {
    for (const entry of profile.apiKeys ?? []) {
      if (!seen.has(entry.key)) seen.set(entry.key, entry)
    }
  }
  return [...seen.values()]
}

export default function ApiKeySettingsTab({ draft, commitSettings }: ApiKeySettingsTabProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState(false)
  const multiple = draft.profiles.length > 1
  const groups = groupByProvider(draft.profiles)

  const commitKeys = (group: KeyGroup, nextKeys: ApiKeyEntry[], activeId: string) => {
    const active = nextKeys.find((entry) => entry.id === activeId) ?? nextKeys[0]
    const targetIds = new Set(group.profiles.map((profile) => profile.id))
    commitSettings({
      ...draft,
      profiles: draft.profiles.map((profile) => targetIds.has(profile.id)
        ? { ...profile, apiKeys: nextKeys.length ? nextKeys : undefined, activeApiKeyId: active?.id, apiKey: active?.key ?? '' }
        : profile),
    })
  }

  const addKey = (group: KeyGroup) => {
    const key = (inputs[group.key] ?? '').trim()
    if (!key) return
    const keys = collectKeys(group.profiles)
    const existing = keys.find((entry) => entry.key === key)
    if (existing) {
      commitKeys(group, keys, existing.id)
    } else {
      const entry = { id: createKeyId(), key }
      commitKeys(group, [...keys, entry], entry.id)
    }
    setInputs((previous) => ({ ...previous, [group.key]: '' }))
  }

  const removeKey = (group: KeyGroup, id: string) => {
    const keys = collectKeys(group.profiles)
    const nextKeys = keys.filter((entry) => entry.id !== id)
    const removingActive = group.profiles.some((profile) => profile.activeApiKeyId === id)
    const activeId = removingActive ? nextKeys[0]?.id ?? '' : group.profiles[0]?.activeApiKeyId ?? ''
    commitKeys(group, nextKeys, activeId)
  }

  const renderKeyList = (group: KeyGroup) => {
    const keys = collectKeys(group.profiles)
    const activeId = group.profiles[0]?.activeApiKeyId
    if (!keys.length) {
      return <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">还没有保存任何密钥，在下方添加后即可开始使用。</p>
    }
    return (
      <ul className="space-y-2">
        {keys.map((entry, index) => {
          const active = entry.id === activeId
          return (
            <li
              key={entry.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${active
                ? 'bg-blue-500/[0.12] ring-1 ring-blue-500/30 dark:bg-blue-500/[0.16]'
                : 'bg-white/70 dark:bg-white/[0.04]'}`}
            >
              <button
                type="button"
                onClick={() => commitKeys(group, keys, entry.id)}
                disabled={active}
                className={`min-w-0 flex-1 text-left ${active ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="block truncate font-mono text-xs text-gray-700 dark:text-gray-200">
                  {showKeys ? entry.key : maskKey(entry.key)}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                  密钥 {index + 1}{active ? ' · 使用中' : ' · 点击切换'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeKey(group, entry.id)}
                aria-label={`删除密钥 ${index + 1}`}
                title="删除密钥"
                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-500/[0.1] hover:text-red-600 dark:hover:bg-red-500/[0.16]"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const keys = collectKeys(group.profiles)
        return (
          <div key={group.key} className="space-y-3 rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                <span className="truncate">
                  {group.profiles.length > 1
                    ? group.profiles.map((profile) => profile.name).join(' / ')
                    : multiple ? group.profiles[0].name : '已保存的密钥'}
                </span>
                {group.profiles.length > 1 && (
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
                    同一接口
                  </span>
                )}
              </h4>
              {keys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowKeys((visible) => !visible)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                >
                  {showKeys ? '隐藏密钥' : '显示密钥'}
                </button>
              )}
            </div>

            {renderKeyList(group)}

            <div className="flex items-center gap-2">
              <input
                value={inputs[group.key] ?? ''}
                onChange={(e) => setInputs((previous) => ({ ...previous, [group.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKey(group)
                  }
                }}
                type={showKeys ? 'text' : 'password'}
                placeholder={group.profiles[0].provider === 'fal' ? 'FAL_KEY' : 'sk-...'}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-xl border border-transparent bg-black/[0.04] px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:bg-white/[0.06] dark:text-gray-200 dark:focus:border-blue-500/50"
              />
              <button
                type="button"
                onClick={() => addKey(group)}
                disabled={!(inputs[group.key] ?? '').trim()}
                className="shrink-0 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
              >
                添加
              </button>
            </div>
          </div>
        )
      })}

      <p data-selectable-text className="px-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {groups.some((group) => group.profiles.length > 1)
          ? '同一服务商下的多条配置共用这些密钥，添加一次即可；请求只使用当前选中的密钥，密钥仅保存在本机。'
          : '可以保存多个密钥并随时切换，请求只使用当前选中的密钥；密钥仅保存在本机。'}
      </p>
    </div>
  )
}
