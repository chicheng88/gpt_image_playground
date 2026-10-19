import {
  DEFAULT_AGENT_MAX_TOOL_ROUNDS,
  type ApiProfile,
  type AppSettings,
} from '../../types'
import { isAgentTextApiProfile, normalizeAgentMaxToolRounds, resolveApiProfileModel, splitModelList } from '../../lib/apiProfiles'
import { getImageGenerationModel, DEFAULT_IMAGES_MODEL } from '../../lib/imageModels'
import Select from '../Select'

interface AgentSettingsTabProps {
  draft: AppSettings
  activeProfile: ApiProfile
  agentMaxToolRoundsInput: string
  setAgentMaxToolRoundsInput: (value: string) => void
  commitSettings: (nextDraft: AppSettings) => void
  commitAgentMaxToolRounds: () => void
}

const AGENT_MODEL_SEPARATOR = '|'

interface SelectOption {
  label: string
  value: string
}

function encodeAgentModel(profileId: string, field: 'model' | 'imageGenerationModel', model: string) {
  return [profileId, field, model].join(AGENT_MODEL_SEPARATOR)
}

function parseAgentModel(value: string) {
  const [profileId, field, ...rest] = value.split(AGENT_MODEL_SEPARATOR)
  if (!profileId || (field !== 'model' && field !== 'imageGenerationModel') || !rest.length) return null
  return { profileId, field, model: rest.join(AGENT_MODEL_SEPARATOR) }
}

export default function AgentSettingsTab({
  draft,
  activeProfile,
  agentMaxToolRoundsInput,
  setAgentMaxToolRoundsInput,
  commitSettings,
  commitAgentMaxToolRounds,
}: AgentSettingsTabProps) {
  // 有多个候选配置时在模型名后标出配置名，避免同名模型难以区分
  const labelFor = (profile: ApiProfile, model: string) => (
    draft.profiles.length > 1 ? `${model}（${profile.name}）` : model
  )
  // 对话模型只能用 Responses API 配置，画图模型来自图片配置或 Responses 配置的图像模型
  const textOptions = draft.profiles
    .filter(isAgentTextApiProfile)
    .flatMap((profile) => splitModelList(profile.model).map((model) => ({
      label: labelFor(profile, model),
      value: encodeAgentModel(profile.id, 'model', model),
    })))
  const hasImageProfile = draft.profiles.some((profile) => !isAgentTextApiProfile(profile))
  const imageOptions = draft.profiles.flatMap((profile) => {
    if (!isAgentTextApiProfile(profile)) {
      return splitModelList(profile.model).map((model) => ({
        label: labelFor(profile, model),
        value: encodeAgentModel(profile.id, 'model', model),
      }))
    }
    // Responses 配置的图像模型只在显式填写或没有单独的图片配置时才有意义
    const imageModel = profile.imageGenerationModel?.trim() ?? ''
    if (!imageModel && hasImageProfile) return []
    const model = imageModel || DEFAULT_IMAGES_MODEL
    return [{ label: labelFor(profile, model), value: encodeAgentModel(profile.id, 'imageGenerationModel', model) }]
  })

  // 与 normalizeSettings 的回落规则一致：优先显式选择，其次首页配置，最后第一个 Responses 配置
  const fallbackTextProfile = isAgentTextApiProfile(activeProfile)
    ? activeProfile
    : draft.profiles.find(isAgentTextApiProfile) ?? activeProfile
  const textProfile = (draft.agentApiConfigMode === 'off'
    ? null
    : draft.profiles.find((profile) => profile.id === draft.agentTextProfileId && isAgentTextApiProfile(profile)))
    ?? fallbackTextProfile
  const imageProfile = draft.profiles.find((profile) => profile.id === draft.agentImageProfileId) ?? activeProfile
  const textValue = encodeAgentModel(textProfile.id, 'model', resolveApiProfileModel(textProfile).model)
  const imageValue = isAgentTextApiProfile(imageProfile)
    ? encodeAgentModel(imageProfile.id, 'imageGenerationModel', getImageGenerationModel(imageProfile) || DEFAULT_IMAGES_MODEL)
    : encodeAgentModel(imageProfile.id, 'model', resolveApiProfileModel(imageProfile).model)

  // 当前值不在可选项里（例如首页配置是纯图片配置）时补一个占位项，避免下拉框显示空白
  const withPlaceholder = (options: SelectOption[], value: string) => (
    options.some((option) => option.value === value) ? { options, value } : { options: [{ label: '未设置', value: '' }, ...options], value: '' }
  )
  const textSelect = withPlaceholder(textOptions, textValue)
  const imageSelect = withPlaceholder(imageOptions, imageValue)

  const applyTextModel = (value: string) => {
    const parsed = parseAgentModel(value)
    if (!parsed) return
    commitSettings({
      ...draft,
      agentTextProfileId: parsed.profileId,
      // 对话与画图用同一个 Responses 配置时走原生图像工具，否则用混合模式
      agentApiConfigMode: parsed.profileId === imageProfile.id && isAgentTextApiProfile(imageProfile) ? 'native' : 'hybrid',
      profiles: draft.profiles.map((profile) => profile.id === parsed.profileId ? { ...profile, selectedModel: parsed.model } : profile),
    })
  }

  const applyImageModel = (value: string) => {
    const parsed = parseAgentModel(value)
    if (!parsed) return
    commitSettings({
      ...draft,
      agentImageProfileId: parsed.profileId,
      // 图片配置同时作为首页默认配置，画廊与 Agent 使用同一个画图模型
      activeProfileId: parsed.field === 'model' ? parsed.profileId : draft.activeProfileId,
      agentApiConfigMode: parsed.profileId === textProfile.id && isAgentTextApiProfile(textProfile) ? 'native' : 'hybrid',
      profiles: draft.profiles.map((profile) => profile.id === parsed.profileId
        ? (parsed.field === 'model' ? { ...profile, selectedModel: parsed.model } : { ...profile, imageGenerationModel: parsed.model })
        : profile),
    })
  }

  return (
    <div className="space-y-4">
      <div className="block">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-sm text-gray-600 dark:text-gray-300">默认对话模型</span>
          <div className="w-40 shrink-0">
            {textOptions.length > 0 ? (
              <Select
                value={textSelect.value}
                onChange={applyTextModel}
                options={textSelect.options}
                showValueTooltips
                className="w-full px-3 py-1.5 rounded-xl border border-transparent bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-xs transition-all duration-200 text-gray-700 dark:text-gray-200 outline-none"
              />
            ) : (
              <div className="w-full rounded-xl border border-transparent bg-black/[0.04] px-3 py-1.5 text-center text-xs text-gray-700 transition-all duration-200 dark:bg-white/[0.06] dark:text-gray-200">
                没有可用模型
              </div>
            )}
          </div>
        </div>
        <div data-selectable-text className="text-xs text-gray-500 dark:text-gray-500">
          Agent 对话和调用工具使用的模型，需要部署提供 Responses API 配置。
        </div>
      </div>

      <div className="block">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-sm text-gray-600 dark:text-gray-300">默认画图模型</span>
          <div className="w-40 shrink-0">
            {imageOptions.length > 0 ? (
              <Select
                value={imageSelect.value}
                onChange={applyImageModel}
                options={imageSelect.options}
                showValueTooltips
                className="w-full px-3 py-1.5 rounded-xl border border-transparent bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-xs transition-all duration-200 text-gray-700 dark:text-gray-200 outline-none"
              />
            ) : (
              <div className="w-full rounded-xl border border-transparent bg-black/[0.04] px-3 py-1.5 text-center text-xs text-gray-700 transition-all duration-200 dark:bg-white/[0.06] dark:text-gray-200">
                没有可用模型
              </div>
            )}
          </div>
        </div>
        <div data-selectable-text className="text-xs text-gray-500 dark:text-gray-500">
          生成图片使用的模型，同时作为首页的默认画图模型。
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">最大工具调用轮数</span>
        <input
          value={agentMaxToolRoundsInput}
          onChange={(e) => setAgentMaxToolRoundsInput(e.target.value)}
          onBlur={commitAgentMaxToolRounds}
          type="number"
          min={1}
          max={50}
          className="w-full rounded-xl border border-transparent bg-black/[0.04] px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:bg-white/[0.06] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
        <div data-selectable-text className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-500">
          默认 15。用于限制 Agent 连续调用工具时的最大轮数，防止无限循环。
        </div>
      </label>
      <div className="block">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-sm text-gray-600 dark:text-gray-300">网络搜索</span>
          <button
            type="button"
            onClick={() => {
              const agentMaxToolRounds = agentMaxToolRoundsInput.trim() === ''
                ? DEFAULT_AGENT_MAX_TOOL_ROUNDS
                : normalizeAgentMaxToolRounds(agentMaxToolRoundsInput, draft.agentMaxToolRounds)
              setAgentMaxToolRoundsInput(String(agentMaxToolRounds))
              commitSettings({ ...draft, agentMaxToolRounds, agentWebSearch: !draft.agentWebSearch })
            }}
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${draft.agentWebSearch ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            role="switch"
            aria-checked={draft.agentWebSearch}
            aria-label="网络搜索"
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${draft.agentWebSearch ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>
        <div data-selectable-text className="text-xs text-gray-500 dark:text-gray-500">
          启用 Responses API 的 <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] dark:bg-white/[0.06]">web_search</code> 工具。模型每次调用此工具会产生少量固定价格的额外计费。
        </div>
      </div>
    </div>
  )
}
