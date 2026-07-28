import Foundation

/// Single dependency container for every runtime service. Views read from
/// this instead of constructing services themselves, so swapping mocks for
/// a live WebSocket-backed implementation later is a one-line change here.
@MainActor
final class AppEnvironment: ObservableObject {
    let runtimeConnections: RuntimeConnectionService
    let projects: ProjectService
    let agentSessions: AgentSessionService
    let approvals: ApprovalService
    let terminals: TerminalService
    let git: GitService
    let deployments: DeploymentService

    init(
        runtimeConnections: RuntimeConnectionService,
        projects: ProjectService,
        agentSessions: AgentSessionService,
        approvals: ApprovalService,
        terminals: TerminalService,
        git: GitService,
        deployments: DeploymentService
    ) {
        self.runtimeConnections = runtimeConnections
        self.projects = projects
        self.agentSessions = agentSessions
        self.approvals = approvals
        self.terminals = terminals
        self.git = git
        self.deployments = deployments
    }

    /// The only environment today. A `.live` factory building
    /// WebSocket-backed services (see `docs/ios-companion-app.md` for the
    /// planned protocol) will live next to this once the server exposes a
    /// mobile-friendly RPC surface.
    static let mock: AppEnvironment = {
        let store = MockStore()
        return AppEnvironment(
            runtimeConnections: MockRuntimeConnectionService(),
            projects: MockProjectService(store: store),
            agentSessions: MockAgentSessionService(store: store),
            approvals: MockApprovalService(store: store),
            terminals: MockTerminalService(store: store),
            git: MockGitService(),
            deployments: MockDeploymentService()
        )
    }()
}
