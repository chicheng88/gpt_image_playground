import { useEffect, useRef, useState } from 'react'
import { GIF_FRAME_COUNT_RANGE, GIF_FRAME_DURATION_RANGE, IMAGE_COMPLEXITIES, type ApiProfile, type ParamDisabledReasons, type TaskParams } from '../../types'
import { dismissAllTooltips } from '../../lib/tooltipDismiss'
import Select, { type SelectOption } from '../Select'
import ButtonTooltip from './buttonTooltip'
import { CHIP_BASE_CLASS, CHIP_IDLE_CLASS } from './paramPopoverChip'

const CHIP_CLASS = `${CHIP_BASE_CLASS} ${CHIP_IDLE_CLASS}`
const CHIP_DISABLED_CLASS = 'h-8 px-3.5 rounded-full bg-black/[0.03] dark:bg-white/[0.04] opacity-50 cursor-not-allowed text-xs text-gray-700 dark:text-gray-200'

interface HintTooltipState {
  visible: boolean
  show: () => void
  hide: () => void
  clearTimer: () => void
  startTouch: () => void
}

/** GIF 帧参数输入框：超出范围时取边界值，清空或无效时保留原值 */
function GifParamInput({ value, range, onCommit }: {
  value: number
  range: { min: number; max: number }
  onCommit: (value: number) => void
}) {
  const [input, setInput] = useState(String(value))
  const latestRef = useRef({ input, value, onCommit })
  latestRef.current = { input, value, onCommit }

  const parse = (text: string, fallback: number) => {
    const parsed = Number(text)
    if (!text.trim() || !Number.isFinite(parsed)) return fallback
    return Math.min(range.max, Math.max(range.min, Math.round(parsed)))
  }

  // 输入框被移除时不会触发 blur，卸载时补一次提交
  useEffect(() => () => {
    const latest = latestRef.current
    const next = parse(latest.input, latest.value)
    if (next !== latest.value) latest.onCommit(next)
  }, [])

  return (
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onBlur={() => {
        const next = parse(input, value)
        setInput(String(next))
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      type="number"
      min={range.min}
      max={range.max}
      style={{ width: `${Math.max(2, input.length)}ch` }}
      className="bg-transparent text-xs focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}

export default function InputParamsPanel({
  params,
  setParams,
  activeProfile,
  modelOptions,
  onModelChange,
  isFalProvider,
  isFalTextToImage,
  displaySize,
  qualityOptions,
  selectClass,
  transparentOutputAvailable,
  showTransparentOutputControl,
  transparentOutputEnabled,
  transparentOutputHint,
  onTransparentOutputMenuOpenChange,
  compressionHint,
  compressionDisabled,
  outputCompressionInput,
  setOutputCompressionInput,
  commitOutputCompression,
  moderationHint,
  moderationDisabled,
  complexityHint,
  disabledReasons,
  hasInputImages,
  agentAutoImageCount,
  outputImageLimit,
  nInput,
  setNInputFocused,
  commitN,
  handleNInputChange,
  handleNLimitIncreaseAttempt,
  showAgentNHint,
  hideNLimitHint,
  startAgentNHintTouch,
  clearAgentNHintTouchTimer,
  nLimitHint,
  nLimitHintText,
  streamConcurrentByN,
  streamConcurrentHint,
  sizeHint,
  qualityHint,
  onOpenSizePicker,
}: {
  params: TaskParams
  setParams: (patch: Partial<TaskParams>) => void
  activeProfile: ApiProfile
  modelOptions: SelectOption[]
  onModelChange: (model: string) => void
  isFalProvider: boolean
  isFalTextToImage: boolean
  displaySize: string
  qualityOptions: SelectOption[]
  selectClass: string
  transparentOutputAvailable: boolean
  showTransparentOutputControl: boolean
  transparentOutputEnabled: boolean
  transparentOutputHint: HintTooltipState
  onTransparentOutputMenuOpenChange: (open: boolean) => void
  compressionHint: HintTooltipState
  compressionDisabled: boolean
  outputCompressionInput: string
  setOutputCompressionInput: (value: string) => void
  commitOutputCompression: () => void
  moderationHint: HintTooltipState
  moderationDisabled: boolean
  complexityHint: HintTooltipState
  disabledReasons: ParamDisabledReasons
  hasInputImages: boolean
  agentAutoImageCount: boolean
  outputImageLimit: number
  nInput: string
  setNInputFocused: (focused: boolean) => void
  commitN: () => void
  handleNInputChange: (value: string) => void
  handleNLimitIncreaseAttempt: (preventDefault: () => void) => void
  showAgentNHint: () => void
  hideNLimitHint: () => void
  startAgentNHintTouch: () => void
  clearAgentNHintTouchTimer: () => void
  nLimitHint: HintTooltipState
  nLimitHintText: string
  streamConcurrentByN: boolean
  streamConcurrentHint: HintTooltipState
  sizeHint: HintTooltipState
  qualityHint: HintTooltipState
  onOpenSizePicker: () => void
}) {
  const prefix = (text: string) => <span className="mr-1.5 text-gray-400 dark:text-gray-500">{text}</span>
  const isGif = params.output_format === 'gif'

  return (
    <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 min-w-0 text-xs">
      {/* 极小的收缩权重：放不下时优先截断模型 ID */}
      <div className="min-w-0 max-w-full sm:shrink-[0.01] max-sm:flex-auto">
        <Select
          value={activeProfile.model}
          onChange={(val) => onModelChange(String(val))}
          options={modelOptions}
          showValueTooltips
          menuClassName="min-w-max"
          className={CHIP_CLASS}
        />
      </div>
      <div
        className="relative max-sm:flex-auto sm:shrink-0"
        onMouseEnter={sizeHint.show}
        onMouseLeave={sizeHint.hide}
        onTouchStart={sizeHint.startTouch}
        onTouchEnd={sizeHint.clearTimer}
        onTouchCancel={sizeHint.hide}
        onClick={sizeHint.show}
      >
        <button
          type="button"
          onClick={() => { dismissAllTooltips(); onOpenSizePicker() }}
          className={`flex w-full items-center ${CHIP_CLASS}`}
        >
          {prefix('尺寸')}
          <span className="font-mono">{displaySize}</span>
        </button>
        <ButtonTooltip
          visible={(isFalTextToImage || activeProfile.codexCli) && sizeHint.visible}
          text={isFalTextToImage
            ? <>fal.ai 的文生图模式不支持 <code className="rounded bg-white/10 px-1 py-0.5 font-mono">auto</code> 参数</>
            : 'Codex CLI 不支持尺寸参数，此处设置仅基于提示词工程'}
        />
      </div>
      <div
        className="relative max-sm:flex-auto sm:shrink-0"
        onMouseEnter={qualityHint.show}
        onMouseLeave={qualityHint.hide}
        onTouchStart={qualityHint.startTouch}
        onTouchEnd={qualityHint.clearTimer}
        onTouchCancel={qualityHint.hide}
        onClick={qualityHint.show}
      >
        <Select
          value={activeProfile.codexCli ? 'auto' : isFalProvider && params.quality === 'auto' ? 'high' : params.quality}
          onChange={(val) => {
            if (!activeProfile.codexCli) setParams({ quality: val as TaskParams['quality'] })
          }}
          options={qualityOptions}
          disabled={activeProfile.codexCli}
          prefix={prefix('质量')}
          menuClassName="min-w-max"
          className={activeProfile.codexCli ? CHIP_DISABLED_CLASS : CHIP_CLASS}
        />
        <ButtonTooltip
          visible={(activeProfile.codexCli || isFalProvider) && qualityHint.visible}
          text={isFalProvider ? <>fal.ai 不支持 <code className="rounded bg-white/10 px-1 py-0.5 font-mono">auto</code> 质量参数</> : 'Codex CLI 不支持质量参数'}
        />
      </div>
      {/* 复杂度：仅 GPT Image 2.6 及以上模型可用 */}
      <div
        className="relative max-sm:flex-auto sm:shrink-0"
        onMouseEnter={complexityHint.show}
        onMouseLeave={complexityHint.hide}
        onTouchStart={complexityHint.startTouch}
        onTouchEnd={complexityHint.clearTimer}
        onTouchCancel={complexityHint.hide}
        onClick={complexityHint.show}
      >
        <Select
          value={disabledReasons.complexity ? 'auto' : params.complexity}
          onChange={(val) => {
            if (!disabledReasons.complexity) setParams({ complexity: val as TaskParams['complexity'] })
          }}
          options={IMAGE_COMPLEXITIES.map((value) => ({ label: value, value }))}
          disabled={Boolean(disabledReasons.complexity)}
          prefix={prefix('复杂度')}
          menuClassName="min-w-max"
          className={disabledReasons.complexity ? CHIP_DISABLED_CLASS : CHIP_CLASS}
        />
        <ButtonTooltip visible={Boolean(disabledReasons.complexity) && complexityHint.visible} text={disabledReasons.complexity} />
      </div>
      <label
        className={`relative flex items-center max-sm:flex-auto sm:shrink-0 ${agentAutoImageCount ? CHIP_DISABLED_CLASS : `${CHIP_CLASS} cursor-text`}`}
        onMouseEnter={() => { showAgentNHint(); streamConcurrentHint.show() }}
        onMouseLeave={() => { hideNLimitHint(); streamConcurrentHint.hide() }}
        onTouchStart={() => { startAgentNHintTouch(); streamConcurrentHint.startTouch() }}
        onTouchEnd={() => { clearAgentNHintTouchTimer(); streamConcurrentHint.clearTimer() }}
        onTouchCancel={() => {
          clearAgentNHintTouchTimer()
          hideNLimitHint()
          streamConcurrentHint.hide()
        }}
        onClick={() => { showAgentNHint(); streamConcurrentHint.show() }}
      >
        {prefix('数量')}
        <input
          value={nInput}
          onChange={(e) => handleNInputChange(e.target.value)}
          onFocus={() => setNInputFocused(true)}
          onBlur={() => {
            setNInputFocused(false)
            commitN()
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              handleNLimitIncreaseAttempt(() => e.preventDefault())
            }
          }}
          onWheel={(e) => {
            if (e.deltaY < 0) {
              handleNLimitIncreaseAttempt(() => e.preventDefault())
            }
          }}
          disabled={agentAutoImageCount}
          type={agentAutoImageCount ? 'text' : 'number'}
          min={agentAutoImageCount ? undefined : 1}
          max={agentAutoImageCount ? undefined : outputImageLimit}
          style={{ width: `${Math.max(1, nInput.length)}ch` }}
          className="bg-transparent text-xs focus:outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <ButtonTooltip visible={nLimitHint.visible} text={nLimitHintText} />
        <ButtonTooltip visible={streamConcurrentByN && streamConcurrentHint.visible && !nLimitHint.visible} text="数量大于 1 时会将多图生成拆分为并发单图" />
      </label>
      <div className="max-sm:flex-auto sm:shrink-0">
        <Select
          value={params.output_format}
          onChange={(val) => {
            setParams({
              output_format: val as TaskParams['output_format'],
              ...(val === 'png' || val === 'svg' || val === 'gif' ? { output_compression: null } : {}),
              ...(val === 'jpeg' ? { transparent_output: false } : {}),
            })
          }}
          options={[
            { label: 'PNG', value: 'png' },
            { label: 'JPEG', value: 'jpeg' },
            { label: 'WebP', value: 'webp' },
            { label: 'SVG', value: 'svg', disabledReason: disabledReasons.svg },
            { label: 'GIF', value: 'gif', disabledReason: disabledReasons.gif },
          ]}
          prefix={prefix('格式')}
          menuClassName="min-w-max"
          className={CHIP_CLASS}
        />
      </div>
      {isGif && (
        <>
          <label className={`relative flex items-center max-sm:flex-auto sm:shrink-0 ${CHIP_CLASS} cursor-text`}>
            {prefix('帧数')}
            <GifParamInput
              value={params.frame_count}
              range={GIF_FRAME_COUNT_RANGE}
              onCommit={(frame_count) => setParams({ frame_count })}
            />
          </label>
          <label className={`relative flex items-center max-sm:flex-auto sm:shrink-0 ${CHIP_CLASS} cursor-text`}>
            {prefix('每帧 ms')}
            <GifParamInput
              value={params.frame_duration_ms}
              range={GIF_FRAME_DURATION_RANGE}
              onCommit={(frame_duration_ms) => setParams({ frame_duration_ms })}
            />
          </label>
        </>
      )}
      {hasInputImages && params.output_format === 'svg' && (
        <span className="max-sm:flex-auto rounded-full bg-amber-50 px-3.5 py-1.5 text-xs leading-none text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          SVG 只能用于文生图
        </span>
      )}
      {/* 透明背景控件按需隐藏，需要时取消注释即可恢复
      {showTransparentOutputControl && (
        <div
          className="relative max-sm:flex-auto sm:shrink-0"
          onMouseEnter={transparentOutputHint.show}
          onMouseLeave={transparentOutputHint.hide}
          onTouchStart={transparentOutputHint.startTouch}
          onTouchEnd={transparentOutputHint.clearTimer}
          onTouchCancel={transparentOutputHint.hide}
          onClick={transparentOutputHint.show}
        >
          <Select
            value={transparentOutputEnabled ? 'on' : 'off'}
            onChange={(val) => {
              if (!transparentOutputAvailable) return
              setParams({
                transparent_output: val === 'on',
                ...(params.output_format === 'png' ? { output_compression: null } : {}),
              })
            }}
            options={[
              { label: 'false', value: 'off' },
              { label: 'true', value: 'on' },
            ]}
            prefix={prefix('透明')}
            menuClassName="min-w-max"
            className={CHIP_CLASS}
            onOpenChange={onTransparentOutputMenuOpenChange}
          />
          <ButtonTooltip
            visible={transparentOutputHint.visible}
            text="实现方式可在设置的 API 配置中选择"
          />
        </div>
      )}
      */}
      {!showTransparentOutputControl && (
        <label
          className={`relative flex items-center max-sm:flex-auto sm:shrink-0 ${compressionDisabled ? CHIP_DISABLED_CLASS : `${CHIP_CLASS} cursor-text`}`}
          onMouseEnter={compressionHint.show}
          onMouseLeave={compressionHint.hide}
          onTouchStart={compressionHint.startTouch}
          onTouchEnd={compressionHint.clearTimer}
          onTouchCancel={compressionHint.hide}
          onClick={compressionHint.show}
        >
          {prefix('压缩率')}
          <input
            value={outputCompressionInput}
            onChange={(e) => setOutputCompressionInput(e.target.value)}
            onBlur={commitOutputCompression}
            disabled={compressionDisabled}
            type="number"
            min={0}
            max={100}
            placeholder="0-100"
            style={{ width: `${Math.max(5, outputCompressionInput.length)}ch` }}
            className="bg-transparent text-xs focus:outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <ButtonTooltip
            visible={compressionHint.visible}
            text={isFalProvider ? 'fal.ai 不支持压缩率参数' : '仅 JPEG 和 WebP 支持压缩率'}
          />
        </label>
      )}
      <div
        className="relative max-sm:flex-auto sm:shrink-0"
        onMouseEnter={moderationHint.show}
        onMouseLeave={moderationHint.hide}
        onTouchStart={moderationHint.startTouch}
        onTouchEnd={moderationHint.clearTimer}
        onTouchCancel={moderationHint.hide}
        onClick={moderationHint.show}
      >
        <Select
          value={moderationDisabled ? 'auto' : params.moderation}
          onChange={(val) => {
            if (!moderationDisabled) setParams({ moderation: val as TaskParams['moderation'] })
          }}
          options={[
            { label: 'auto', value: 'auto' },
            { label: 'low', value: 'low' },
          ]}
          disabled={moderationDisabled}
          prefix={prefix('审核')}
          menuClassName="min-w-max"
          className={moderationDisabled ? CHIP_DISABLED_CLASS : CHIP_CLASS}
        />
        <ButtonTooltip
          visible={moderationDisabled && moderationHint.visible}
          text="fal.ai 不支持审核参数"
        />
      </div>
    </div>
  )
}
