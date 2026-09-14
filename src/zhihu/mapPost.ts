import type { ChoicePost } from '../garden/riftContent'
import type { ZhihuSearchItem } from './types'

export function plainText(value: unknown, max = 800): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function splitParagraphs(text: string, max = 3): string[] {
  const chunks = text
    .split(/\n+/)
    .map(line => line.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
  if (chunks.length) return chunks.slice(0, max)
  const compact = plainText(text, 480)
  return compact ? [compact] : []
}

export function scoreSearchItem(item: ZhihuSearchItem): number {
  const rank = Number(item.RankingScore) || 0
  const votes = Number(item.VoteUpCount ?? item.LikeCount) || 0
  const authority = Number(item.AuthorityLevel) || 1
  return rank * 0.5 + Math.log10(votes + 1) * 0.3 + (authority / 4) * 0.2
}

export function mapSearchItem(item: ZhihuSearchItem, age: number, choiceId: string): ChoicePost {
  const body = String(item.ContentText || item.Summary || '')
  const paragraphs = splitParagraphs(body)
  const votes = Number(item.VoteUpCount ?? item.LikeCount) || 0
  const authority = item.AuthorityLevel ? `权威 ${item.AuthorityLevel}` : ''
  return {
    source: 'zhihu',
    choiceId,
    age,
    title: plainText(item.Title, 80) || `${age} 岁的相近经历`,
    author: plainText(item.AuthorName || item.Author?.Name, 40) || '知乎用户',
    identity: plainText(item.AuthorBadgeText || item.Author?.Headline || item.ContentType || '知乎答主', 40),
    excerpt: paragraphs[0] || plainText(body, 120) || '这篇公开回答与当前选择相近。',
    paragraphs: paragraphs.length ? paragraphs : [plainText(body, 240) || '这篇公开回答与当前选择相近。'],
    votes: [votes ? `${votes} 赞同` : '', authority].filter(Boolean).join(' · ') || '知乎原文',
    href: String(item.Url || 'https://www.zhihu.com'),
    avatar: String(item.AuthorAvatar || item.Author?.Avatar || item.Author?.avatar || '').trim() || undefined,
  }
}

export function pickSearchItems(items: ZhihuSearchItem[], limit = 3): ZhihuSearchItem[] {
  return [...items].sort((a, b) => scoreSearchItem(b) - scoreSearchItem(a)).slice(0, limit)
}
