import Foundation

/// Discovers and tracks the machines and connections Modesto iOS can talk
/// to: host machines (the desktop Mac, remote SSH boxes) and what's
/// connected on them (agent provider CLIs) or alongside them (GitHub,
/// Vercel). A production implementation would back this with the same
/// WebSocket RPC the desktop web app uses (see
/// `packages/contracts/src/ws.ts`); the mock below just returns fixtures.
protocol RuntimeConnectionService: Sendable {
    func hosts() async throws -> [RuntimeHost]
    func connections() async throws -> [RuntimeConnection]

    /// Live updates as connections come online, drop, or error. A mock
    /// implementation may emit a single snapshot and finish.
    func connectionUpdates() -> AsyncStream<[RuntimeConnection]>
}
