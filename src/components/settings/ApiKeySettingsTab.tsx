import { useState } from 'react'
import type { ApiKeyEntry, ApiProfile, AppSettings } from '../../types'
import MarkdownRenderer from '../MarkdownRenderer'
import { TrashIcon } from '../icons'

interface ApiKeySettingsTabProps {
  draft: AppSettings
  profile: ApiProfile
  presetDescription?: string
  commitSettings: (nextDraft: AppSettings) => void
}

function createKeyId() {
  return `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function maskKey(key: string) {
  if (key.length <= 12) return '••••••••'
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`
}

export default function ApiKeySettingsTab({ draft, profile, presetDescription, commitSettings }: ApiKeySettingsTabProps) {
  const [input, setInput] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const keys = profile.apiKeys ?? []

  const commitKeys = (nextKeys: ApiKeyEntry[], activeId: string) => {
    const active = nextKeys.find((entry) => entry.id === activeId) ?? nextKeys[0]
    commitSettings({
      ...draft,
      profiles: draft.profiles.map((item) => item.id === profile.id
        ? { ...item, apiKeys: nextKeys.length ? nextKeys : undefined, activeApiKeyId: active?.id, apiKey: active?.key ?? '' }
        : item),
    })
  }

  const addKey = () => {
    const key = input.trim()
    if (!key) return
    const existing = keys.find((entry) => entry.key === key)
    if (existing) {
      commitKeys(keys, existing.id)
      setInput('')
      return
    }
    const entry = { id: createKeyId(), key }
    commitKeys([...keys, entry], entry.id)
    setInput('')
  }

  const removeKey = (id: string) => {
    const nextKeys = keys.filter((entry) => entry.id !== id)
    commitKeys(nextKeys, profile.activeApiKeyId === id ? nextKeys[0]?.id ?? '' : profile.activeApiKeyId ?? '')
  }

  return (
    <div className="space-y-4">
      {presetDescription && (
        <div data-selectable-text className="flex items-start gap-3 rounded-xl border border-transparent bg-black/[0.04] px-3.5 py-3 text-sm leading-6 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <MarkdownRenderer content={presetDescription} className="min-w-0 flex-1" />
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">已保存的密钥</h4>
          {keys.length > 0 && (
            <button
              type="button"
              onClick={() => setShowKeys((visible) => !visible)}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              {showKeys ? '隐藏密钥' : '显示密钥'}
            </button>
          )}
        </div>

        {keys.length === 0 ? (
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">还没有保存任何密钥，在下方添加后即可开始使用。</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((entry, index) => {
              const active = entry.id === profile.activeApiKeyId
              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${active
                    ? 'bg-blue-500/[0.12] ring-1 ring-blue-500/30 dark:bg-blue-500/[0.16]'
                    : 'bg-white/70 dark:bg-white/[0.04]'}`}
                >
                  <button
                    type="button"
                    onClick={() => commitKeys(keys, entry.id)}
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
                    onClick={() => removeKey(entry.id)}
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
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06]">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">添加密钥</h4>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKey()
              }
            }}
            type={showKeys ? 'text' : 'password'}
            placeholder={profile.provider === 'fal' ? 'FAL_KEY' : 'sk-...'}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-black/[0.04] px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:bg-white/[0.06] dark:text-gray-200 dark:focus:border-blue-500/50"
          />
          <button
            type="button"
            onClick={addKey}
            disabled={!input.trim()}
            className="shrink-0 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
          >
            添加
          </button>
        </div>
        <p data-selectable-text className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          可以保存多个密钥并随时切换，请求只使用当前选中的密钥；密钥仅保存在本机。
        </p>
      </div>
    </div>
  )
}
