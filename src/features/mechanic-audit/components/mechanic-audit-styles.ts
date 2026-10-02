import type { CSSProperties } from 'react'

export const S = {
  bg0: '#1a1b1e',
  bg2: '#2b2d31',
  bg3: '#313338',
  text: '#f2f3f5',
  textMuted: '#b5bac1',
  textFaint: '#949ba4',
  textDim: '#6d6f78',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  accent: '#5865f2',
  warning: '#f0b232',
  danger: '#da373c',
}

export const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  backgroundColor: S.bg0,
  border: `1px solid ${S.border}`,
  color: S.text,
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}

export const selectStyle: CSSProperties = { ...inputStyle }

export const labelStyle: CSSProperties = {
  fontSize: 11,
  color: S.textDim,
  display: 'block',
  marginBottom: 4,
}
