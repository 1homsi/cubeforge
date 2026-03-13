/**
 * @beta The multiplayer package is under active development.
 * APIs are functional but may change before 1.0. No server reference implementation
 * is included — you must provide your own WebSocket server.
 */

// Transport
export type { NetTransport } from './transport'
export { createWebSocketTransport } from './wsTransport'

// Room
export type { NetMessage, RoomConfig } from './room'
export { Room } from './room'

// Entity sync
export type { SyncConfig } from './syncEntity'
export { syncEntity } from './syncEntity'

// Network input hook
export type { NetworkInputConfig } from './useNetworkInput'
export { useNetworkInput } from './useNetworkInput'

// Client prediction
export type { PredictionConfig } from './clientPrediction'
export { ClientPrediction } from './clientPrediction'
