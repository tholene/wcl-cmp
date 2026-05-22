import type { WowRole } from './wow-class-spec'

export type ClassSpecOverride = {
  className: string
  specName: string
  role?: WowRole
}
