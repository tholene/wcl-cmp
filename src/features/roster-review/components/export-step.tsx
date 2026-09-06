import { useMemo, useState, type FC } from 'react'
import { RosterButton, RosterSectionTitle, RosterTextarea } from './roster-ui'

type ExportStepProps = {
  markdown: string
  json: string
  fileStem: string
  onBack: () => void
  onReset: () => void
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

const downloadText = (filename: string, text: string, type: string): void => {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const formatSize = (text: string): string => {
  const bytes = new Blob([text]).size
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export const ExportStep: FC<ExportStepProps> = ({ markdown, json, fileStem, onBack, onReset }) => {
  const [status, setStatus] = useState<string | null>(null)
  const sizes = useMemo(() => ({ markdown: formatSize(markdown), json: formatSize(json) }), [markdown, json])
  const large = new Blob([markdown]).size > 200 * 1024

  const copy = async (label: string, text: string) => {
    const ok = await copyText(text)
    setStatus(ok ? `${label} copied to clipboard.` : `Clipboard unavailable — use the download button for ${label}.`)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        The evidence pack is Markdown (readable, includes the review prompt) plus JSON (full structured evidence). Paste the
        Markdown into ChatGPT or Claude, or attach both files. Nothing is sent anywhere by this app.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <RosterButton tone="primary" onClick={() => copy('Markdown', markdown)}>Copy Markdown ({sizes.markdown})</RosterButton>
        <RosterButton onClick={() => copy('JSON', json)}>Copy JSON ({sizes.json})</RosterButton>
        <RosterButton onClick={() => downloadText(`${fileStem}.md`, markdown, 'text/markdown')}>Download .md</RosterButton>
        <RosterButton onClick={() => downloadText(`${fileStem}.json`, json, 'application/json')}>Download .json</RosterButton>
        {status && <span className="text-[11px] text-slate-300">{status}</span>}
      </div>
      {large && <div className="alert-warning">The Markdown pack is large; downloading the files is more reliable than the clipboard.</div>}

      <RosterSectionTitle>Preview</RosterSectionTitle>
      <RosterTextarea value={markdown} onChange={() => undefined} readOnly rows={28} />

      <div className="flex justify-between">
        <RosterButton onClick={onBack}>← Review</RosterButton>
        <RosterButton
          tone="danger"
          onClick={() => {
            if (window.confirm('Start a new roster review? This clears the raid window, availability, decisions and notes stored in this browser.')) onReset()
          }}
        >
          Start a new review
        </RosterButton>
      </div>
    </div>
  )
}
