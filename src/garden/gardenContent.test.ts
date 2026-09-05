import { describe, expect, it } from 'vitest'
import { eraNodeForAge, nearestEraAge, signalPortraits, timelineFlowerPose } from './gardenContent'

describe('garden era content', () => {
  it('snaps off-grid ages to the nearest authored node', () => {
    expect(nearestEraAge(18)).toBe(18)
    expect(nearestEraAge(22)).toBe(20)
    expect(eraNodeForAge(22).choices).toHaveLength(3)
    expect(eraNodeForAge(90).choices).toHaveLength(2)
  })
  it('keeps choice shares as percentages for every node', () => {
    for (const age of [0, 5, 15, 25, 40, 80, 100]) {
      const total = eraNodeForAge(age).choices.reduce((sum, choice) => sum + choice.peer, 0)
      expect(total).toBeGreaterThanOrEqual(99)
      expect(total).toBeLessThanOrEqual(101)
    }
  })
  it('fills the three upper signal slots for a planted choice', () => {
    const portraits = signalPortraits(20, 'major')
    expect(portraits.map(item => item.slot)).toEqual(['同代 · 相近选择', '同代 · 不同取舍', '跨代 · 相似困境'])
    expect(portraits[0].npc.name).toBe(eraNodeForAge(20).choices[0].npc.name)
    expect(portraits[0].choice.id).toBe('major')
    expect(portraits[0].age).toBe(20)
    expect(portraits[1].choice.id).not.toBe(portraits[0].choice.id)
    expect(new Set(portraits.map(item => item.npc.name)).size).toBeGreaterThan(1)
    for (const field of ['background', 'options', 'choice', 'cost', 'reflection'] as const) {
      expect(portraits[0].npc.causal[field].length).toBeGreaterThan(4)
    }
  })
  it('gives every era choice a five-step causal chain', () => {
    for (const age of [0, 18, 35, 60, 100]) {
      for (const item of eraNodeForAge(age).choices) {
        expect(item.npc.causal.options).toContain('/')
        expect(item.npc.causal.choice.length).toBeGreaterThan(2)
      }
    }
  })
  it('lets later timeline flowers grow beyond the earliest seed pose', () => {
    expect(timelineFlowerPose(0)).toBe(0)
    expect(timelineFlowerPose(20)).toBeGreaterThan(timelineFlowerPose(5))
    expect(timelineFlowerPose(40)).toBeGreaterThan(timelineFlowerPose(20))
  })
})
