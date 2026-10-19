import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { normalizeBaseUrl } from '../lib/api'
import { hasActiveDataOperations, trackDataTransfer } from '../lib/dataOperations'
import { isApiProxyAvailable, isApiProxyLocked, readClientDevProxyConfig } from '../lib/devProxy'
import { isTauri } from '../lib/platform'
import { useStore, exportData, importData, clearData, type SettingsTab } from '../store'
import {
  createDefaultOpenAIProfile,
  DEFAULT_FAL_BASE_URL,
  DEFAULT_FAL_MODEL,
  DEFAULT_IMAGES_MODEL,
  DEFAULT_RESPONSES_MODEL,
  DEFAULT_SETTINGS,
  getActiveApiProfile,
  getCustomProviderDefinition,
  getDefaultApiProfileId,
  isOpenAICompatibleProvider,
  normalizeAgentMaxToolRounds,
  normalizeSettings,
  normalizeStreamPartialImages,
} from '../lib/apiProfiles'
import {
  getDefaultPresetBaseUrl,
  getDefaultPresetProfileId,
  isPresetConfigOnlyEnabled,
} from '../lib/presetConfig'
import { requestBrowserNotificationPermission, type BrowserNotificationPermissionResult } from '../lib/browserNotification'
import { DEFAULT_AGENT_MAX_TOOL_ROUNDS, DEFAULT_STREAM_PARTIAL_IMAGES, type ApiProfile, type AppSettings, type CustomProviderDefinition, type ZipDownloadRoute } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { updateModalScrollRef, useReleaseUpdates } from '../hooks/useReleaseUpdates'
import { Checkbox } from './Checkbox'
import { CloseIcon, TrashIcon, ExportIcon, ImportIcon } from './icons'
import GeneralSettingsTab from './settings/GeneralSettingsTab'
import AgentSettingsTab from './settings/AgentSettingsTab'
import ApiKeySettingsTab from './settings/ApiKeySettingsTab'
import ZipDownloadRouteModal, { ZIP_DOWNLOAD_ROUTE_OPTIONS } from './settings/ZipDownloadRouteModal'
import StorageInfoSection from './settings/StorageInfoSection'

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isAsyncCustomProvider(provider: CustomProviderDefinition | null | undefined) {
  return Boolean(provider?.poll || provider?.submit.taskIdPath || provider?.editSubmit?.taskIdPath)
}

function isProfileApiProxyEligible(settings: AppSettings, profile: ApiProfile) {
  if (!isOpenAICompatibleProvider(settings, profile.provider)) return false
  const customProvider = getCustomProviderDefinition(settings, profile.provider)
  return !isAsyncCustomProvider(customProvider)
}

export default function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings)
  const settingsTabRequest = useStore((s) => s.settingsTabRequest)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const reusedTaskApiProfileId = useStore((s) => s.reusedTaskApiProfileId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const hasRunningOperations = useStore((s) => hasActiveDataOperations(s.tasks, s.agentConversations))
  const importInputRef = useRef<HTMLInputElement>(null)
  const dataTransferToastAtRef = useRef(0)
  const settingsScrollBoundaryRef = useRef<HTMLDivElement>(null)
  const zipDownloadRouteScrollBoundaryRef = useRef<HTMLDivElement>(null)
  const tabScrollRef = useRef<HTMLDivElement>(null)
  // 各选项卡共用一个滚动容器，按选项卡记录滚动位置，切换时各自恢复
  const tabScrollTopsRef = useRef<Partial<Record<SettingsTab, number>>>({})

  const [draft, setDraft] = useState<AppSettings>(normalizeSettings(settings))
  const [agentMaxToolRoundsInput, setAgentMaxToolRoundsInput] = useState(String(settings.agentMaxToolRounds))
  const [showZipDownloadRouteManager, setShowZipDownloadRouteManager] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('api')
  const [exportConfig, setExportConfig] = useState(true)
  const [exportTasks, setExportTasks] = useState(true)
  const [importConfig, setImportConfig] = useState(true)
  const [importTasks, setImportTasks] = useState(true)
  const [clearConfig, setClearConfig] = useState(true)
  const [clearTasks, setClearTasks] = useState(true)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isImportingData, setIsImportingData] = useState(false)

  const apiProxyConfig = readClientDevProxyConfig()
  const apiProxyAvailable = isApiProxyAvailable(apiProxyConfig)
  const apiProxyLocked = isApiProxyLocked(apiProxyConfig)
  const presetConfigOnly = isPresetConfigOnlyEnabled()
  const defaultProfileId = getDefaultPresetProfileId() ?? getDefaultApiProfileId(draft)
  const activeProfile = draft.profiles.find((profile) => profile.id === draft.activeProfileId) ?? draft.profiles[0] ?? getActiveApiProfile(draft)
  const getDefaultModelForMode = (apiMode: AppSettings['apiMode']) =>
    apiMode === 'responses' ? DEFAULT_RESPONSES_MODEL : DEFAULT_IMAGES_MODEL

  const enabledZipDownloadRouteCount = ZIP_DOWNLOAD_ROUTE_OPTIONS
    .filter((option) => draft.zipDownloadRoutes.includes(option.route))
    .length

  const zipDownloadRouteSummary = enabledZipDownloadRouteCount
    ? `已开启 ${enabledZipDownloadRouteCount} 项使用压缩包进行批量下载的途径`
    : '未开启任何使用压缩包进行批量下载的途径'

  const wasSettingsOpenRef = useRef(false)

  useEffect(() => {
    if (!showSettings) {
      wasSettingsOpenRef.current = false
      tabScrollTopsRef.current = {}
      return
    }
    if (wasSettingsOpenRef.current) return

    wasSettingsOpenRef.current = true
    const normalizedSettings = normalizeSettings(settings)
    const displaySettings = normalizedSettings.reuseTaskApiProfileTemporarily && reusedTaskApiProfileId && normalizedSettings.profiles.some((profile) => profile.id === reusedTaskApiProfileId)
      ? normalizeSettings({ ...normalizedSettings, activeProfileId: reusedTaskApiProfileId })
      : normalizedSettings
    const nextDraft = normalizeSettings({
      ...displaySettings,
      profiles: displaySettings.profiles.map((profile) => ({
        ...profile,
        // 客户端不使用代理，但保留已保存的设置，导回网页版时仍然有效
        apiProxy: isProfileApiProxyEligible(displaySettings, profile) && apiProxyAvailable
          ? (apiProxyLocked || profile.apiProxy)
          : isTauri && profile.apiProxy,
      })),
    })
    setDraft(nextDraft)
    setAgentMaxToolRoundsInput(String(nextDraft.agentMaxToolRounds))
  }, [apiProxyAvailable, apiProxyLocked, showSettings, settings, reusedTaskApiProfileId])

  // 设置打开期间首次保存（例如导出备份）时会询问并写入保存方式，同步到草稿，避免之后提交草稿时被改回
  useEffect(() => {
    setDraft((prev) => prev.saveLocationMode === settings.saveLocationMode ? prev : { ...prev, saveLocationMode: settings.saveLocationMode })
  }, [settings.saveLocationMode])

  useEffect(() => {
    if (showSettings && settingsTabRequest) setActiveTab(settingsTabRequest)
  }, [settingsTabRequest, showSettings])

  useLayoutEffect(() => {
    if (tabScrollRef.current) tabScrollRef.current.scrollTop = tabScrollTopsRef.current[activeTab] ?? 0
  }, [activeTab, showSettings])

  const commitSettings = (nextDraft: AppSettings) => {
    const normalizedProfiles = nextDraft.profiles.map((profile) => {
      const nextApiProxy = isProfileApiProxyEligible(nextDraft, profile) && apiProxyAvailable ? (apiProxyLocked || profile.apiProxy) : false
      const shouldKeepEmptyBaseUrl = profile.provider !== 'fal' && nextApiProxy && !profile.baseUrl.trim()
      const emptyBaseUrlFallback = profile.id === defaultProfileId
        ? getDefaultPresetBaseUrl()
        : DEFAULT_SETTINGS.baseUrl
      const normalizedBaseUrl = profile.provider === 'fal'
        ? profile.baseUrl.trim().replace(/\/+$/, '') || (profile.id === defaultProfileId ? '' : DEFAULT_FAL_BASE_URL)
        : shouldKeepEmptyBaseUrl ? '' : normalizeBaseUrl(profile.baseUrl.trim() || emptyBaseUrlFallback)
      const defaultModel = profile.provider === 'fal' ? DEFAULT_FAL_MODEL : getDefaultModelForMode(profile.apiMode)
      return {
        ...profile,
        name: profile.name.trim() || (profile.id === defaultProfileId ? '默认' : '新配置'),
        baseUrl: normalizedBaseUrl,
        model: profile.model.trim() || defaultModel,
        timeout: Number(profile.timeout) || DEFAULT_SETTINGS.timeout,
        apiProxy: isTauri ? profile.apiProxy : nextApiProxy,
        codexCli: isOpenAICompatibleProvider(nextDraft, profile.provider) ? profile.codexCli : false,
        streamImages: profile.provider === 'openai' ? profile.streamImages : false,
        streamPartialImages: profile.provider === 'openai' ? normalizeStreamPartialImages(profile.streamPartialImages) : DEFAULT_STREAM_PARTIAL_IMAGES,
      }
    })
    const fallbackProfile = createDefaultOpenAIProfile({ id: newId('openai') })
    const normalizedDraft = normalizeSettings({
      ...nextDraft,
      profiles: normalizedProfiles.length ? normalizedProfiles : [fallbackProfile],
      activeProfileId: normalizedProfiles.some((profile) => profile.id === nextDraft.activeProfileId)
        ? nextDraft.activeProfileId
        : (normalizedProfiles[0]?.id ?? fallbackProfile.id),
    })
    setSettings(normalizedDraft)
    setDraft(useStore.getState().settings)
  }

  const setZipDownloadRouteEnabled = (route: ZipDownloadRoute, enabled: boolean) => {
    const nextRoutes = enabled
      ? Array.from(new Set([...draft.zipDownloadRoutes, route]))
      : draft.zipDownloadRoutes.filter((item) => item !== route)
    commitSettings({ ...draft, zipDownloadRoutes: nextRoutes })
  }

  const handleClose = () => {
    if (isExportingData || isImportingData) {
      showDataTransferBusyToast()
      return
    }
    if (showZipDownloadRouteManager) {
      setShowZipDownloadRouteManager(false)
      return
    }
    const normalizedAgentMaxToolRounds = agentMaxToolRoundsInput.trim() === ''
      ? DEFAULT_AGENT_MAX_TOOL_ROUNDS
      : normalizeAgentMaxToolRounds(agentMaxToolRoundsInput, draft.agentMaxToolRounds)
    setAgentMaxToolRoundsInput(String(normalizedAgentMaxToolRounds))
    commitSettings({ ...draft, agentMaxToolRounds: normalizedAgentMaxToolRounds })
    setShowSettings(false)
  }

  const commitAgentMaxToolRounds = useCallback(() => {
    const value = agentMaxToolRoundsInput.trim() === ''
      ? DEFAULT_AGENT_MAX_TOOL_ROUNDS
      : normalizeAgentMaxToolRounds(agentMaxToolRoundsInput, draft.agentMaxToolRounds)
    setAgentMaxToolRoundsInput(String(value))
    if (value !== draft.agentMaxToolRounds) commitSettings({ ...draft, agentMaxToolRounds: value })
  }, [agentMaxToolRoundsInput, draft])

  const showNotificationPermissionMessage = (result: Exclude<BrowserNotificationPermissionResult, { ok: true }>) => {
    if (result.reason === 'unsupported') {
      showToast(isTauri ? '当前环境不支持系统通知' : '当前浏览器不支持系统通知', 'error')
    } else if (result.reason === 'insecure') {
      showToast('系统通知需要 HTTPS 或 localhost 安全上下文', 'error')
    } else if (result.reason === 'denied') {
      showToast(isTauri ? '通知权限已被拒绝，请在 Windows 设置的「通知」中允许本应用发送通知' : '通知权限已被浏览器拒绝，请在地址栏左侧的网站设置中手动开启', 'error')
    } else {
      showToast('没有开启系统通知', 'info')
    }
  }

  const toggleTaskCompletionNotification = async () => {
    if (draft.taskCompletionNotification) {
      commitSettings({ ...draft, taskCompletionNotification: false })
      return
    }

    const result = await requestBrowserNotificationPermission()
    if (result.ok) {
      commitSettings({ ...draft, taskCompletionNotification: true })
      showToast('任务通知已开启', 'success')
    } else {
      showNotificationPermissionMessage(result)
    }
  }

  const dataTransferMode = isExportingData ? 'export' : isImportingData ? 'import' : null
  const showDataTransferBusyToast = () => {
    const now = Date.now()
    if (now - dataTransferToastAtRef.current < 1000) return
    dataTransferToastAtRef.current = now
    showToast(dataTransferMode === 'export' ? '正在导出' : '正在导入', 'info')
  }

  useEffect(() => {
    dataTransferToastAtRef.current = 0
    if (!dataTransferMode) return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const preventKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      showDataTransferBusyToast()
    }
    window.addEventListener('keydown', preventKeyDown, true)
    return () => window.removeEventListener('keydown', preventKeyDown, true)
  }, [dataTransferMode, showToast])

  const blockDataTransferInteraction = (e: React.SyntheticEvent) => {
    if (!dataTransferMode) return
    e.preventDefault()
    e.stopPropagation()
    showDataTransferBusyToast()
  }

  const blockDataTransferClick = (e: React.SyntheticEvent) => {
    if (!dataTransferMode) return
    e.preventDefault()
    e.stopPropagation()
  }

  useCloseOnEscape(showSettings && !dataTransferMode, handleClose)
  const updateModalOpen = useReleaseUpdates((s) => s.modalOpen)
  usePreventBackgroundScroll(showSettings, updateModalOpen ? updateModalScrollRef : showZipDownloadRouteManager ? zipDownloadRouteScrollBoundaryRef : settingsScrollBoundaryRef)

  if (!showSettings) return null

  const handleExport = async () => {
    if (exportTasks && hasRunningOperations) {
      showToast('有任务正在进行，完成或停止后再导出', 'error')
      return
    }
    setIsExportingData(true)
    try {
      await trackDataTransfer(() => exportData({ exportConfig, exportTasks }))
    } finally {
      setIsExportingData(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) {
      if (importTasks && hasRunningOperations) {
        showToast('有任务正在进行，完成或停止后再导入', 'error')
        e.target.value = ''
        return
      }
      setIsImportingData(true)
      try {
        const imported = await trackDataTransfer(() => importData(files, { importConfig: presetConfigOnly ? false : importConfig, importTasks }))
        if (imported) setDraft(normalizeSettings(useStore.getState().settings))
      } finally {
        setIsImportingData(false)
      }
    }
    e.target.value = ''
  }

  const handleClearAllData = async () => {
    await trackDataTransfer(() => clearData({ clearConfig, clearTasks }))
    setDraft(normalizeSettings(useStore.getState().settings))
  }

  return (
        <div
          data-no-drag-select
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onPointerDownCapture={blockDataTransferInteraction}
          onClickCapture={blockDataTransferClick}
          onContextMenuCapture={blockDataTransferInteraction}
        >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in"
        onClick={handleClose}
      />
      <div
        ref={settingsScrollBoundaryRef}
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/50 bg-white/95 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10 flex h-[85vh] sm:h-[600px] flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 p-5 border-b border-gray-100 dark:border-white/[0.08]">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            设置
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label="关闭"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
          {/* Sidebar */}
          <div className="w-full sm:w-48 shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
            <nav className="flex-1 overflow-x-auto sm:overflow-y-auto custom-scrollbar p-3 space-x-1 sm:space-x-0 sm:space-y-1 flex sm:flex-col">
              <button
                onClick={() => setActiveTab('api')}
                className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${activeTab === 'api' ? 'bg-white dark:bg-white/[0.08] shadow-sm text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                密钥管理
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${activeTab === 'general' ? 'bg-white dark:bg-white/[0.08] shadow-sm text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                习惯配置
              </button>
              <button
                onClick={() => setActiveTab('agent')}
                className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${activeTab === 'agent' ? 'bg-white dark:bg-white/[0.08] shadow-sm text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 14h2M20 14h2M15 13v2M9 13v2" />
                </svg>
                Agent 配置
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`whitespace-nowrap flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${activeTab === 'data' ? 'bg-white dark:bg-white/[0.08] shadow-sm text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                数据管理
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent relative overflow-hidden">
            <div
              ref={tabScrollRef}
              onScroll={(e) => { tabScrollTopsRef.current[activeTab] = e.currentTarget.scrollTop }}
              className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 sm:p-6"
            >
            {activeTab === 'general' && (
              <GeneralSettingsTab
                draft={draft}
                zipDownloadRouteSummary={zipDownloadRouteSummary}
                commitSettings={commitSettings}
                onOpenZipDownloadRouteManager={() => setShowZipDownloadRouteManager(true)}
                toggleTaskCompletionNotification={toggleTaskCompletionNotification}
              />
            )}

            {activeTab === 'agent' && (
              <AgentSettingsTab
                draft={draft}
                activeProfile={activeProfile}
                agentMaxToolRoundsInput={agentMaxToolRoundsInput}
                setAgentMaxToolRoundsInput={setAgentMaxToolRoundsInput}
                commitSettings={commitSettings}
                commitAgentMaxToolRounds={commitAgentMaxToolRounds}
              />
            )}
            
            {activeTab === 'api' && (
              <ApiKeySettingsTab
                draft={draft}
                commitSettings={commitSettings}
              />
            )}
            
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-black/[0.04] p-4 border border-transparent dark:bg-white/[0.06] flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {isTauri
                      ? '所有的配置、任务和生成的图片均仅保存在本机的数据目录中（除非您使用的服务商存储了它们）。如果您需要更换安装位置或使用其他设备，请先导出备份。'
                      : '所有的配置、任务和生成的图片均仅保存在您的浏览器本地（除非您使用的服务商存储了它们）。如果您需要清理浏览器站点数据、重置浏览器或使用其他设备，请先导出备份。'}
                  </div>
                </div>

                {isTauri && <StorageInfoSection />}

                <div className="rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ExportIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">导出数据</h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{isTauri ? `受文件大小限制，过大的备份将自动分卷，${draft.saveLocationMode === 'default' ? '全部分卷保存到默认保存地址' : '导出时选择一个文件夹保存全部分卷'}` : '受浏览器文件大小限制，过大的备份将自动分卷导出，请允许浏览器下载多个文件'}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <Checkbox
                      checked={exportConfig}
                      onChange={setExportConfig}
                      label="包含配置"
                    />
                    <Checkbox
                      checked={exportTasks}
                      onChange={setExportTasks}
                      label="包含任务和图片"
                    />
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={(!exportConfig && !exportTasks) || isExportingData}
                    className="w-full rounded-xl bg-gray-100/80 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-gray-100/80 disabled:hover:text-gray-700 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white dark:disabled:hover:bg-white/[0.06] dark:disabled:hover:text-gray-300 flex items-center justify-center gap-2"
                  >
                    {isExportingData ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        导出中...
                      </>
                    ) : (
                      '导出所选数据'
                    )}
                  </button>
                </div>

                <div className="rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ImportIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">导入数据</h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">支持一次导入多个普通备份；分卷备份请一次性选中同一批次的全部分卷</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {!presetConfigOnly && <Checkbox
                      checked={importConfig}
                      onChange={setImportConfig}
                      label="包含配置"
                    />}
                    <Checkbox
                      checked={importTasks}
                      onChange={setImportTasks}
                      label="包含任务和图片"
                    />
                  </div>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    disabled={(!(presetConfigOnly ? false : importConfig) && !importTasks) || isImportingData}
                    className="w-full rounded-xl bg-gray-100/80 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-gray-100/80 disabled:hover:text-gray-700 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white dark:disabled:hover:bg-white/[0.06] dark:disabled:hover:text-gray-300 flex items-center justify-center gap-2"
                  >
                    {isImportingData ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        导入中...
                      </>
                    ) : (
                      '从 ZIP 导入所选数据'
                    )}
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".zip"
                    multiple
                    className="hidden"
                    onChange={handleImport}
                  />
                </div>

                <div className="rounded-2xl bg-red-500/[0.06] p-4 dark:bg-red-500/[0.1] space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrashIcon className="w-4 h-4 text-red-600 dark:text-red-400/90" />
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400/90">清除数据</h4>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <Checkbox
                      checked={clearConfig}
                      onChange={setClearConfig}
                      label="包含配置"
                      tone="danger"
                    />
                    <Checkbox
                      checked={clearTasks}
                      onChange={setClearTasks}
                      label="包含任务和图片"
                      tone="danger"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setConfirmDialog({
                        title: '清空所选数据',
                        message: `确定要清空所选的数据吗？此操作不可恢复。`,
                        action: () => handleClearAllData(),
                      })
                    }
                    disabled={!clearConfig && !clearTasks}
                    className="w-full rounded-xl bg-red-500/[0.12] px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-500/[0.18] hover:text-red-700 disabled:opacity-50 disabled:hover:bg-red-500/[0.12] disabled:hover:text-red-600 dark:bg-red-500/[0.18] dark:text-red-400/90 dark:hover:bg-red-500/[0.25] dark:hover:text-red-400 dark:disabled:hover:bg-red-500/[0.18] dark:disabled:hover:text-red-400/90"
                  >
                    清空所选数据
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

        {showZipDownloadRouteManager && (
          <ZipDownloadRouteModal
            routes={draft.zipDownloadRoutes}
            scrollBoundaryRef={zipDownloadRouteScrollBoundaryRef}
            onSetEnabled={setZipDownloadRouteEnabled}
            onClose={() => setShowZipDownloadRouteManager(false)}
          />
        )}
    </div>
  )
}
