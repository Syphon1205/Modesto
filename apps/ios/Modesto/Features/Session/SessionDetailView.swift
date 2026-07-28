import SwiftUI

/// A conversation-first session screen. Agent messages are the primary
/// surface; progress, tool activity, and approvals stay visible without
/// making the thread feel like a terminal event log.
struct SessionDetailView: View {
    @StateObject private var viewModel: SessionDetailViewModel
    private let environment: AppEnvironment
    @State private var draft = ""
    @State private var isPresentingTerminal = false
    @FocusState private var composerFocused: Bool
    private let bottomAnchor = "session-bottom"

    init(sessionId: String, environment: AppEnvironment) {
        self.environment = environment
        _viewModel = StateObject(wrappedValue: SessionDetailViewModel(sessionId: sessionId, environment: environment))
    }

    var body: some View {
        ZStack {
            AppBackdrop(accent: viewModel.session?.providerKind.brandColor ?? ModestoColor.accent)

            ScrollViewReader { proxy in
                ScrollView {
                LazyVStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                    if let session = viewModel.session {
                        sessionHeader(session)

                        if let progress = session.progress {
                            progressSummary(session: session, progress: progress)
                        }

                        conversation(session: session)
                    } else if viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.top, ModestoSpacing.xxl)
                    }

                    if let approval = viewModel.pendingApproval {
                        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                            Label("Action required", systemImage: "hand.raised.fill")
                                .font(ModestoFont.headline)
                                .foregroundStyle(ModestoColor.warning)

                            ApprovalActionCard(
                                approval: approval,
                                environment: environment,
                                isResolving: viewModel.isResolvingApproval
                            ) { decision in
                                Task { await viewModel.resolve(decision) }
                            }
                        }
                    }

                    Color.clear
                        .frame(height: 1)
                        .id(bottomAnchor)
                }
                .padding(.horizontal, ModestoSpacing.lg)
                .padding(.top, ModestoSpacing.sm)
                .padding(.bottom, ModestoSpacing.xl)
            }
                .onChange(of: viewModel.events.last?.id) {
                guard let kind = viewModel.events.last?.kind,
                      kind == .userMessage || kind == .assistantMessage else { return }
                withAnimation(.easeOut(duration: 0.18)) {
                    proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            }
                .onChange(of: viewModel.pendingApproval?.id) {
                guard viewModel.pendingApproval != nil else { return }
                DispatchQueue.main.async {
                    proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            }
                .task {
                await viewModel.load()
                await Task.yield()
                proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .navigationTitle(viewModel.session?.title ?? "Chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isPresentingTerminal = true
                } label: {
                    Label("Terminal", systemImage: "terminal")
                }
            }
        }
        .sheet(isPresented: $isPresentingTerminal) {
            NavigationStack {
                if let session = viewModel.session {
                    ScrollView {
                        ProjectTerminalTab(
                            sessionId: session.id,
                            cwd: session.worktreePath ?? "~",
                            environment: environment
                        )
                        .padding(ModestoSpacing.lg)
                    }
                    .background(AppBackdrop(accent: ModestoColor.cyan))
                    .navigationTitle("Terminal")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { isPresentingTerminal = false }
                        }
                    }
                }
            }
            .presentationDetents([.large])
        }
    }

    private func sessionHeader(_ session: AgentSession) -> some View {
        HStack(spacing: ModestoSpacing.md) {
            ProviderAvatar(provider: session.providerKind, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(session.providerKind.displayName)
                    .font(ModestoFont.bodyMedium)
                    .foregroundStyle(ModestoColor.textPrimary)
                Text(session.progress?.currentStep ?? session.lastMessagePreview ?? "Ready")
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(2)
            }

            Spacer(minLength: ModestoSpacing.sm)

            StatusDot(
                token: session.status.colorToken,
                label: session.status.label,
                pulse: session.status == .running
            )
        }
        .padding(.vertical, ModestoSpacing.sm)
    }

    private func progressSummary(session: AgentSession, progress: SessionProgress) -> some View {
        let completed = progress.completedSteps.count
        let total = max(progress.totalStepCount, 1)

        return VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack(spacing: ModestoSpacing.sm) {
                Image(systemName: session.status == .running ? "sparkles" : "circle.dashed")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(session.providerKind.brandColor)

                Text(progress.currentStep ?? "Task progress")
                    .font(ModestoFont.bodyMedium)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .lineLimit(2)

                Spacer(minLength: ModestoSpacing.sm)

                Text("\(completed)/\(total)")
                    .font(ModestoFont.monoSmall)
                    .foregroundStyle(ModestoColor.textTertiary)
            }

            ProgressView(value: Double(completed), total: Double(total))
                .tint(session.providerKind.brandColor)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: ModestoSpacing.lg) { progressMetadata(session: session, progress: progress) }
                VStack(alignment: .leading, spacing: ModestoSpacing.sm) { progressMetadata(session: session, progress: progress) }
            }
            .font(ModestoFont.caption)
            .foregroundStyle(ModestoColor.textSecondary)
        }
        .padding(ModestoSpacing.lg)
        .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                .strokeBorder(session.providerKind.brandColor.opacity(0.18), lineWidth: 0.75)
        }
    }

    @ViewBuilder
    private func progressMetadata(session: AgentSession, progress: SessionProgress) -> some View {
        if let branch = session.branch {
            Label(branch, systemImage: "arrow.triangle.branch")
                .lineLimit(1)
        }
        if progress.changedFileCount > 0 {
            Label("\(progress.changedFileCount) file\(progress.changedFileCount == 1 ? "" : "s")", systemImage: "doc.text")
        }
        if progress.testStatus != .none {
            Label(progress.testSummary ?? progress.testStatus.rawValue.capitalized, systemImage: progress.testStatus.symbolName)
                .foregroundStyle(progress.testStatus.colorToken.color)
        }
    }

    private func conversation(session: AgentSession) -> some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
            HStack {
                Text("Conversation")
                    .font(ModestoFont.headline)
                    .foregroundStyle(ModestoColor.textPrimary)
                Spacer()
                Text("\(viewModel.events.count) update\(viewModel.events.count == 1 ? "" : "s")")
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textTertiary)
            }

            if viewModel.events.isEmpty {
                EmptyStateView(
                    symbolName: "message",
                    title: "Start the conversation",
                    subtitle: "Send a message below to give the agent its next task."
                )
            } else {
                LazyVStack(spacing: ModestoSpacing.lg) {
                    ForEach(viewModel.events) { event in
                        ChatEventRow(event: event, provider: session.providerKind)
                    }
                }
            }
        }
    }

    private var composer: some View {
        ChatComposer(
            placeholder: "Message the agent…",
            text: $draft,
            isSending: viewModel.isSendingMessage,
            focus: $composerFocused
        ) {
            let text = draft
            draft = ""
            composerFocused = false
            Task { await viewModel.sendMessage(text) }
        }
    }
}

private struct ChatEventRow: View {
    var event: SessionEvent
    var provider: ProviderKind

    var body: some View {
        switch event.kind {
        case .userMessage:
            userMessage
        case .assistantMessage:
            assistantMessage
        default:
            activityUpdate
        }
    }

    private var userMessage: some View {
        HStack(alignment: .bottom) {
            Spacer(minLength: 52)
            VStack(alignment: .trailing, spacing: ModestoSpacing.xs) {
                Text(event.summary)
                    .font(ModestoFont.body)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .padding(.horizontal, ModestoSpacing.md)
                    .padding(.vertical, ModestoSpacing.sm + 2)
                    .background(
                        LinearGradient(
                            colors: [ModestoColor.accent.opacity(0.2), ModestoColor.accent.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                            .strokeBorder(ModestoColor.accent.opacity(0.18), lineWidth: 0.75)
                    }
                timestamp
            }
        }
    }

    private var assistantMessage: some View {
        HStack(alignment: .top, spacing: ModestoSpacing.sm) {
            ProviderAvatar(provider: provider, size: 30)
            VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                HStack(spacing: ModestoSpacing.sm) {
                    Text(provider.displayName)
                        .font(ModestoFont.caption)
                        .foregroundStyle(provider.brandColor)
                    timestamp
                }
                Text(event.summary)
                    .font(ModestoFont.body)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .textSelection(.enabled)
                if let detail = event.detail {
                    Text(detail)
                        .font(ModestoFont.monoSmall)
                        .foregroundStyle(ModestoColor.textSecondary)
                        .textSelection(.enabled)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var activityUpdate: some View {
        HStack(alignment: .top, spacing: ModestoSpacing.sm) {
            EventKindIcon(kind: event.kind)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.summary)
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textPrimary)
                if let detail = event.detail {
                    Text(detail)
                        .font(ModestoFont.monoSmall)
                        .foregroundStyle(ModestoColor.textSecondary)
                }
                timestamp
            }
            Spacer(minLength: 0)
        }
        .padding(ModestoSpacing.sm + 2)
        .background(ModestoColor.surface.opacity(0.72), in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous)
                .strokeBorder(ModestoColor.borderSubtle, lineWidth: 0.75)
        }
    }

    private var timestamp: some View {
        CompactRelativeTime(date: event.createdAt)
            .font(ModestoFont.caption)
            .foregroundStyle(ModestoColor.textTertiary)
    }
}

#Preview {
    NavigationStack {
        SessionDetailView(sessionId: "sess-1", environment: .mock)
    }
    .preferredColorScheme(.dark)
}
