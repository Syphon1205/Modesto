import SwiftUI

struct ProjectDetailView: View {
    @StateObject private var viewModel: ProjectDetailViewModel
    @State private var selectedTab: ProjectDetailTab = .overview
    private let environment: AppEnvironment

    init(projectId: String, environment: AppEnvironment) {
        self.environment = environment
        _viewModel = StateObject(wrappedValue: ProjectDetailViewModel(projectId: projectId, environment: environment))
    }

    var body: some View {
        VStack(spacing: 0) {
            tabPicker

            ScrollView {
                Group {
                    switch selectedTab {
                    case .overview:
                        ProjectOverviewTab(project: viewModel.project, sessions: viewModel.sessions, gitStatus: viewModel.gitStatus)
                    case .agents:
                        ProjectAgentsTab(sessions: viewModel.sessions, environment: environment)
                    case .changes:
                        ProjectGitTab(
                            status: viewModel.gitStatus,
                            projectId: viewModel.project?.id ?? "",
                            environment: environment
                        )
                    case .preview:
                        ProjectPreviewTab(deployments: viewModel.deployments)
                    case .terminal:
                        ProjectTerminalTab(
                            sessionId: viewModel.sessions.first?.id,
                            cwd: viewModel.sessions.first?.worktreePath ?? viewModel.project?.workspacePath ?? "~",
                            environment: environment
                        )
                    }
                }
                .padding(ModestoSpacing.lg)
            }
        }
        .background(ModestoColor.background.ignoresSafeArea())
        .navigationTitle(viewModel.project?.name ?? "Project")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }

    private var tabPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ModestoSpacing.sm) {
                ForEach(ProjectDetailTab.allCases) { tab in
                    FilterChip(title: tab.label, isSelected: selectedTab == tab) {
                        selectedTab = tab
                    }
                }
            }
            .padding(.horizontal, ModestoSpacing.lg)
            .padding(.vertical, ModestoSpacing.sm)
        }
        .fadingHorizontalEdges()
        .background(ModestoColor.background)
        .overlay(alignment: .bottom) {
            Divider().background(ModestoColor.borderSubtle)
        }
    }
}

#Preview {
    NavigationStack {
        ProjectDetailView(projectId: "proj-modesto", environment: .mock)
    }
    .preferredColorScheme(.dark)
}
