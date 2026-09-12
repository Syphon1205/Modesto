import SwiftUI

/// A focused decision center: approvals and agent questions are grouped by
/// the kind of response they need, with every action available in place.
struct InboxView: View {
    @StateObject private var viewModel: InboxViewModel
    @Binding private var path: NavigationPath
    private let environment: AppEnvironment

    init(environment: AppEnvironment, path: Binding<NavigationPath>) {
        self.environment = environment
        _viewModel = StateObject(wrappedValue: InboxViewModel(environment: environment))
        _path = path
    }

    var body: some View {
        ZStack {
            AppBackdrop(accent: ModestoColor.warning)

            ScrollView {
                if viewModel.items.isEmpty && !viewModel.isLoading {
                    VStack(spacing: ModestoSpacing.xl) {
                        celebrationMark
                        EmptyStateView(
                            symbolName: "checkmark.seal.fill",
                            title: "You're all caught up",
                            subtitle: "Approvals and questions from your agents will appear here."
                        )
                    }
                    .padding(.top, ModestoSpacing.xxl)
                } else {
                    LazyVStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                        inboxSummary

                    if !approvals.isEmpty {
                        inboxSectionHeader(
                            title: "Decisions",
                            count: approvals.count,
                            symbol: "hand.raised.fill",
                            tint: ModestoColor.warning
                        )

                        ForEach(approvals) { approval in
                            ApprovalActionCard(
                                approval: approval,
                                environment: environment,
                                isResolving: viewModel.resolvingItemId == InboxItem.approval(approval).id,
                                session: viewModel.session(id: approval.sessionId)
                            ) { decision in
                                Task { await viewModel.resolve(approval, decision: decision) }
                            } onOpenSession: {
                                path.append(AppRoute.session(id: approval.sessionId))
                            }
                            .opacity(viewModel.resolvingItemId == InboxItem.approval(approval).id ? 0.5 : 1)
                        }
                    }

                    if !questions.isEmpty {
                        inboxSectionHeader(
                            title: "Questions",
                            count: questions.count,
                            symbol: "questionmark.bubble.fill",
                            tint: ModestoColor.accent
                        )

                        ForEach(questions) { session in
                            QuestionActionCard(
                                session: session,
                                isResolving: viewModel.resolvingItemId == InboxItem.question(session).id
                            ) { answer in
                                Task { await viewModel.answer(session, text: answer) }
                            } onOpenSession: {
                                path.append(AppRoute.session(id: session.id))
                            }
                            .opacity(viewModel.resolvingItemId == InboxItem.question(session).id ? 0.5 : 1)
                        }
                    }
                    }
                    .padding(.horizontal, ModestoSpacing.lg)
                    .padding(.top, ModestoSpacing.sm)
                    .padding(.bottom, ModestoSpacing.xxl)
                }
            }
        }
        .refreshable { await viewModel.load() }
        .navigationTitle("Inbox")
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.load() }
    }

    private var approvals: [Approval] {
        viewModel.items.compactMap {
            if case .approval(let approval) = $0 { return approval }
            return nil
        }
    }

    private var questions: [AgentSession] {
        viewModel.items.compactMap {
            if case .question(let session) = $0 { return session }
            return nil
        }
    }

    private var inboxSummary: some View {
        GlassSurface(cornerRadius: ModestoRadius.lg, padding: ModestoSpacing.lg) {
            VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
                HStack(spacing: ModestoSpacing.md) {
                    RowIconBadge(systemImage: "hand.raised.fill", tint: ModestoColor.warning)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(viewModel.items.count) waiting on you")
                            .font(ModestoFont.title)
                            .foregroundStyle(ModestoColor.textPrimary)
                        HStack(spacing: ModestoSpacing.xs) {
                            Text("Oldest request")
                            if let oldest = viewModel.items.first?.requestedAt {
                                Text("·")
                                CompactRelativeTime(date: oldest)
                            }
                        }
                        .font(ModestoFont.caption)
                        .foregroundStyle(ModestoColor.textSecondary)
                    }
                    Spacer(minLength: 0)
                }

                Text("Review the context, then approve or answer without leaving the queue.")
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
            }
        }
    }

    private var celebrationMark: some View {
        ZStack {
            Circle()
                .fill(ModestoColor.success.opacity(0.12))
                .frame(width: 96, height: 96)
            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(ModestoColor.success)
        }
        .accessibilityHidden(true)
    }

    private func inboxSectionHeader(title: String, count: Int, symbol: String, tint: Color) -> some View {
        HStack(spacing: ModestoSpacing.sm) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
            Text(title)
                .font(ModestoFont.headline)
                .foregroundStyle(ModestoColor.textPrimary)
            Text("\(count)")
                .font(ModestoFont.caption)
                .foregroundStyle(tint)
                .padding(.horizontal, ModestoSpacing.sm)
                .padding(.vertical, 3)
                .background(tint.opacity(0.12), in: Capsule())
            Spacer()
        }
    }
}

#Preview {
    NavigationStack {
        InboxView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
