import SwiftUI

struct ProjectOverviewTab: View {
    var project: Project?
    var sessions: [AgentSession]
    var gitStatus: GitStatusSummary?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
            if let project {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                        Label(project.workspacePath, systemImage: "folder")
                            .font(ModestoFont.mono)
                            .foregroundStyle(ModestoColor.textSecondary)
                            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
                        if let branch = gitStatus?.branch?.name ?? project.defaultBranch {
                            Label(branch, systemImage: "arrow.triangle.branch")
                                .font(ModestoFont.mono)
                                .foregroundStyle(ModestoColor.textSecondary)
                                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
                        }
                    }
                }
            }

            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: ModestoSpacing.sm) {
                    stats
                }
            } else {
                HStack(spacing: ModestoSpacing.sm) {
                    stats
                }
            }

            if !sessions.isEmpty {
                VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                    SectionHeader(title: "Recent agents")
                    ForEach(sessions.prefix(3)) { session in
                        NavigationLink(value: AppRoute.session(id: session.id)) {
                            SessionRow(session: session)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var stats: some View {
        StatTile(value: "\(sessions.count)", label: "Agents", token: .running)
        StatTile(value: "\(gitStatus?.changedFiles.count ?? 0)", label: "Changed files", token: .warning)
        StatTile(value: gitStatus?.pullRequest != nil ? "1" : "0", label: "Open PR", token: .accent)
    }
}

private struct StatTile: View {
    var value: String
    var label: String
    var token: ModestoColorToken

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(ModestoFont.title)
                    .foregroundStyle(token.color)
                Text(label)
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
