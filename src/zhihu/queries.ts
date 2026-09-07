import { eraChoice, eraNodeForAge } from '../garden/gardenContent'
import { authorQueryFor, companionQueries, fallbackNodeQueries, journeyContext, nodeDiscoveryQueries, type JourneyContext } from './recommend'

export { authorQueryFor }

export function searchQueriesFor(age: number, choiceId: string, journey?: JourneyContext): string[] {
  const node = eraNodeForAge(age)
  const choice = eraChoice(age, choiceId) ?? node.choices[0]
  if (!journey) return fallbackNodeQueries(age, choiceId)
  return companionQueries(journey, choice.label, 'same-era')
}

export function discoveryQueriesFor(age: number, journey?: JourneyContext): string[] {
  const node = eraNodeForAge(age)
  return nodeDiscoveryQueries(journey ?? journeyContext({ selectedAge: age, currentAge: null }), node.event)
}
