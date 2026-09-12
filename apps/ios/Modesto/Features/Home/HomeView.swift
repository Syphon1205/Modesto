import SwiftUI

/// A calm command center: resume work, make a decision, or start a chat.
/// Everything else is one tap away without competing for permanent chrome.
struct HomeView: View {
    @StateObject private var viewModel: HomeViewModel
    @Binding private var path: NavigationPath
    private let environment: AppEnvironment

    @State private var isPresentingNewTask = false
    @State private var isPresentingConnections = false
    @State private var isPresentingSettings = false
    @State private var isPresentingProjects = false
    @State private var isPresentingActivity = false
    @State private var modalPath = NavigationPath()

    init(environment: AppEnvironment, path: Binding<NavigationPath>) {
        self.environment = environment
        _viewModel = StateObject(wrappedValue: HomeViewModel(environment: environment))
        _path = path
    }

    var body: some View {
        ZStack {
            AppBackdrop()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                    commandCenter

                    if !attentionWork.isEmpty {
                        spotlightSection(title: "Waiting on you", sessions: attentionWork, tint: ModestoColor.warning)
                    }

                    if !runningWork.isEmpty {
                        spotlightSection(title: "In progress", sessions: runningWork, tint: ModestoColor.running)
                    }

                    recentProjects
                    activityShortcut

                    if viewModel.activeWork.isEmpty && !viewModel.isLoading {
                        EmptyStateView(
                            symbolName: "checkmark.circle",
                            title: "Everything is quiet",
                            subtitle: "Start a conversation and your live work will collect here."
                        )
                    }
                }
                .padding(.horizontal, ModestoSpacing.lg)
                .padding(.top, ModestoSpacing.sm)
                .padding(.bottom, ModestoSpacing.xxl)
            }
            .refreshable { await viewModel.load() }
        }
        .navigationTitle("Modesto")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    isPresentingConnections = true
                } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(connectedHostCount > 0 ? ModestoColor.success : ModestoColor.warning)
                            .frame(width: 8, height: 8)
                        Text(connectedHostCount > 0 ? "\(connectedHostCount) online" : "Connect")
                            .font(ModestoFont.caption)
                    }
                }
                .accessibilityLabel("Connections, \(connectedHostCount) hosts online")
            }

            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    isPresentingNewTask = true
                } label: {
                    Label("New Chat", systemImage: "square.and.pencil")
                }

                Menu {
                    Button { isPresentingConnections = true } label: {
                        Label("Connections", systemImage: "point.3.connected.trianglepath.dotted")
                    }
                    Button { isPresentingSettings = true } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                } label: {
                    Label("More", systemImage: "ellipsis")
                }
            }
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $isPresentingNewTask) {
            NewChatView(environment: environment) { session in
                isPresentingNewTask = false
                path.append(AppRoute.session(id: session.id))
            }
        }
        .sheet(isPresented: $isPresentingConnections) {
            ConnectionHubView(environment: environment)
        }
        .sheet(isPresented: $isPresentingSettings) {
            NavigationStack {
                SettingsView(environment: environment)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { isPresentingSettings = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $isPresentingProjects) {
            modalNavigation {
                ProjectsView(environment: environment, path: $modalPath)
            }
        }
        .sheet(isPresented: $isPresentingActivity) {
            modalNavigation {
                ActivityView(environment: environment, path: $modalPath)
            }
        }
    }

    private var commandCenter: some View {
        GlassSurface(cornerRadius: ModestoRadius.lg, padding: ModestoSpacing.lg) {
            VStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                    Text("Overview")
                        .font(ModestoFont.headline)
                        .foregroundStyle(ModestoColor.textPrimary)
                    Text(commandCenterSubtitle)
                        .font(ModestoFont.body)
                        .foregroundStyle(ModestoColor.textSecondary)
                }

                HStack(spacing: 0) {
                    metric(value: viewModel.activeWork.count, label: "Active", tint: ModestoColor.textPrimary)
                    metricDivider
                    metric(value: viewModel.pendingActionCount, label: "Needs you", tint: ModestoColor.warning)
                    metricDivider
                    metric(value: connectedHostCount, label: "Hosts", tint: ModestoColor.success)
                }

                Button {
                    isPresentingNewTask = true
                } label: {
                    HStack(spacing: ModestoSpacing.md) {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .bold))
                        Text("Start something new")
                            .font(ModestoFont.bodyMedium)
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, ModestoSpacing.lg)
                    .padding(.vertical, ModestoSpacing.md + 2)
                    .background(ModestoColor.accent, in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func metric(value: Int, label: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(value)")
                .font(.system(.title2, design: .rounded, weight: .semibold))
                .foregroundStyle(tint)
            Text(label)
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var metricDivider: some View {
        Rectangle()
            .fill(ModestoColor.borderSubtle)
            .frame(width: 1, height: 38)
            .padding(.horizontal, ModestoSpacing.md)
    }

    private func spotlightSection(title: String, sessions: [AgentSession], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack {
                Text(title)
                    .font(ModestoFont.headline)
                    .foregroundStyle(ModestoColor.textPrimary)
                Text("\(sessions.count)")
                    .font(ModestoFont.caption)
                    .foregroundStyle(tint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(tint.opacity(0.12), in: Capsule())
                Spacer()
            }

            VStack(spacing: ModestoSpacing.sm) {
                ForEach(sessions.prefix(3)) { session in
                    Button {
                        path.append(AppRoute.session(id: session.id))
                    } label: {
                        AgentSpotlightRow(session: session)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var recentProjects: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            SectionHeader(title: "Projects", actionTitle: "See all") {
                isPresentingProjects = true
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: ModestoSpacing.sm) {
                    ForEach(viewModel.recentProjects) { project in
                        Button {
                            path.append(AppRoute.project(id: project.id))
                        } label: {
                            ProjectChip(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .contentMargins(.horizontal, 1, for: .scrollContent)
        }
    }

    private var activityShortcut: some View {
        Button {
            isPresentingActivity = true
        } label: {
            GlassSurface(padding: ModestoSpacing.md) {
                HStack(spacing: ModestoSpacing.md) {
                    RowIconBadge(systemImage: "waveform.path.ecg", tint: ModestoColor.violet)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Activity")
                            .font(ModestoFont.bodyMedium)
                            .foregroundStyle(ModestoColor.textPrimary)
                        Text("Commands, changes, reviews, and deploys")
                            .font(ModestoFont.footnote)
                            .foregroundStyle(ModestoColor.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ModestoColor.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func modalNavigation<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        NavigationStack(path: $modalPath) {
            content()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .project(let id): ProjectDetailView(projectId: id, environment: environment)
                    case .session(let id): SessionDetailView(sessionId: id, environment: environment)
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            isPresentingProjects = false
                            isPresentingActivity = false
                        }
                    }
                }
        }
    }

    private var attentionWork: [AgentSession] {
        viewModel.activeWork.filter { $0.status == .waitingForApproval || $0.status == .waitingForInput }
    }

    private var runningWork: [AgentSession] {
        viewModel.activeWork.filter { $0.status == .running }
    }

    private var connectedHostCount: Int {
        viewModel.hosts.count { $0.status == .connected }
    }

    private var commandCenterSubtitle: String {
        if viewModel.pendingActionCount > 0 {
            return "\(viewModel.pendingActionCount) decision\(viewModel.pendingActionCount == 1 ? "" : "s") can move your agents forward."
        }
        if !runningWork.isEmpty {
            return "Your agents are working. Drop in when you want to steer them."
        }
        return "Ready when you are."
    }
}

private struct AgentSpotlightRow: View {
    let session: AgentSession

    var body: some View {
        GlassSurface(padding: ModestoSpacing.md) {
            HStack(alignment: .top, spacing: ModestoSpacing.md) {
                ProviderAvatar(provider: session.providerKind, size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: ModestoSpacing.sm) {
                        Text(session.title)
                            .font(ModestoFont.bodyMedium)
                            .foregroundStyle(ModestoColor.textPrimary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        CompactRelativeTime(date: session.updatedAt)
                            .font(ModestoFont.caption)
                            .foregroundStyle(ModestoColor.textTertiary)
                    }
                    Text(session.progress?.currentStep ?? session.lastMessagePreview ?? "Ready")
                        .font(ModestoFont.footnote)
                        .foregroundStyle(ModestoColor.textSecondary)
                        .lineLimit(2)
                    HStack(spacing: ModestoSpacing.sm) {
                        StatusDot(token: session.status.colorToken, label: session.status.label, pulse: session.status == .running)
                        if let branch = session.branch {
                            Label(branch, systemImage: "arrow.triangle.branch")
                                .font(ModestoFont.caption)
                                .foregroundStyle(ModestoColor.textTertiary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }
}

private struct ProjectChip: View {
    let project: Project

    var body: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack {
                RowIconBadge(systemImage: "folder.fill", tint: ModestoColor.accent)
                Spacer()
                if project.activeSessionCount > 0 {
                    Text("\(project.activeSessionCount) active")
                        .font(ModestoFont.caption)
                        .foregroundStyle(ModestoColor.running)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(ModestoFont.bodyMedium)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .lineLimit(1)
                Text(project.defaultBranch ?? project.workspacePath)
                    .font(ModestoFont.monoSmall)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(1)
            }
        }
        .frame(width: 178, alignment: .leading)
        .padding(ModestoSpacing.md)
        .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                .strokeBorder(ModestoColor.borderSubtle, lineWidth: 0.75)
        }
    }
}

#Preview {
    NavigationStack {
        HomeView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
