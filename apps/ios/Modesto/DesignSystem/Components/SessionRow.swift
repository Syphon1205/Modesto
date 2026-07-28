import SwiftUI

/// Reused on Work, Project, and Activity. Leads with the agent's current
/// step and reflows vertically at accessibility text sizes.
struct SessionRow: View {
    var session: AgentSession
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                        HStack(alignment: .top, spacing: ModestoSpacing.md) {
                            ProviderAvatar(provider: session.providerKind, size: 40)
                            summary
                        }
                        StatusDot(
                            token: session.status.colorToken,
                            label: session.status.label,
                            pulse: session.status == .running
                        )
                    }
                } else {
                    HStack(alignment: .top, spacing: ModestoSpacing.md) {
                        ProviderAvatar(provider: session.providerKind, size: 40)
                        summary
                        Spacer(minLength: ModestoSpacing.sm)
                        StatusDot(
                            token: session.status.colorToken,
                            label: session.status.label,
                            pulse: session.status == .running
                        )
                    }
                }

                metadata
            }
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(session.title)
                .font(ModestoFont.bodyMedium)
                .foregroundStyle(ModestoColor.textPrimary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
            if let step = session.progress?.currentStep {
                Text(step)
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 2)
            } else if let preview = session.lastMessagePreview {
                Text(preview)
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var metadata: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                providerLabel
                branchLabel
                progressMetadata
            }
        } else {
            HStack(spacing: ModestoSpacing.md) {
                providerLabel
                branchLabel
                progressMetadata
            }
            .labelStyle(.titleAndIcon)
        }
    }

    private var providerLabel: some View {
        Text(session.providerKind.displayName)
            .font(ModestoFont.caption)
            .foregroundStyle(session.providerKind.brandColor)
    }

    @ViewBuilder
    private var branchLabel: some View {
        if let branch = session.branch {
            if dynamicTypeSize.isAccessibilitySize {
                HStack(alignment: .top, spacing: ModestoSpacing.sm) {
                    Image(systemName: "arrow.triangle.branch")
                    Text(branch)
                        .lineLimit(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.textTertiary)
            } else {
                Label(branch, systemImage: "arrow.triangle.branch")
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textTertiary)
            }
        }
    }

    @ViewBuilder
    private var progressMetadata: some View {
        if let progress = session.progress {
            if progress.changedFileCount > 0 {
                Label("\(progress.changedFileCount)", systemImage: "doc.text")
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textTertiary)
            }
            if progress.testStatus != .none {
                Label("Tests", systemImage: progress.testStatus.symbolName)
                    .font(ModestoFont.caption)
                    .foregroundStyle(progress.testStatus.colorToken.color)
            }
        }
    }
}

extension SessionTestStatus {
    var symbolName: String {
        switch self {
        case .none: "circle.dashed"
        case .running: "clock"
        case .passed: "checkmark.circle"
        case .failed: "xmark.circle"
        }
    }

    var colorToken: ModestoColorToken {
        switch self {
        case .none: .idle
        case .running: .warning
        case .passed: .success
        case .failed: .danger
        }
    }
}
