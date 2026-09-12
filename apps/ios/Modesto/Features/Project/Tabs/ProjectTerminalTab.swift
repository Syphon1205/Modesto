import SwiftUI

struct ProjectTerminalTab: View {
    var sessionId: String?
    var cwd: String
    var environment: AppEnvironment

    @State private var terminal: TerminalStream?
    @State private var inputText = ""
    @State private var isBusy = false
    @State private var hasLoaded = false

    var body: some View {
        Group {
            if let sessionId {
                if let terminal {
                    connectedTerminal(sessionId: sessionId, terminal: terminal)
                } else if hasLoaded {
                    startTerminalPrompt(sessionId: sessionId)
                } else {
                    Color.clear.frame(height: 1)
                }
            } else {
                EmptyStateView(
                    symbolName: "bolt.slash",
                    title: "No sessions yet",
                    subtitle: "Start a task in this project to open a terminal."
                )
            }
        }
        .task(id: sessionId) {
            guard let sessionId else { return }
            terminal = try? await environment.terminals.terminal(sessionId: sessionId)
            hasLoaded = true
        }
    }

    private func startTerminalPrompt(sessionId: String) -> some View {
        VStack(spacing: ModestoSpacing.lg) {
            EmptyStateView(
                symbolName: "terminal",
                title: "No terminal running",
                subtitle: "Start one to run commands in this session's worktree."
            )
            Button {
                Task {
                    isBusy = true
                    terminal = try? await environment.terminals.startTerminal(sessionId: sessionId, cwd: cwd)
                    isBusy = false
                }
            } label: {
                Label("Start Terminal", systemImage: "play.fill")
            }
            .buttonStyle(.modestoPrimary)
            .disabled(isBusy)
        }
    }

    private func connectedTerminal(sessionId: String, terminal: TerminalStream) -> some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack {
                Label(terminal.cwd, systemImage: "terminal")
                    .font(ModestoFont.monoSmall)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(1)
                Spacer()
                StatusDot(token: terminal.status == .running ? .running : .idle, label: terminal.status.rawValue.capitalized)
            }

            ScrollViewReader { proxy in
                SurfaceCard {
                    VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                        if terminal.lines.isEmpty {
                            Text("No output yet — try a command below.")
                                .font(ModestoFont.mono)
                                .foregroundStyle(ModestoColor.textTertiary)
                        }
                        ForEach(terminal.lines) { line in
                            (Text(line.isCommand ? "$ " : "").foregroundStyle(ModestoColor.textTertiary)
                                + Text(line.text).foregroundStyle(line.isCommand ? ModestoColor.accent : ModestoColor.textSecondary))
                                .font(ModestoFont.mono)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                }
                .onChange(of: terminal.lines.count) {
                    guard let last = terminal.lines.last else { return }
                    withAnimation(.easeOut(duration: 0.15)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            HStack(spacing: ModestoSpacing.sm) {
                Text("$")
                    .font(ModestoFont.mono)
                    .foregroundStyle(ModestoColor.textTertiary)
                TextField("Run a command", text: $inputText)
                    .font(ModestoFont.mono)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.send)
                    .onSubmit { send(sessionId: sessionId) }
                    .disabled(isBusy)

                Button {
                    send(sessionId: sessionId)
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(
                            inputText.trimmingCharacters(in: .whitespaces).isEmpty
                                ? ModestoColor.textTertiary
                                : ModestoColor.accent
                        )
                }
                .disabled(isBusy || inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(ModestoSpacing.md)
            .background(ModestoColor.surfaceRaised, in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))
        }
    }

    private func send(sessionId: String) {
        let command = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty, !isBusy else { return }
        inputText = ""
        Task {
            isBusy = true
            try? await environment.terminals.write(sessionId: sessionId, input: command)
            terminal = try? await environment.terminals.terminal(sessionId: sessionId)
            isBusy = false
        }
    }
}
