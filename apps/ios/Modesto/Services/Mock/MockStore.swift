import Foundation

/// The single source of mutable mock state, shared by every `Mock*Service`
/// so actions taken through one service (resolving an approval, sending a
/// message, starting a terminal) are reflected everywhere else that reads
/// the same underlying session — instead of each service owning its own
/// disconnected copy of `MockData`.
actor MockStore {
    private var sessionsById: [String: AgentSession]
    private var approvalsById: [String: Approval]
    private var events: [SessionEvent]
    private var terminalsBySessionId: [String: TerminalStream]

    init() {
        sessionsById = Dictionary(uniqueKeysWithValues: MockData.sessions.map { ($0.id, $0) })
        approvalsById = Dictionary(uniqueKeysWithValues: MockData.approvals.map { ($0.id, $0) })
        events = MockData.events
        terminalsBySessionId = MockData.terminals
    }

    // MARK: Sessions

    func allSessions() -> [AgentSession] {
        Array(sessionsById.values)
    }

    func session(id: String) -> AgentSession? {
        sessionsById[id]
    }

    /// Creates a brand-new session from a first message, the mock
    /// equivalent of an agent picking up a freshly typed chat.
    func startSession(projectId: String, providerKind: ProviderKind, firstMessage: String) -> AgentSession {
        let now = Date()
        let session = AgentSession(
            id: UUID().uuidString,
            projectId: projectId,
            title: MockStore.deriveTitle(from: firstMessage),
            providerKind: providerKind,
            status: .running,
            branch: nil,
            worktreePath: nil,
            lastMessagePreview: firstMessage,
            progress: SessionProgress(
                currentStep: "Getting started",
                completedSteps: [],
                pendingSteps: [],
                changedFileCount: 0,
                testStatus: .none,
                testSummary: nil
            ),
            createdAt: now,
            updatedAt: now
        )
        sessionsById[session.id] = session
        events.append(SessionEvent(
            id: UUID().uuidString,
            sessionId: session.id,
            projectId: projectId,
            kind: .userMessage,
            summary: firstMessage,
            detail: nil,
            createdAt: now
        ))
        return session
    }

    private static func deriveTitle(from message: String) -> String {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let firstLine = trimmed.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? trimmed
        guard firstLine.count > 60 else { return firstLine }
        let cutoff = firstLine.index(firstLine.startIndex, offsetBy: 60)
        return String(firstLine[..<cutoff]) + "…"
    }

    // MARK: Approvals

    func allApprovals() -> [Approval] {
        Array(approvalsById.values)
    }

    /// Resolves an approval and, when it belongs to a session waiting on
    /// exactly that approval, moves the session out of `.waitingForApproval`
    /// and drops a timeline event — so Home, Inbox, and the session detail
    /// screen all agree on what happened.
    @discardableResult
    func resolveApproval(id: String, decision: ApprovalDecision) -> Approval? {
        guard var approval = approvalsById[id] else { return nil }
        approval.decision = decision
        approvalsById[id] = approval

        if var session = sessionsById[approval.sessionId], session.status == .waitingForApproval {
            session.status = (decision == .decline || decision == .cancel) ? .idle : .running
            session.updatedAt = Date()
            sessionsById[session.id] = session

            events.append(SessionEvent(
                id: UUID().uuidString,
                sessionId: session.id,
                projectId: session.projectId,
                kind: .approvalResolved,
                summary: decision == .decline || decision == .cancel
                    ? "Declined: \(approval.title)"
                    : "Approved: \(approval.title)",
                detail: nil,
                createdAt: Date()
            ))
        }
        return approval
    }

    // MARK: Events

    func events(sessionId: String) -> [SessionEvent] {
        events.filter { $0.sessionId == sessionId }.sorted { $0.createdAt < $1.createdAt }
    }

    /// Appends the user's message, flips the session to `running`, and
    /// returns the session so the caller can schedule a simulated reply.
    @discardableResult
    func appendUserMessage(sessionId: String, text: String) -> AgentSession? {
        guard var session = sessionsById[sessionId] else { return nil }
        events.append(SessionEvent(
            id: UUID().uuidString,
            sessionId: sessionId,
            projectId: session.projectId,
            kind: .userMessage,
            summary: text,
            detail: nil,
            createdAt: Date()
        ))
        session.status = .running
        session.lastMessagePreview = text
        session.updatedAt = Date()
        sessionsById[sessionId] = session
        return session
    }

    /// Simulates the agent's side of the conversation after a short delay,
    /// so replying from the phone feels like a real round trip instead of
    /// a message that vanishes into nothing.
    func appendCannedReply(sessionId: String) {
        guard var session = sessionsById[sessionId] else { return }
        let reply = "Got it — picking this up now. I'll post an update here once it's done."
        events.append(SessionEvent(
            id: UUID().uuidString,
            sessionId: sessionId,
            projectId: session.projectId,
            kind: .assistantMessage,
            summary: reply,
            detail: nil,
            createdAt: Date()
        ))
        session.lastMessagePreview = reply
        session.updatedAt = Date()
        sessionsById[sessionId] = session
    }

    // MARK: Terminals

    func terminal(sessionId: String) -> TerminalStream? {
        terminalsBySessionId[sessionId]
    }

    func startTerminal(sessionId: String, cwd: String) -> TerminalStream {
        if let existing = terminalsBySessionId[sessionId] {
            return existing
        }
        let stream = TerminalStream(
            id: "term-\(sessionId)",
            sessionId: sessionId,
            cwd: cwd,
            status: .running,
            lines: []
        )
        terminalsBySessionId[sessionId] = stream
        return stream
    }

    @discardableResult
    func appendTerminalLine(sessionId: String, line: TerminalLine) -> TerminalStream? {
        guard var stream = terminalsBySessionId[sessionId] else { return nil }
        stream.lines.append(line)
        terminalsBySessionId[sessionId] = stream
        return stream
    }

    /// A canned response for whatever command was just typed, so the
    /// terminal feels alive without a real shell behind it.
    func appendCannedTerminalOutput(sessionId: String, forCommand command: String) {
        let output = MockStore.cannedOutput(for: command)
        appendTerminalLine(
            sessionId: sessionId,
            line: TerminalLine(id: UUID().uuidString, text: output, isCommand: false, timestamp: Date())
        )
    }

    private static func cannedOutput(for command: String) -> String {
        let trimmed = command.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "" }
        if trimmed.hasPrefix("ls") { return "Modesto.xcodeproj  Modesto  README.md" }
        if trimmed.hasPrefix("git status") { return "On branch main — nothing to commit, working tree clean" }
        if trimmed.hasPrefix("pwd") { return "~/dev/modesto" }
        if trimmed.hasPrefix("clear") { return "" }
        return "command not found: \(trimmed.split(separator: " ").first.map(String.init) ?? trimmed)"
    }
}
