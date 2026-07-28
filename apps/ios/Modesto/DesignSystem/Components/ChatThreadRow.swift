import SwiftUI

/// Conversation-oriented session row used by the Chats tab. It gives the
/// agent a recognizable avatar and prioritizes the last message over
/// implementation metadata.
struct ChatThreadRow: View {
    var session: AgentSession
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                accessibilityLayout
            } else {
                standardLayout
            }
        }
        .padding(.vertical, ModestoSpacing.sm + 2)
        .contentShape(Rectangle())
    }

    private var standardLayout: some View {
        HStack(alignment: .top, spacing: ModestoSpacing.md) {
            ProviderAvatar(provider: session.providerKind, size: 42)

            VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                HStack(alignment: .firstTextBaseline, spacing: ModestoSpacing.sm) {
                    title
                    Spacer(minLength: ModestoSpacing.md)
                    updatedTime
                }
                preview
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ModestoSpacing.md) {
                        statusAndProvider
                        branchLabel
                    }
                    VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                        statusAndProvider
                        branchLabel
                    }
                }
                .font(ModestoFont.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var accessibilityLayout: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack(spacing: ModestoSpacing.md) {
                ProviderAvatar(provider: session.providerKind, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(session.providerKind.displayName)
                        .font(ModestoFont.bodyMedium)
                        .foregroundStyle(session.providerKind.brandColor)
                    updatedTime
                }
                Spacer(minLength: 0)
            }

                    title
                    preview

            VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                statusLabel
                branchLabel
            }
            .font(ModestoFont.caption)
        }
    }

    private var title: some View {
        Text(session.title)
            .font(ModestoFont.bodyMedium)
            .foregroundStyle(ModestoColor.textPrimary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
            .truncationMode(.tail)
            .layoutPriority(1)
    }

    @ViewBuilder
    private var preview: some View {
        if let preview = session.lastMessagePreview ?? session.progress?.currentStep {
            Text(preview)
                .font(ModestoFont.footnote)
                .foregroundStyle(ModestoColor.textSecondary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)
        }
    }

    private var updatedTime: some View {
        CompactRelativeTime(date: session.updatedAt)
            .font(ModestoFont.caption)
            .foregroundStyle(ModestoColor.textTertiary)
            .fixedSize(horizontal: true, vertical: false)
    }

    private var statusAndProvider: some View {
        HStack(spacing: ModestoSpacing.xs) {
            statusLabel
            Text("·")
                .foregroundStyle(ModestoColor.textTertiary)
            Text(session.providerKind.displayName)
                .foregroundStyle(session.providerKind.brandColor)
        }
    }

    private var statusLabel: some View {
        HStack(spacing: ModestoSpacing.xs) {
            Circle()
                .fill(session.status.colorToken.color)
                .frame(width: 7, height: 7)
            Text(session.status.label)
                .foregroundStyle(session.status.colorToken.color)
        }
    }

    @ViewBuilder
    private var branchLabel: some View {
        if let branch = session.branch {
            Label(branch, systemImage: "arrow.triangle.branch")
                .foregroundStyle(ModestoColor.textTertiary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
        }
    }
}
