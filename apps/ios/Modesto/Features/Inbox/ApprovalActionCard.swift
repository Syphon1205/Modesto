import SwiftUI

/// A native action card for one pending approval: what's being asked,
/// an inline expandable diff for file changes (so you can review without
/// opening a terminal), and full-width Approve/Decline buttons right on
/// the card. Reused by Inbox and Session detail so the same request looks
/// identical wherever it surfaces.
struct ApprovalActionCard: View {
    var approval: Approval
    var environment: AppEnvironment
    var isResolving: Bool
    var session: AgentSession? = nil
    var onDecision: (ApprovalDecision) -> Void
    var onOpenSession: (() -> Void)? = nil

    @State private var isShowingDiff = false
    @State private var diff: FileDiff?
    @State private var isLoadingDiff = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                        HStack(alignment: .top) {
                            identityMark
                            Spacer(minLength: 0)
                            openSessionButton
                        }
                        approvalCopy
                    }
                } else {
                    HStack(alignment: .top, spacing: ModestoSpacing.md) {
                        identityMark
                        approvalCopy
                        Spacer(minLength: 0)
                        openSessionButton
                    }
                }

                if approval.kind == .fileChange {
                    diffDisclosure
                }

                if dynamicTypeSize.isAccessibilitySize {
                    VStack(spacing: ModestoSpacing.sm) { decisionButtons }
                } else {
                    HStack(spacing: ModestoSpacing.sm) { decisionButtons }
                }
            }
        }
    }

    @ViewBuilder
    private var identityMark: some View {
        if let session {
            ProviderAvatar(provider: session.providerKind, size: 42)
        } else {
            RowIconBadge(systemImage: approval.kind.symbolName, tint: ModestoColor.warning)
        }
    }

    private var approvalCopy: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
            HStack(spacing: ModestoSpacing.xs) {
                Image(systemName: approval.kind.symbolName)
                Text(approval.kind.label.uppercased())
                    .kerning(0.6)
                Text("·")
                CompactRelativeTime(date: approval.requestedAt)
            }
            .font(ModestoFont.caption)
            .foregroundStyle(ModestoColor.warning)

            Text(approval.title)
                .font(ModestoFont.bodyMedium)
                .foregroundStyle(ModestoColor.textPrimary)
            Text(approval.detail)
                .font(ModestoFont.mono)
                .foregroundStyle(ModestoColor.textSecondary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var openSessionButton: some View {
        if let onOpenSession {
            Button(action: onOpenSession) {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(ModestoColor.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(ModestoColor.surfaceRaised, in: Circle())
            }
            .accessibilityLabel("Open session")
        }
    }

    @ViewBuilder
    private var decisionButtons: some View {
        Button { onDecision(.decline) } label: {
            Label("Decline", systemImage: "xmark")
        }
        .buttonStyle(.modestoSecondary)
        .frame(maxWidth: .infinity)
        .disabled(isResolving)
        .opacity(isResolving ? 0.5 : 1)

        Button { onDecision(.accept) } label: {
            Label("Approve", systemImage: "checkmark")
        }
        .buttonStyle(.modestoPrimary)
        .frame(maxWidth: .infinity)
        .disabled(isResolving)
        .opacity(isResolving ? 0.5 : 1)
    }

    private var diffDisclosure: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { isShowingDiff.toggle() }
                if isShowingDiff && diff == nil { Task { await loadDiff() } }
            } label: {
                HStack(spacing: ModestoSpacing.xs) {
                    Text(isShowingDiff ? "Hide changes" : "Review changes")
                    Image(systemName: "chevron.right")
                        .rotationEffect(.degrees(isShowingDiff ? 90 : 0))
                }
                .font(ModestoFont.subheadline)
                .foregroundStyle(ModestoColor.accent)
            }

            if isShowingDiff {
                if let diff {
                    DiffHunksView(hunks: diff.hunks)
                } else if isLoadingDiff {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ModestoSpacing.md)
                } else {
                    Text("No diff available for this file yet.")
                        .font(ModestoFont.footnote)
                        .foregroundStyle(ModestoColor.textTertiary)
                }
            }
        }
    }

    private func loadDiff() async {
        isLoadingDiff = true
        defer { isLoadingDiff = false }
        diff = try? await environment.git.diff(projectId: approval.projectId, path: approval.detail)
    }
}
