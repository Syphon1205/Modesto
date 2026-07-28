import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var hosts: [RuntimeHost] = []
    @Published private(set) var connections: [RuntimeConnection] = []
    @Published private(set) var recentProjects: [Project] = []
    @Published private(set) var activeWork: [AgentSession] = []
    @Published private(set) var pendingActionCount = 0
    @Published private(set) var isLoading = false

    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func connections(on host: RuntimeHost) -> [RuntimeConnection] {
        connections.filter { $0.hostId == host.id }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }

        async let hostsTask = environment.runtimeConnections.hosts()
        async let connectionsTask = environment.runtimeConnections.connections()
        async let projectsTask = environment.projects.recentProjects(limit: 4)
        async let sessionsTask = environment.agentSessions.activeSessions()
        async let approvalsTask = environment.approvals.pendingApprovals()

        hosts = (try? await hostsTask) ?? []
        connections = (try? await connectionsTask) ?? []
        recentProjects = (try? await projectsTask) ?? []

        let sessions = (try? await sessionsTask) ?? []
        let approvalCount = (try? await approvalsTask)?.count ?? 0
        let waitingForInputCount = sessions.count { $0.status == .waitingForInput }
        pendingActionCount = approvalCount + waitingForInputCount
        // "Active Work" leads with what needs a decision, then what's
        // actively running, newest first within each — a flat status list
        // buries the two sessions someone actually needs to act on.
        activeWork = sessions.sorted { lhs, rhs in
            let lhsPriority = priority(for: lhs.status)
            let rhsPriority = priority(for: rhs.status)
            if lhsPriority != rhsPriority { return lhsPriority < rhsPriority }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    private func priority(for status: AgentSessionStatus) -> Int {
        switch status {
        case .waitingForApproval, .waitingForInput: 0
        case .running: 1
        case .interrupted, .error: 2
        case .idle, .completed: 3
        }
    }
}
