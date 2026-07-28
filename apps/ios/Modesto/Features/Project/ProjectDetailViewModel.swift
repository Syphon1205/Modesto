import Foundation

enum ProjectDetailTab: String, CaseIterable, Identifiable {
    case overview, agents, changes, preview, terminal

    var id: String { rawValue }

    var label: String {
        switch self {
        case .overview: "Overview"
        case .agents: "Agents"
        case .changes: "Changes"
        case .preview: "Preview"
        case .terminal: "Terminal"
        }
    }
}

@MainActor
final class ProjectDetailViewModel: ObservableObject {
    @Published private(set) var project: Project?
    @Published private(set) var sessions: [AgentSession] = []
    @Published private(set) var gitStatus: GitStatusSummary?
    @Published private(set) var deployments: [Deployment] = []
    @Published private(set) var isLoading = false

    private let projectId: String
    private let environment: AppEnvironment

    init(projectId: String, environment: AppEnvironment) {
        self.projectId = projectId
        self.environment = environment
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }

        async let projectTask = environment.projects.project(id: projectId)
        async let sessionsTask = environment.agentSessions.sessions(projectId: projectId)
        async let gitTask = environment.git.status(projectId: projectId)
        async let deploymentsTask = environment.deployments.deployments(projectId: projectId)

        project = try? await projectTask
        sessions = (try? await sessionsTask) ?? []
        gitStatus = try? await gitTask
        deployments = (try? await deploymentsTask) ?? []
    }
}
