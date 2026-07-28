import SwiftUI

/// Every agent session, across every project, as a chat thread — the
/// center tab, the ChatGPT-style "see your chats, start a new one" home
/// for conversational work. `NewChatView` (its trailing toolbar action) is
/// the real chat interface for kicking off a task, replacing the old
/// picker-and-a-textfield form.
struct ChatsView: View {
    @StateObject private var viewModel: ChatsViewModel
    @Binding private var path: NavigationPath
    private let environment: AppEnvironment
    @State private var isPresentingNewChat = false
    @State private var query = ""
    @State private var selectedProvider: ProviderKind?

    init(environment: AppEnvironment, path: Binding<NavigationPath>) {
        self.environment = environment
        _viewModel = StateObject(wrappedValue: ChatsViewModel(environment: environment))
        _path = path
    }

    var body: some View {
        ZStack {
            AppBackdrop(accent: selectedProvider?.brandColor ?? ModestoColor.accent)

            if filteredSessions.isEmpty && !viewModel.isLoading {
                ScrollView {
                    EmptyStateView(
                        symbolName: query.isEmpty ? "bubble.left.and.bubble.right" : "magnifyingglass",
                        title: query.isEmpty ? "No conversations yet" : "No matching conversations",
                        subtitle: query.isEmpty
                            ? "Start a chat with any agent on a connected host."
                            : "Try another title, branch, or provider."
                    )
                    .padding(.top, ModestoSpacing.xxl)
                }
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                        Section {
                            providerFilter
                                .padding(.bottom, ModestoSpacing.sm)
                        }

                        ForEach(chatGroups) { group in
                            Section {
                                GlassSurface(padding: 0) {
                                    VStack(spacing: 0) {
                                        ForEach(Array(group.sessions.enumerated()), id: \.element.id) { index, session in
                                            Button {
                                                path.append(AppRoute.session(id: session.id))
                                            } label: {
                                                ChatThreadRow(session: session)
                                                    .padding(.horizontal, ModestoSpacing.md)
                                            }
                                            .buttonStyle(.plain)

                                            if index < group.sessions.count - 1 {
                                                Divider()
                                                    .overlay(ModestoColor.borderSubtle)
                                                    .padding(.leading, 66)
                                            }
                                        }
                                    }
                                }
                            } header: {
                                Text(group.title)
                                    .font(ModestoFont.caption)
                                    .foregroundStyle(ModestoColor.textSecondary)
                                    .textCase(.uppercase)
                                    .tracking(0.8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, ModestoSpacing.sm)
                            }
                            .padding(.bottom, ModestoSpacing.md)
                        }
                    }
                    .padding(ModestoSpacing.lg)
                }
                .refreshable { await viewModel.load() }
            }
        }
        .navigationTitle("Chats")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Search conversations")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isPresentingNewChat = true
                } label: {
                    Label("New Chat", systemImage: "square.and.pencil")
                }
            }
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $isPresentingNewChat) {
            NewChatView(environment: environment) { session in
                isPresentingNewChat = false
                path.append(AppRoute.session(id: session.id))
            }
        }
    }

    private var filteredSessions: [AgentSession] {
        viewModel.sessions.filter { session in
            let matchesProvider = selectedProvider == nil || session.providerKind == selectedProvider
            let matchesQuery = query.isEmpty
                || session.title.localizedCaseInsensitiveContains(query)
                || (session.branch?.localizedCaseInsensitiveContains(query) ?? false)
                || session.providerKind.displayName.localizedCaseInsensitiveContains(query)
            return matchesProvider && matchesQuery
        }
    }

    private var providerFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ModestoSpacing.sm) {
                FilterChip(title: "All", systemImage: "bubble.left.and.bubble.right", isSelected: selectedProvider == nil) {
                    selectedProvider = nil
                }
                ForEach(ProviderKind.allCases.filter { provider in
                    viewModel.sessions.contains { $0.providerKind == provider }
                }) { provider in
                    Button {
                        selectedProvider = selectedProvider == provider ? nil : provider
                    } label: {
                        HStack(spacing: 6) {
                            ProviderMark(provider: provider, size: 13, tint: selectedProvider == provider ? .white : provider.brandColor)
                            Text(provider.displayName)
                        }
                        .font(ModestoFont.caption)
                        .foregroundStyle(selectedProvider == provider ? Color.white : ModestoColor.textSecondary)
                        .padding(.horizontal, ModestoSpacing.md)
                        .padding(.vertical, 8)
                        .background(selectedProvider == provider ? provider.brandColor : ModestoColor.surfaceRaised.opacity(0.8), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var chatGroups: [ChatGroup] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: filteredSessions) { session -> String in
            if calendar.isDateInToday(session.updatedAt) { return "Today" }
            if calendar.isDateInYesterday(session.updatedAt) { return "Yesterday" }
            if session.updatedAt > calendar.date(byAdding: .day, value: -7, to: Date())! { return "This week" }
            return "Earlier"
        }
        let order = ["Today", "Yesterday", "This week", "Earlier"]
        return order.compactMap { title in
            guard let sessions = grouped[title], !sessions.isEmpty else { return nil }
            return ChatGroup(title: title, sessions: sessions)
        }
    }
}

private struct ChatGroup: Identifiable {
    let title: String
    let sessions: [AgentSession]
    var id: String { title }
}

#Preview {
    NavigationStack {
        ChatsView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
