import Foundation

/// Session lifecycle and timeline access. Mirrors the shape of orchestration
/// domain events pushed over `orchestration.domainEvent` in the desktop
/// server, projected here into `SessionEvent` for a mobile timeline.
protocol AgentSessionService: Sendable {
    /// Every session regardless of status — the operations timeline needs
    /// completed and failed sessions too, not just what's currently active.
    func allSessions() async throws -> [AgentSession]
    func activeSessions() async throws -> [AgentSession]
    func sessions(projectId: String) async throws -> [AgentSession]
    func session(id: String) async throws -> AgentSession
    func events(sessionId: String) async throws -> [SessionEvent]

    /// Starts a brand-new session from a first message — the mobile
    /// equivalent of typing into a fresh chat. Returns the created session
    /// so the caller can navigate straight into it.
    func startSession(
        projectId: String,
        providerKind: ProviderKind,
        hostId: String?,
        firstMessage: String
    ) async throws -> AgentSession

    /// Sends a follow-up message to a session — answering a "needs input"
    /// question or steering a running turn, mirroring the reply composer in
    /// Codex/Claude's mobile apps.
    func sendMessage(sessionId: String, text: String) async throws

    /// Live event stream for a session's timeline. A mock implementation may
    /// emit the current history and finish.
    func eventStream(sessionId: String) -> AsyncStream<SessionEvent>
}
