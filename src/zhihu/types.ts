export type ZhihuSearchItem = {
  Title?: string
  ContentType?: string
  ContentID?: string
  ContentText?: string
  Summary?: string
  Url?: string
  CommentCount?: number
  VoteUpCount?: number
  LikeCount?: number
  AuthorName?: string
  AuthorAvatar?: string
  AuthorBadgeText?: string
  AuthorityLevel?: string | number
  RankingScore?: number
  EditTime?: number
  Author?: { Name?: string; Headline?: string; Avatar?: string; avatar?: string }
}

export type ZhihuHealth = {
  ok: boolean
  zhihu?: {
    cli: boolean
    authConfigured: boolean
  }
}
