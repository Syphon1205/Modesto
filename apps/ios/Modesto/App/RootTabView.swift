import SwiftUI

enum AppTab: Hashable {
    case home, chats, terminal, inbox
}

/// A compact, conversation-first shell. Projects and the operations feed are
/// contextual destinations; terminal access and decisions deserve permanent
/// places because they are the things people reach for while away from a Mac.
struct RootTabView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @State private var selectedTab: AppTab = .home
    @State private var homePath = NavigationPath()
    @State private var chatsPath = NavigationPath()
    @State private var terminalPath = NavigationPath()
    @State private var inboxPath = NavigationPath()

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $homePath) {
                HomeView(environment: environment, path: $homePath)
                    .navigationDestination(for: AppRoute.self, destination: destination)
            }
            .tabItem { Label("Home", systemImage: "house.fill") }
            .tag(AppTab.home)

            NavigationStack(path: $chatsPath) {
                ChatsView(environment: environment, path: $chatsPath)
                    .navigationDestination(for: AppRoute.self, destination: destination)
            }
            .tabItem { Label("Chats", systemImage: "message.fill") }
            .tag(AppTab.chats)

            NavigationStack(path: $terminalPath) {
                TerminalWorkspaceView(environment: environment, path: $terminalPath)
                    .navigationDestination(for: AppRoute.self, destination: destination)
            }
            .tabItem { Label("Terminal", systemImage: "terminal.fill") }
            .tag(AppTab.terminal)

            NavigationStack(path: $inboxPath) {
                InboxView(environment: environment, path: $inboxPath)
                    .navigationDestination(for: AppRoute.self, destination: destination)
            }
            .tabItem { Label("Inbox", systemImage: "tray.full.fill") }
            .tag(AppTab.inbox)
        }
        .tint(ModestoColor.accent)
    }

    @ViewBuilder
    private func destination(for route: AppRoute) -> some View {
        switch route {
        case .project(let id):
            ProjectDetailView(projectId: id, environment: environment)
        case .session(let id):
            SessionDetailView(sessionId: id, environment: environment)
        }
    }
}

#Preview {
    RootTabView()
        .environmentObject(AppEnvironment.mock)
        .preferredColorScheme(.dark)
}
