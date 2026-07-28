import Foundation

@MainActor
final class SessionDetailViewModel: ObservableObject {
    @Published private(set) var session: AgentSession?
    @Published private(set) var events: [SessionEvent] = []
    @Published private(set) var pendingApproval: Approval?
    @Published private(set) var isLoading = false
    @Published private(set) var isResolvingApproval = false
    @Published private(set) var isSendingMessage = false

    private let sessionId: String
    private let environment: AppEnvironment

    init(sessionId: String, environment: AppEnvironment) {
        self.sessionId = sessionId
        self.environment = environment
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        await refresh()
    }

    private func refresh() async {
        async let sessionTask = environment.agentSessions.session(id: sessionId)
        async let eventsTask = environment.agentSessions.events(sessionId: sessionId)
        async let approvalsTask = environment.approvals.pendingApprovals()

        session = try? await sessionTask
        events = (try? await eventsTask) ?? []
        pendingApproval = (try? await approvalsTask)?.first { $0.sessionId == sessionId }
    }

    func resolve(_ decision: ApprovalDecision) async {
        guard pendingApproval != nil else { return }
        isResolvingApproval = true
        defer { isResolvingApproval = false }
        try? await environment.approvals.resolve(approvalId: pendingApproval!.id, decision: decision)
        await refresh()
    }

    /// Sends a follow-up message, then refreshes twice: immediately (to
    /// show the message itself) and again after the mock's simulated
    /// reply delay, so the round trip feels real without a live stream.
    func sendMessage(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSendingMessage else { return }
        isSendingMessage = true
        defer { isSendingMessage = false }

        try? await environment.agentSessions.sendMessage(sessionId: sessionId, text: trimmed)
        await refresh()

        Task {
            try? await Task.sleep(nanoseconds: 1_700_000_000)
            await refresh()
        }
    }
}
