import SwiftUI

struct ProjectGitTab: View {
    var status: GitStatusSummary?
    var projectId: String
    var environment: AppEnvironment

    var body: some View {
        if let status {
            VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
                if let branch = status.branch {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                            Label(branch.name, systemImage: "arrow.triangle.branch")
                                .font(ModestoFont.bodyMedium)
                                .foregroundStyle(ModestoColor.textPrimary)
                            if let upstream = branch.upstream {
                                Text(upstream)
                                    .font(ModestoFont.mono)
                                    .foregroundStyle(ModestoColor.textSecondary)
                            }
                            HStack(spacing: ModestoSpacing.md) {
                                Label("\(branch.ahead)", systemImage: "arrow.up")
                                Label("\(branch.behind)", systemImage: "arrow.down")
                            }
                            .font(ModestoFont.caption)
                            .foregroundStyle(ModestoColor.textSecondary)
                        }
                    }
                }

                if let pr = status.pullRequest {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                            HStack {
                                Text("#\(pr.id)")
                                    .font(ModestoFont.mono)
                                    .foregroundStyle(ModestoColor.textTertiary)
                                if pr.isDraft {
                                    Text("Draft")
                                        .font(ModestoFont.caption)
                                        .foregroundStyle(ModestoColor.textSecondary)
                                        .padding(.horizontal, ModestoSpacing.sm)
                                        .padding(.vertical, 2)
                                        .background(ModestoColor.surfaceRaised, in: Capsule())
                                }
                                Spacer()
                                Text(pr.state.capitalized)
                                    .font(ModestoFont.caption)
                                    .foregroundStyle(ModestoColor.textSecondary)
                            }
                            Text(pr.title)
                                .font(ModestoFont.bodyMedium)
                                .foregroundStyle(ModestoColor.textPrimary)
                            if let url = URL(string: pr.url) {
                                Link(destination: url) {
                                    Label("Open pull request", systemImage: "arrow.up.right")
                                        .font(ModestoFont.caption)
                                }
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                    SectionHeader(title: "Changed files")
                    if status.changedFiles.isEmpty {
                        EmptyStateView(symbolName: "doc.text", title: "No changes", subtitle: "The working tree is clean.")
                    } else {
                        ForEach(status.changedFiles) { file in
                            NavigationLink {
                                DiffDetailView(projectId: projectId, path: file.path, environment: environment)
                            } label: {
                                ChangedFileRow(file: file)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        } else {
            EmptyStateView(
                symbolName: "arrow.triangle.branch",
                title: "No Git status",
                subtitle: "This project isn't backed by a Git repository yet."
            )
        }
    }
}
