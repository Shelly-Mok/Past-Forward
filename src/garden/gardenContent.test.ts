import { describe, expect, it } from 'vitest'
import { eraAges, eraChoice, eraNodeForAge, nearestEraAge, OWN_CHOICE_ID, signalPortraits, timelineFlowerPose, withOwnChoice } from './gardenContent'

describe('garden era content', () => {
  it('keeps a real fork at every five-year mark, not just the 24-year demo', () => {
    expect(nearestEraAge(18)).toBe(18)
    expect(nearestEraAge(22)).toBe(20)
    expect(nearestEraAge(47)).toBe(45)
    expect(nearestEraAge(52)).toBe(50)
    expect(nearestEraAge(67)).toBe(65)
    expect(eraNodeForAge(0).choices).toHaveLength(6)
    expect(eraNodeForAge(22).choices.length).toBeGreaterThanOrEqual(5)
    expect(eraNodeForAge(90).choices.length).toBeGreaterThanOrEqual(5)
    for (let age = 0; age <= 100; age += 5) {
      expect(eraNodeForAge(age).age).toBe(age)
      expect(eraNodeForAge(age).choices.length).toBeGreaterThanOrEqual(5)
    }
  })
  it('keeps choice shares as percentages for every authored node', () => {
    for (const age of eraAges()) {
      const total = eraNodeForAge(age).choices.reduce((sum, choice) => sum + choice.peer, 0)
      expect(total).toBeGreaterThanOrEqual(99)
      expect(total).toBeLessThanOrEqual(101)
    }
  })
  it('after planting, only shows same-choice A and a cross-era B', () => {
    const portraits = signalPortraits(20, 'major')
    expect(portraits.map(item => item.slot)).toEqual(['A · 同代相近', 'B · 跨代对照'])
    expect(portraits.map(item => item.kind)).toEqual(['A', 'B'])
    expect(portraits.every(item => item.choice.id === 'major')).toBe(true)
    expect(portraits.some(item => item.slot.includes('旁路'))).toBe(false)
    expect(portraits[0].npc.name).toBe(eraNodeForAge(20).choices[0].npc.name)
    expect(portraits[0].age).toBe(20)
    for (const field of ['background', 'options', 'choice', 'cost', 'reflection'] as const) {
      expect(portraits[0].npc.causal[field].length).toBeGreaterThan(4)
    }
  })
  it('keeps different-choice NPCs for backtrack only', () => {
    const alts = signalPortraits(20, 'major', 'backtrack')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.every(item => item.choice.id !== 'major')).toBe(true)
    expect(alts.every(item => item.slot.includes('旁路'))).toBe(true)
  })
  it('gives every era choice a five-step causal chain', () => {
    for (const age of [0, 18, 35, 45, 55, 60, 75, 100]) {
      for (const item of eraNodeForAge(age).choices) {
        expect(item.npc.causal.options).toContain('/')
        expect(item.npc.causal.choice.length).toBeGreaterThan(2)
      }
    }
  })
  it('always leaves the last flower for the player to name', () => {
    const node = withOwnChoice(eraNodeForAge(18), '去当兵后来又复员')
    expect(node.choices.at(-1)?.id).toBe(OWN_CHOICE_ID)
    expect(node.choices.at(-1)?.label).toBe('去当兵后来又复员')
    expect(node.choices.filter(item => item.id === OWN_CHOICE_ID)).toHaveLength(1)
    expect(withOwnChoice(eraNodeForAge(18)).choices.at(-1)?.label).toBe('写下你自己的路')
  })
  it('keeps the usual age-5 forks and treats dance as part of art school', () => {
    const five = eraNodeForAge(5).choices.map(item => item.label)
    expect(five).toEqual([
      '上幼儿园',
      '去艺校',
      '在家自育 / 跟随父母迁移',
      '提前上小学 / 跳级',
      '这一年常往医院跑',
    ])
    expect(five).not.toContain('去舞校')
    expect(eraChoice(5, 'art')?.label).toBe('去艺校')
    expect(eraNodeForAge(15).choices.map(item => item.label)).toContain('走艺考')
    expect(eraNodeForAge(15).choices.map(item => item.label)).not.toContain('去体校')
  })

  it('lets later timeline flowers grow beyond the earliest seed pose', () => {
    expect(timelineFlowerPose(0)).toBe(0)
    expect(timelineFlowerPose(20)).toBeGreaterThan(timelineFlowerPose(5))
    expect(timelineFlowerPose(40)).toBeGreaterThan(timelineFlowerPose(20))
  })
})
