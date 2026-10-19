export type PeachesMood = "idle" | "speaking" | "thinking" | "correct" | "retry" | "complete"
export type PeachesReactionKind = "correct" | "retry" | "complete"
export type PeachesReaction = { kind: PeachesReactionKind; questionId: string; serial: number }

export const peachesReactionDuration = { correct: 2000, retry: 1800, complete: 2600 }
