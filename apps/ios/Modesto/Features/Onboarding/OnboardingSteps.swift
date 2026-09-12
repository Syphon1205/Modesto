import SwiftUI

/// Shared heading block for every onboarding step — small uppercase eyebrow,
/// large title, muted subtitle. Matches the desktop onboarding's rhythm.
private struct StepHeading: View {
    var eyebrow: String
    var title: String
    var subtitle: String

    var body: some View {
        VStack(spacing: ModestoSpacing.sm) {
            Text(eyebrow.uppercased())
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.textTertiary)
                .kerning(1.2)
            Text(title)
                .font(ModestoFont.largeTitle)
                .foregroundStyle(ModestoColor.textPrimary)
                .multilineTextAlignment(.center)
            Text(subtitle)
                .font(ModestoFont.body)
                .foregroundStyle(ModestoColor.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, ModestoSpacing.md)
    }
}

struct WelcomeStep: View {
    var body: some View {
        VStack(spacing: ModestoSpacing.xl) {
            ZStack {
                RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                    .fill(ModestoColor.surfaceRaised)
                    .frame(width: 84, height: 84)
                    .overlay(
                        RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                            .strokeBorder(ModestoColor.border, lineWidth: 1)
                    )
                ModestoMark(size: ModestoIconSize.xl, color: ModestoColor.textPrimary)
            }

            StepHeading(
                eyebrow: "Your agents, in your pocket",
                title: "Welcome to Modesto",
                subtitle: "Check in on Codex, Claude, Cursor, and every other agent you run — from wherever you are."
            )
        }
    }
}

struct ProvidersStep: View {
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: ModestoSpacing.xl) {
            StepHeading(
                eyebrow: "Every agent, one inbox",
                title: "Bring your own providers",
                subtitle: "Modesto Desktop already knows which agents you use. This app just follows along."
            )

            LazyVGrid(columns: columns, spacing: ModestoSpacing.md) {
                ForEach(ProviderKind.allCases) { provider in
                    VStack(spacing: ModestoSpacing.sm) {
                        ZStack {
                            Circle()
                                .fill(ModestoColor.surface)
                                .frame(width: 52, height: 52)
                                .overlay(Circle().strokeBorder(ModestoColor.border, lineWidth: 1))
                            ProviderMark(provider: provider, size: ModestoIconSize.md)
                        }
                        Text(provider.displayName)
                            .font(ModestoFont.caption)
                            .foregroundStyle(ModestoColor.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
            }
        }
    }
}

struct ApprovalsPreviewStep: View {
    private let sampleApproval = Approval(
        id: "preview",
        sessionId: "preview",
        projectId: "preview",
        kind: .command,
        title: "Run database migration",
        detail: "bun run migrate",
        requestedAt: Date(),
        decision: nil
    )

    var body: some View {
        VStack(spacing: ModestoSpacing.xl) {
            StepHeading(
                eyebrow: "Stay in the loop",
                title: "Approve from your pocket",
                subtitle: "The moment an agent needs a decision, it's waiting in your Inbox — accept, decline, or check in on the session."
            )

            VStack(spacing: ModestoSpacing.sm) {
                ApprovalRow(approval: sampleApproval)
                HStack(spacing: ModestoSpacing.sm) {
                    Text("Decline")
                        .font(ModestoFont.bodyMedium)
                        .foregroundStyle(ModestoColor.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ModestoSpacing.sm + 2)
                        .background(ModestoColor.surfaceRaised, in: Capsule())
                        .overlay(Capsule().strokeBorder(ModestoColor.border, lineWidth: 1))
                    Text("Accept")
                        .font(ModestoFont.bodyMedium)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ModestoSpacing.sm + 2)
                        .background(ModestoColor.accent, in: Capsule())
                }
            }
        }
    }
}

struct ReadyStep: View {
    var body: some View {
        VStack(spacing: ModestoSpacing.xl) {
            StepHeading(
                eyebrow: "You're set",
                title: "Ready when you are",
                subtitle: "This preview runs on sample data. Connect Modesto Desktop from Settings as soon as it's available."
            )

            VStack(spacing: ModestoSpacing.sm) {
                ForEach(MockData.runtimeHosts) { host in
                    HostGroupCard(
                        host: host,
                        connections: MockData.runtimeConnections.filter { $0.hostId == host.id }
                    )
                }
            }
        }
    }
}

#Preview("Providers") {
    ZStack {
        ModestoColor.background.ignoresSafeArea()
        ProvidersStep().padding()
    }
    .preferredColorScheme(.dark)
}
