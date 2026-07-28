import Foundation

@MainActor
final class InboxViewModel: ObservableObject {
    @Published private(set) var items: [InboxItem] = []
    @Published private(set) var isLoading = false
    @Published private(set) var resolvingItemId: String?
    @Published private(set) var sessionsById: [String: AgentSession] = [:]

    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }

        async let approvalsTask = environment.approvals.pendingApprovals()
        async let sessionsTask = environment.agentSessions.activeSessions()

        let approvals = (try? await approvalsTask) ?? []
        let sessions = (try? await sessionsTask) ?? []
        let questions = sessions.filter { $0.status == .waitingForInput }

        sessionsById = Dictionary(uniqueKeysWithValues: sessions.map { ($0.id, $0) })

        items = (approvals.map(InboxItem.approval) + questions.map(InboxItem.question))
            .sorted { $0.requestedAt < $1.requestedAt }
    }

    func session(id: String) -> AgentSession? {
        sessionsById[id]
    }

    func resolve(_ approval: Approval, decision: ApprovalDecision) async {
        let itemId = InboxItem.approval(approval).id
        resolvingItemId = itemId
        defer { resolvingItemId = nil }
        try? await environment.approvals.resolve(approvalId: approval.id, decision: decision)
        items.removeAll { $0.id == itemId }
    }

    func answer(_ session: AgentSession, text: String) async {
        let itemId = InboxItem.question(session).id
        resolvingItemId = itemId
        defer { resolvingItemId = nil }
        try? await environment.agentSessions.sendMessage(sessionId: session.id, text: text)
        items.removeAll { $0.id == itemId }
    }
}
