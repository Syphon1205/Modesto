import SwiftUI

struct SettingsView: View {
    let environment: AppEnvironment
    @State private var hosts: [RuntimeHost] = []
    @State private var connections: [RuntimeConnection] = []
    @AppStorage("modesto.notifications.approvals") private var notifyOnApprovals = true
    @AppStorage("modesto.notifications.sessionComplete") private var notifyOnSessionComplete = true
    @AppStorage("modesto.onboarding.completed") private var hasCompletedOnboarding = true
    @AppStorage("modesto.appearance") private var appearanceRawValue = AppearanceMode.system.rawValue

    private var appearance: Binding<AppearanceMode> {
        Binding(
            get: { AppearanceMode(rawValue: appearanceRawValue) ?? .system },
            set: { appearanceRawValue = $0.rawValue }
        )
    }

    private var integrations: [RuntimeConnection] {
        connections.filter { $0.hostId == nil }
    }

    var body: some View {
        Form {
            Section("Machines") {
                ForEach(hosts) { host in
                    HStack {
                        HostMark(host: host, size: ModestoIconSize.sm)
                            .frame(width: 20)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(host.name)
                                .foregroundStyle(ModestoColor.textPrimary)
                            if let detail = host.detail {
                                Text(detail)
                                    .font(ModestoFont.footnote)
                                    .foregroundStyle(ModestoColor.textSecondary)
                            }
                        }
                        Spacer()
                        StatusDot(token: host.status.color, label: host.status.label)
                    }
                }
                Button {
                    // Placeholder — pairing flow not built yet.
                } label: {
                    Label("Add machine", systemImage: "plus.circle")
                }
            }

            if !integrations.isEmpty {
                Section("Integrations") {
                    ForEach(integrations) { connection in
                        HStack {
                            RuntimeMark(connection: connection, size: ModestoIconSize.sm)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(connection.name)
                                    .foregroundStyle(ModestoColor.textPrimary)
                                if let detail = connection.detail {
                                    Text(detail)
                                        .font(ModestoFont.footnote)
                                        .foregroundStyle(ModestoColor.textSecondary)
                                }
                            }
                            Spacer()
                            StatusDot(token: connection.status.color, label: connection.status.label)
                        }
                    }
                }
            }

            Section("Notifications") {
                Toggle("Approvals waiting", isOn: $notifyOnApprovals)
                Toggle("Session completed", isOn: $notifyOnSessionComplete)
            }

            Section("Appearance") {
                Picker("Theme", selection: appearance) {
                    ForEach(AppearanceMode.allCases) { mode in
                        Text(mode.label).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .padding(.vertical, ModestoSpacing.xs)
            }

            Section("About") {
                HStack(spacing: ModestoSpacing.md) {
                    ModestoMark(size: ModestoIconSize.lg, color: ModestoColor.textPrimary)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Modesto")
                            .foregroundStyle(ModestoColor.textPrimary)
                        Text("Version 0.1.0")
                            .font(ModestoFont.footnote)
                            .foregroundStyle(ModestoColor.textSecondary)
                    }
                }
                .padding(.vertical, ModestoSpacing.xs)

                Button("Replay onboarding") {
                    hasCompletedOnboarding = false
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(ModestoColor.background)
        .navigationTitle("Settings")
        .task {
            async let hostsTask = environment.runtimeConnections.hosts()
            async let connectionsTask = environment.runtimeConnections.connections()
            hosts = (try? await hostsTask) ?? []
            connections = (try? await connectionsTask) ?? []
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView(environment: .mock)
    }
    .preferredColorScheme(.dark)
}
