import { eraChoice, eraNodeForAge } from '../garden/gardenContent'

export function searchQueriesFor(age: number, choiceId: string): string[] {
  const node = eraNodeForAge(age)
  const choice = eraChoice(age, choiceId) ?? node.choices[0]
  const primary = `${node.age}岁 ${choice.label}`
  const event = `${node.event} ${choice.label}`
  return primary === event ? [primary] : [primary, event]
}

export function authorQueryFor(author: string, hint: string): string {
  const name = author.trim()
  const extra = hint.trim()
  return extra ? `${name} ${extra}` : name
}
