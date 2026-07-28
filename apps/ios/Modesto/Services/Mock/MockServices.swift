import Foundation

/// Mock implementations of every runtime service protocol, all backed by
/// one shared `MockStore` so state stays consistent across services (see
/// `MockStore.swift`). A production networking layer (WebSocket RPC,
/// matching `packages/contracts/src/ws.ts`) will live alongside these under
/// `Services/Live/` without touching anything in `Services/Protocols` or
/// the views that consume them.
enum MockLatency {
    static func short() async {
        try? await Task.sleep(nanoseconds: 120_000_000)
    }
}

struct MockRuntimeConnectionService: RuntimeConnectionService {
    func hosts() async throws -> [RuntimeHost] {
        await MockLatency.short()
        return MockData.runtimeHosts
    }

    func connections() async throws -> [RuntimeConnection] {
        await MockLatency.short()
        return MockData.runtimeConnections
    }

    func connectionUpdates() -> AsyncStream<[RuntimeConnection]> {
        AsyncStream { continuation in
            continuation.yield(MockData.runtimeConnections)
            continuation.finish()
        }
    }
}

struct MockProjectService: ProjectService {
    let store: MockStore

    func allProjects() async throws -> [Project] {
        await MockLatency.short()
        return await enrichedProjects()
    }

    func recentProjects(limit: Int) async throws -> [Project] {
        await MockLatency.short()
        return Array((await enrichedProjects()).sorted { $0.lastActivityAt > $1.lastActivityAt }.prefix(limit))
    }

    func project(id: String) async throws -> Project {
        await MockLatency.short()
        guard let project = (await enrichedProjects()).first(where: { $0.id == id }) else {
            throw MockServiceError.notFound
        }
        return project
    }

    /// Recomputes session-derived counts from the live store instead of
    /// trusting the static fixture numbers, so a brand-new chat shows up in
    /// its project's counts immediately.
    private func enrichedProjects() async -> [Project] {
        let sessions = await store.allSessions()
        return MockData.projects.map { project in
            var project = project
            let projectSessions = sessions.filter { $0.projectId == project.id }
            project.activeSessionCount = projectSessions.count { $0.status != .completed && $0.status != .error }
            project.pendingApprovalCount = projectSessions.count { $0.status == .waitingForApproval }
            if let mostRecent = projectSessions.map(\.updatedAt).max(), mostRecent > project.lastActivityAt {
                project.lastActivityAt = mostRecent
            }
            return project
        }
    }
}

struct MockAgentSessionService: AgentSessionService {
    let store: MockStore

    func allSessions() async throws -> [AgentSession] {
        await MockLatency.short()
        return await store.allSessions().sorted { $0.updatedAt > $1.updatedAt }
    }

    func activeSessions() async throws -> [AgentSession] {
        await MockLatency.short()
        return await store.allSessions()
            .filter { $0.status != .completed && $0.status != .error }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    func sessions(projectId: String) async throws -> [AgentSession] {
        await MockLatency.short()
        return await store.allSessions()
            .filter { $0.projectId == projectId }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    func session(id: String) async throws -> AgentSession {
        await MockLatency.short()
        guard let session = await store.session(id: id) else {
            throw MockServiceError.notFound
        }
        return session
    }

    func events(sessionId: String) async throws -> [SessionEvent] {
        await MockLatency.short()
        return await store.events(sessionId: sessionId)
    }

    func startSession(
        projectId: String,
        providerKind: ProviderKind,
        hostId _: String?,
        firstMessage: String
    ) async throws -> AgentSession {
        await MockLatency.short()
        let session = await store.startSession(projectId: projectId, providerKind: providerKind, firstMessage: firstMessage)
        Task.detached(priority: .background) {
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            await store.appendCannedReply(sessionId: session.id)
        }
        return session
    }

    func sendMessage(sessionId: String, text: String) async throws {
        await MockLatency.short()
        guard await store.appendUserMessage(sessionId: sessionId, text: text) != nil else {
            throw MockServiceError.notFound
        }
        Task.detached(priority: .background) {
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            await store.appendCannedReply(sessionId: sessionId)
        }
    }

    func eventStream(sessionId: String) -> AsyncStream<SessionEvent> {
        AsyncStream { continuation in
            Task {
                for event in await store.events(sessionId: sessionId) {
                    continuation.yield(event)
                }
                continuation.finish()
            }
        }
    }
}

struct MockApprovalService: ApprovalService {
    let store: MockStore

    func pendingApprovals() async throws -> [Approval] {
        await MockLatency.short()
        return await store.allApprovals().filter { !$0.isResolved }.sorted { $0.requestedAt < $1.requestedAt }
    }

    func resolve(approvalId: String, decision: ApprovalDecision) async throws {
        await MockLatency.short()
        guard await store.resolveApproval(id: approvalId, decision: decision) != nil else {
            throw MockServiceError.notFound
        }
    }
}

struct MockTerminalService: TerminalService {
    let store: MockStore

    func terminal(sessionId: String) async throws -> TerminalStream? {
        await MockLatency.short()
        return await store.terminal(sessionId: sessionId)
    }

    func startTerminal(sessionId: String, cwd: String) async throws -> TerminalStream {
        await MockLatency.short()
        return await store.startTerminal(sessionId: sessionId, cwd: cwd)
    }

    func outputStream(sessionId: String) -> AsyncStream<TerminalLine> {
        AsyncStream { continuation in
            Task {
                for line in await store.terminal(sessionId: sessionId)?.lines ?? [] {
                    continuation.yield(line)
                }
                continuation.finish()
            }
        }
    }

    func write(sessionId: String, input: String) async throws {
        await MockLatency.short()
        await store.appendTerminalLine(
            sessionId: sessionId,
            line: TerminalLine(id: UUID().uuidString, text: input, isCommand: true, timestamp: Date())
        )
        await store.appendCannedTerminalOutput(sessionId: sessionId, forCommand: input)
    }
}

struct MockGitService: GitService {
    func status(projectId: String) async throws -> GitStatusSummary {
        await MockLatency.short()
        guard let status = MockData.gitStatuses[projectId] else {
            throw MockServiceError.notFound
        }
        return status
    }

    func diff(projectId: String, path: String) async throws -> FileDiff {
        await MockLatency.short()
        guard let diff = MockData.diffs[path] else {
            throw MockServiceError.notFound
        }
        return diff
    }
}

struct MockDeploymentService: DeploymentService {
    func deployments(projectId: String) async throws -> [Deployment] {
        await MockLatency.short()
        return MockData.deployments[projectId] ?? []
    }
}

enum MockServiceError: Error {
    case notFound
}
