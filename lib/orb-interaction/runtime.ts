/**
 * Permanent interaction routing contract.
 *
 * Text and voice always enter the same durable Orb kernel. Realtime captures
 * trusted speech and renders exact response text; it never acts as a second
 * business agent. The legacy Realtime prompt, schemas, and client executor are
 * intentionally retained as dormant rollback assets, but no environment flag
 * can select them at runtime.
 */
export const ORB_REALTIME_TRANSPORT_ONLY = true
