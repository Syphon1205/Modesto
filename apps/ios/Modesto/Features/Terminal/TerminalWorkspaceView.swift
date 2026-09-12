import SwiftUI

/// A first-class terminal workspace rather than a buried project-detail tab.
/// The terminal still runs on the selected connected host; iOS is only the
/// input/output surface, so credentials and the working tree stay on the host.
struct TerminalWorkspaceView: View {
    let environment: AppEnvironment
    @Binding var path: NavigationPath

    @State private var sessions: [AgentSession] = []
    @State private var selectedSessionId: String?
    @State private var isLoading = false

    private var selectedSession: AgentSession? {
        sessions.first { $0.id == selectedSessionId }
    }

    var body: some View {
        ZStack {
            AppBackdrop(accent: ModestoColor.cyan)

            ScrollView {
                VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
                    terminalSwitcher

                    if let session = selectedSession {
                        ProjectTerminalTab(
                            sessionId: session.id,
                            cwd: session.worktreePath ?? "~",
                            environment: environment
                        )

                        Button {
                            path.append(AppRoute.session(id: session.id))
                        } label: {
                            Label("Open agent conversation", systemImage: "bubble.left.and.bubble.right.fill")
                                .font(ModestoFont.subheadline)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    } else if !isLoading {
                        EmptyStateView(
                            symbolName: "terminal",
                            title: "Pick a workspace",
                            subtitle: "Choose an agent task above to open a shell in its worktree. Commands execute on the connected machine."
                        )
                        .padding(.top, ModestoSpacing.xxl)
                    }
                }
                .padding(.horizontal, ModestoSpacing.lg)
                .padding(.top, ModestoSpacing.sm)
                .padding(.bottom, ModestoSpacing.xxl)
            }
            .refreshable { await load() }
        }
        .navigationTitle("Terminal")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
    }

    private var terminalSwitcher: some View {
        GlassSurface(padding: ModestoSpacing.md) {
            Menu {
                ForEach(sessions) { session in
                    Button {
                        selectedSessionId = session.id
                    } label: {
                        if session.id == selectedSessionId {
                            Label(session.title, systemImage: "checkmark")
                        } else {
                            Text(session.title)
                        }
                    }
                }
            } label: {
                HStack(spacing: ModestoSpacing.md) {
                    if let session = selectedSession {
                        ProviderAvatar(provider: session.providerKind, size: 42)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.title)
                                .font(ModestoFont.bodyMedium)
                                .foregroundStyle(ModestoColor.textPrimary)
                                .lineLimit(1)
                            Text(session.worktreePath ?? "Default workspace")
                                .font(ModestoFont.monoSmall)
                                .foregroundStyle(ModestoColor.textSecondary)
                                .lineLimit(1)
                        }
                    } else {
                        RowIconBadge(systemImage: "terminal.fill", tint: ModestoColor.cyan)
                        Text("Choose a task workspace")
                            .font(ModestoFont.bodyMedium)
                            .foregroundStyle(ModestoColor.textPrimary)
                    }

                    Spacer(minLength: ModestoSpacing.sm)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ModestoColor.textTertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        sessions = ((try? await environment.agentSessions.allSessions()) ?? [])
            .filter { $0.worktreePath != nil }
            .sorted { $0.updatedAt > $1.updatedAt }

        if selectedSessionId == nil || !sessions.contains(where: { $0.id == selectedSessionId }) {
            selectedSessionId = sessions.first(where: { $0.status == .running })?.id ?? sessions.first?.id
        }
    }
}

#Preview {
    NavigationStack {
        TerminalWorkspaceView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
