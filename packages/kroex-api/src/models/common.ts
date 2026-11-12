/**
 * Shared primitive aliases. The backend's IDs are UUID strings (36 chars)
 * everywhere; timestamps are ISO-8601 datetime strings.
 * Source: API Integration Specification §5.5.
 */
export type Id = string
export type IsoDateTime = string
