import SwiftUI

/// Every agent session in this project, led by structured progress
/// (`SessionRow` shows the current step, changed files, and test status)
/// rather than a raw status word — the point is to answer "what's it
/// actually doing" without opening the terminal.
struct ProjectAgentsTab: View {
    var sessions: [AgentSession]
    var environment: AppEnvironment

    var body: some View {
        if sessions.isEmpty {
            EmptyStateView(
                symbolName: "bolt.slash",
                title: "No agents yet",
                subtitle: "Start a new task to spin up an agent session here."
            )
        } else {
            VStack(spacing: ModestoSpacing.sm) {
                ForEach(sessions) { session in
                    NavigationLink(value: AppRoute.session(id: session.id)) {
                        SessionRow(session: session)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
