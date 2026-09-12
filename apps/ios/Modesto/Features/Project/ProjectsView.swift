import SwiftUI

/// A searchable project directory. Keeping this separate from Work lets the
/// first tab stay focused on live agent state instead of becoming a dashboard.
struct ProjectsView: View {
    let environment: AppEnvironment
    @Binding var path: NavigationPath

    @State private var projects: [Project] = []
    @State private var query = ""
    @State private var isLoading = false

    private var filteredProjects: [Project] {
        guard !query.isEmpty else { return projects }
        return projects.filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || $0.workspacePath.localizedCaseInsensitiveContains(query)
                || ($0.defaultBranch?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: ModestoSpacing.sm) {
                if filteredProjects.isEmpty && !isLoading {
                    EmptyStateView(
                        symbolName: query.isEmpty ? "folder" : "magnifyingglass",
                        title: query.isEmpty ? "No projects yet" : "No matching projects",
                        subtitle: query.isEmpty
                            ? "Projects from connected machines will appear here."
                            : "Try a project name, path, or branch."
                    )
                } else {
                    ForEach(filteredProjects) { project in
                        Button {
                            path.append(AppRoute.project(id: project.id))
                        } label: {
                            ProjectRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(ModestoSpacing.lg)
        }
        .background(ModestoColor.background.ignoresSafeArea())
        .navigationTitle("Projects")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Projects, paths, or branches")
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        projects = (try? await environment.projects.allProjects()) ?? []
    }
}

#Preview {
    NavigationStack {
        ProjectsView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
