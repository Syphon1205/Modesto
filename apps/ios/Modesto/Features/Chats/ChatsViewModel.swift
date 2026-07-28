import Foundation

@MainActor
final class ChatsViewModel: ObservableObject {
    @Published private(set) var sessions: [AgentSession] = []
    @Published private(set) var isLoading = false

    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        sessions = ((try? await environment.agentSessions.allSessions()) ?? [])
            .sorted { $0.updatedAt > $1.updatedAt }
    }
}
