import Foundation

@MainActor
final class ActivityViewModel: ObservableObject {
    @Published private(set) var entries: [ActivityEntry] = []
    @Published private(set) var isLoading = false
    @Published var selectedCategory: ActivityCategory?

    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    var filteredEntries: [ActivityEntry] {
        guard let selectedCategory else { return entries }
        return entries.filter { $0.category == selectedCategory }
    }

    func count(for category: ActivityCategory) -> Int {
        entries.count { $0.category == category }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }

        let sessions = (try? await environment.agentSessions.allSessions()) ?? []
        let projects = (try? await environment.projects.allProjects()) ?? []

        var sessionEntries: [ActivityEntry] = []
        for session in sessions {
            let events = (try? await environment.agentSessions.events(sessionId: session.id)) ?? []
            for event in events {
                sessionEntries.append(
                    ActivityEntry(
                        id: event.id,
                        category: category(for: session, event: event),
                        contextTitle: session.title,
                        summary: event.summary,
                        detail: event.detail,
                        symbolName: event.kind.symbolName,
                        colorToken: colorToken(for: session, event: event),
                        timestamp: event.createdAt,
                        sessionId: session.id,
                        projectId: session.projectId,
                        providerKind: session.providerKind
                    )
                )
            }
        }

        var deploymentEntries: [ActivityEntry] = []
        for project in projects {
            let deployments = (try? await environment.deployments.deployments(projectId: project.id)) ?? []
            for deployment in deployments {
                deploymentEntries.append(
                    ActivityEntry(
                        id: deployment.id,
                        category: .deployments,
                        contextTitle: "\(project.name) · \(deployment.environment)",
                        summary: deployment.commitMessage ?? deployment.status.label,
                        detail: deployment.url,
                        symbolName: "arrow.up.forward.app",
                        colorToken: deployment.status.colorToken,
                        timestamp: deployment.createdAt,
                        sessionId: nil,
                        projectId: project.id,
                        providerKind: nil
                    )
                )
            }
        }

        entries = (sessionEntries + deploymentEntries).sorted { $0.timestamp > $1.timestamp }
    }

    private func category(for session: AgentSession, event: SessionEvent) -> ActivityCategory {
        switch event.kind {
        case .approvalRequested, .approvalResolved, .gitAction:
            return .reviews
        default:
            break
        }
        switch session.status {
        case .error: return .failed
        case .completed: return .completed
        default: return .running
        }
    }

    private func colorToken(for session: AgentSession, event: SessionEvent) -> ModestoColorToken {
        switch category(for: session, event: event) {
        case .running: .running
        case .completed: .success
        case .failed: .danger
        case .reviews: .accent
        case .deployments: .accent
        }
    }
}
