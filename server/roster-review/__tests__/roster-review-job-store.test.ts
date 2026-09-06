import { describe, expect, it } from 'vitest'
import { RosterJobStore } from '../roster-review-job-store'
import type { RosterEvidenceResult } from '../roster-review.types'

const result: RosterEvidenceResult = {
  reportCodes: ['R1'],
  difficulty: 4,
  encounterIds: [],
  reports: [],
  players: [],
  warnings: [],
  generatedAt: 1,
}

describe('RosterJobStore', () => {
  it('tracks progress and refines the total step count', () => {
    const job = RosterJobStore.create('job-a', 4)
    expect(job.status).toBe('queued')
    RosterJobStore.setStep('job-a', 'Loading…')
    RosterJobStore.advance('job-a')
    RosterJobStore.setTotalSteps('job-a', 10)
    const current = RosterJobStore.get('job-a')!
    expect(current.status).toBe('running')
    expect(current.currentStep).toBe('Loading…')
    expect(current.totalSteps).toBe(10)
    expect(current.percentComplete).toBe(10)
  })

  it('completes as partial when requested and stores the result', () => {
    RosterJobStore.create('job-b', 2)
    RosterJobStore.addWarning('job-b', 'one report failed')
    RosterJobStore.complete('job-b', result, 'partial')
    const job = RosterJobStore.get('job-b')!
    expect(job.status).toBe('partial')
    expect(job.result).toBe(result)
    expect(job.warnings).toEqual(['one report failed'])
    expect(job.percentComplete).toBe(100)
  })

  it('records failures with an error message', () => {
    RosterJobStore.create('job-c', 2)
    RosterJobStore.fail('job-c', 'boom')
    expect(RosterJobStore.get('job-c')).toMatchObject({ status: 'failed', error: 'boom' })
  })
})
