import SwiftUI

/// The real chat interface for starting a task — pick a project and a
/// provider, then just start typing, GPT-new-chat style. Replaces the old
/// form-y "pick project, pick provider, fill in a textbox, tap Start"
/// sheet: here the first message you send *is* what starts the session.
struct NewChatView: View {
    var environment: AppEnvironment
    var onCreated: (AgentSession) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var projects: [Project] = []
    @State private var hosts: [RuntimeHost] = []
    @State private var connections: [RuntimeConnection] = []
    @State private var selectedProjectId: String?
    @State private var selectedHostId: String?
    @State private var selectedProvider: ProviderKind = .claudeAgent
    @State private var draft = ""
    @State private var isSending = false
    @State private var hasLoaded = false
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackdrop(accent: selectedProvider.brandColor)

                if hasLoaded && projects.isEmpty {
                    EmptyStateView(
                        symbolName: "folder",
                        title: "No projects yet",
                        subtitle: "Add a project from Modesto Desktop before starting a chat."
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    VStack(spacing: 0) {
                        pickerRow
                        Spacer(minLength: 0)
                        emptyPrompt
                        Spacer(minLength: 0)
                        ChatComposer(
                            placeholder: "Describe the task…",
                            text: $draft,
                            isSending: isSending,
                            focus: $isFocused
                        ) {
                            send()
                        }
                    }
                }
            }
            .navigationTitle("New Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task {
            async let projectsTask = environment.projects.allProjects()
            async let hostsTask = environment.runtimeConnections.hosts()
            async let connectionsTask = environment.runtimeConnections.connections()
            projects = (try? await projectsTask) ?? []
            hosts = (try? await hostsTask) ?? []
            connections = (try? await connectionsTask) ?? []
            if selectedProjectId == nil {
                selectedProjectId = projects.first?.id
            }
            if selectedHostId == nil {
                selectedHostId = hosts.first(where: { $0.status == .connected })?.id
            }
            if !availableProviders.contains(selectedProvider), let first = availableProviders.first {
                selectedProvider = first
            }
            hasLoaded = true
        }
    }

    private var pickerRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ModestoSpacing.sm) {
            Menu {
                ForEach(hosts) { host in
                    Button {
                        selectedHostId = host.id
                        if !availableProviders.contains(selectedProvider), let first = availableProviders.first {
                            selectedProvider = first
                        }
                    } label: {
                        if host.id == selectedHostId {
                            Label(host.name, systemImage: "checkmark")
                        } else {
                            Text(host.name)
                        }
                    }
                }
            } label: {
                chip(systemImage: "laptopcomputer", label: selectedHostName, tint: ModestoColor.success)
            }

            Menu {
                ForEach(projects) { project in
                    Button {
                        selectedProjectId = project.id
                    } label: {
                        if project.id == selectedProjectId {
                            Label(project.name, systemImage: "checkmark")
                        } else {
                            Text(project.name)
                        }
                    }
                }
            } label: {
                chip(systemImage: "folder.fill", label: selectedProjectName, tint: ModestoColor.accent)
            }

            Menu {
                ForEach(availableProviders) { provider in
                    Button {
                        selectedProvider = provider
                    } label: {
                        if provider == selectedProvider {
                            Label(provider.displayName, systemImage: "checkmark")
                        } else {
                            Text(provider.displayName)
                        }
                    }
                }
            } label: {
                HStack(spacing: ModestoSpacing.xs) {
                    ProviderMark(provider: selectedProvider, size: ModestoIconSize.xs)
                    Text(selectedProvider.displayName)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                }
                .font(ModestoFont.subheadline)
                .foregroundStyle(ModestoColor.textPrimary)
                .padding(.horizontal, ModestoSpacing.md)
                .padding(.vertical, ModestoSpacing.sm)
                .background(selectedProvider.brandColor.opacity(0.13), in: Capsule())
                .overlay(Capsule().strokeBorder(selectedProvider.brandColor.opacity(0.24), lineWidth: 1))
            }

            }
            .padding(.horizontal, ModestoSpacing.lg)
            .padding(.vertical, ModestoSpacing.md)
        }
        .fadingHorizontalEdges()
    }

    private func chip(systemImage: String, label: String, tint: Color) -> some View {
        HStack(spacing: ModestoSpacing.xs) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(tint)
            Text(label)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
        }
        .font(ModestoFont.subheadline)
        .foregroundStyle(ModestoColor.textPrimary)
        .padding(.horizontal, ModestoSpacing.md)
        .padding(.vertical, ModestoSpacing.sm)
        .background(tint.opacity(0.1), in: Capsule())
        .overlay(Capsule().strokeBorder(tint.opacity(0.2), lineWidth: 1))
    }

    private var selectedProjectName: String {
        projects.first(where: { $0.id == selectedProjectId })?.name ?? "Choose project"
    }

    private var selectedHostName: String {
        hosts.first(where: { $0.id == selectedHostId })?.name ?? "Choose host"
    }

    private var availableProviders: [ProviderKind] {
        let providers = connections
            .filter { $0.hostId == selectedHostId && $0.status == .connected }
            .compactMap(\.providerKind)
        return providers.isEmpty ? ProviderKind.allCases : providers
    }

    private var emptyPrompt: some View {
        VStack(spacing: ModestoSpacing.lg) {
            ProviderAvatar(provider: selectedProvider, size: 68)

            VStack(spacing: ModestoSpacing.xs) {
                Text("What should \(selectedProvider.displayName) build?")
                    .font(ModestoFont.title)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text("\(selectedProjectName) · \(selectedHostName)")
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
            }

            GlassSurface(padding: ModestoSpacing.xs) {
                VStack(spacing: 0) {
                    suggestionButton("Fix a bug", symbol: "ant.fill")
                    Divider().overlay(ModestoColor.borderSubtle).padding(.leading, 40)
                    suggestionButton("Build a feature", symbol: "hammer.fill")
                    Divider().overlay(ModestoColor.borderSubtle).padding(.leading, 40)
                    suggestionButton("Review my changes", symbol: "checkmark.seal.fill")
                }
            }
            .frame(maxWidth: 330)
        }
        .padding(.horizontal, ModestoSpacing.xl)
        .opacity(draft.isEmpty ? 1 : 0)
        .animation(.easeOut(duration: 0.15), value: draft.isEmpty)
        .animation(.easeOut(duration: 0.15), value: selectedProvider)
    }

    private func suggestionButton(_ title: String, symbol: String) -> some View {
        Button {
            draft = title + ": "
            isFocused = true
        } label: {
            HStack(spacing: ModestoSpacing.sm) {
                Image(systemName: symbol)
                    .foregroundStyle(selectedProvider.brandColor)
                    .frame(width: 20)
                Text(title)
                    .font(ModestoFont.subheadline)
                    .foregroundStyle(ModestoColor.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.left")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ModestoColor.textTertiary)
            }
            .padding(.horizontal, ModestoSpacing.md)
            .padding(.vertical, ModestoSpacing.md)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Adds this starter to the message field")
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let projectId = selectedProjectId, !isSending else { return }
        isSending = true
        Task {
            if let session = try? await environment.agentSessions.startSession(
                projectId: projectId,
                providerKind: selectedProvider,
                hostId: selectedHostId,
                firstMessage: text
            ) {
                onCreated(session)
            }
            isSending = false
        }
    }
}

#Preview {
    NewChatView(environment: .mock) { _ in }
        .preferredColorScheme(.dark)
}
