import SwiftUI

/// Reused anywhere a project needs a tappable summary. At accessibility
/// sizes the activity counts move below the title instead of squeezing it.
struct ProjectRow: View {
    var project: Project
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SurfaceCard {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                    HStack(alignment: .top, spacing: ModestoSpacing.md) {
                        RowIconBadge(systemImage: "folder", tint: ModestoColor.accent)
                        identity
                    }
                    activityCounts
                }
            } else {
                HStack(spacing: ModestoSpacing.md) {
                    RowIconBadge(systemImage: "folder", tint: ModestoColor.accent)
                    identity
                    Spacer()
                    activityCounts
                }
            }
        }
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: ModestoSpacing.xs) {
                Text(project.name)
                    .font(ModestoFont.bodyMedium)
                    .foregroundStyle(ModestoColor.textPrimary)
                if project.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundStyle(ModestoColor.textTertiary)
                }
            }
            Text(project.defaultBranch ?? project.workspacePath)
                .font(ModestoFont.footnote)
                .foregroundStyle(ModestoColor.textSecondary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var activityCounts: some View {
        if dynamicTypeSize.isAccessibilitySize {
            HStack(spacing: ModestoSpacing.lg) { countLabels }
        } else {
            VStack(alignment: .trailing, spacing: 4) { countLabels }
        }
    }

    @ViewBuilder
    private var countLabels: some View {
        if project.activeSessionCount > 0 {
            Label("\(project.activeSessionCount)", systemImage: "bolt.fill")
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.running)
        }
        if project.pendingApprovalCount > 0 {
            Label("\(project.pendingApprovalCount)", systemImage: "hand.raised.fill")
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.warning)
        }
    }
}
