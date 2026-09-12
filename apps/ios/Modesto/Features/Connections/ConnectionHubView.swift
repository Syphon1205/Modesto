import SwiftUI

struct SavedHostEndpoint: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var address: String
    var lastConnectedAt: Date?
}

/// The honest connection model: the phone pairs with trusted Modesto hosts;
/// Codex, Claude Code, Cursor, and other provider runtimes execute there.
/// This avoids presenting consumer chat apps as if they offered app-to-app
/// control APIs while still making every supported provider visible.
struct ConnectionHubView: View {
    let environment: AppEnvironment

    @Environment(\.dismiss) private var dismiss
    @State private var hosts: [RuntimeHost] = []
    @State private var connections: [RuntimeConnection] = []
    @State private var savedEndpoints: [SavedHostEndpoint] = []
    @State private var isAddingHost = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackdrop(accent: ModestoColor.success)

                ScrollView {
                    VStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                        connectionHero
                        connectedHosts
                        providerGrid
                        securityNote
                    }
                    .padding(.horizontal, ModestoSpacing.lg)
                    .padding(.top, ModestoSpacing.sm)
                    .padding(.bottom, ModestoSpacing.xxl)
                }
            }
            .navigationTitle("Connections")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isAddingHost = true
                    } label: {
                        Label("Add Host", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $isAddingHost) {
                AddHostView { endpoint in
                    savedEndpoints.removeAll { $0.id == endpoint.id || $0.address == endpoint.address }
                    savedEndpoints.append(endpoint)
                    saveEndpoints()
                    isAddingHost = false
                }
            }
            .task { await load() }
        }
    }

    private var connectionHero: some View {
        GlassSurface(cornerRadius: ModestoRadius.lg, padding: ModestoSpacing.lg) {
            VStack(alignment: .leading, spacing: ModestoSpacing.lg) {
                HStack(alignment: .top) {
                    RowIconBadge(systemImage: "point.3.connected.trianglepath.dotted", tint: ModestoColor.success)
                    Spacer()
                    statusPill
                }

                VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
                    Text("Your agents, one place")
                        .font(ModestoFont.title)
                        .foregroundStyle(ModestoColor.textPrimary)
                    Text("Pair this phone with a Mac or devbox. Agent state, approvals, diffs, and terminal output stay live while the work runs there.")
                        .font(ModestoFont.footnote)
                        .foregroundStyle(ModestoColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var statusPill: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(hosts.contains(where: { $0.status == .connected }) ? ModestoColor.success : ModestoColor.warning)
                .frame(width: 7, height: 7)
            Text(hosts.contains(where: { $0.status == .connected }) ? "Online" : "Pair a host")
        }
        .font(ModestoFont.caption)
        .foregroundStyle(ModestoColor.textSecondary)
        .padding(.horizontal, ModestoSpacing.sm + 2)
        .padding(.vertical, 7)
        .background(ModestoColor.surfaceRaised.opacity(0.8), in: Capsule())
    }

    private var connectedHosts: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            SectionHeader(title: "Hosts", actionTitle: "Add") { isAddingHost = true }

            ForEach(hosts) { host in
                hostCard(host)
            }

            ForEach(savedEndpoints) { endpoint in
                GlassSurface(padding: ModestoSpacing.md) {
                    HStack(spacing: ModestoSpacing.md) {
                        RowIconBadge(systemImage: "network", tint: ModestoColor.cyan)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(endpoint.name)
                                .font(ModestoFont.bodyMedium)
                                .foregroundStyle(ModestoColor.textPrimary)
                            Text(endpoint.address)
                                .font(ModestoFont.monoSmall)
                                .foregroundStyle(ModestoColor.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(ModestoColor.success)
                    }
                }
            }
        }
    }

    private func hostCard(_ host: RuntimeHost) -> some View {
        GlassSurface(padding: ModestoSpacing.md) {
            VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                HStack(spacing: ModestoSpacing.md) {
                    RowIconBadge(systemImage: host.kind.symbolName, tint: host.status.color.color)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(host.name)
                            .font(ModestoFont.bodyMedium)
                            .foregroundStyle(ModestoColor.textPrimary)
                        Text(host.detail ?? (host.kind == .local ? "Modesto Desktop" : "Remote host"))
                            .font(ModestoFont.footnote)
                            .foregroundStyle(ModestoColor.textSecondary)
                    }
                    Spacer()
                    StatusDot(token: host.status.color, label: host.status.label)
                }

                let providers = connections.filter { $0.hostId == host.id }.compactMap(\.providerKind)
                if !providers.isEmpty {
                    HStack(spacing: -5) {
                        ForEach(providers) { provider in
                            ProviderAvatar(provider: provider, size: 30)
                                .overlay(Circle().stroke(ModestoColor.surface, lineWidth: 2))
                        }
                        Text("\(providers.count) runtime\(providers.count == 1 ? "" : "s")")
                            .font(ModestoFont.caption)
                            .foregroundStyle(ModestoColor.textTertiary)
                            .padding(.leading, ModestoSpacing.md)
                    }
                }
            }
        }
    }

    private var providerGrid: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Agent runtimes")
                    .font(ModestoFont.headline)
                    .foregroundStyle(ModestoColor.textPrimary)
                Text("These are discovered on your connected hosts—not linked to the consumer chat apps on this phone.")
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ModestoSpacing.sm) {
                ForEach(ProviderKind.allCases) { provider in
                    providerTile(provider)
                }
            }
        }
    }

    private func providerTile(_ provider: ProviderKind) -> some View {
        let isConnected = connections.contains { $0.providerKind == provider && $0.status == .connected }
        return HStack(spacing: ModestoSpacing.sm) {
            ProviderAvatar(provider: provider, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(provider.displayName)
                    .font(ModestoFont.subheadline)
                    .foregroundStyle(ModestoColor.textPrimary)
                    .lineLimit(1)
                Text(isConnected ? "Ready" : "Not detected")
                    .font(ModestoFont.caption)
                    .foregroundStyle(isConnected ? ModestoColor.success : ModestoColor.textTertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(ModestoSpacing.sm + 2)
        .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                .strokeBorder(isConnected ? provider.brandColor.opacity(0.25) : ModestoColor.borderSubtle, lineWidth: 0.75)
        }
    }

    private var securityNote: some View {
        Label {
            Text("Files, credentials, shells, and provider logins remain on the host. The phone receives only the synchronized task state and output.")
                .font(ModestoFont.footnote)
                .foregroundStyle(ModestoColor.textSecondary)
        } icon: {
            Image(systemName: "lock.shield.fill")
                .foregroundStyle(ModestoColor.success)
        }
        .padding(ModestoSpacing.md)
    }

    private func load() async {
        async let hostsTask = environment.runtimeConnections.hosts()
        async let connectionsTask = environment.runtimeConnections.connections()
        hosts = (try? await hostsTask) ?? []
        connections = (try? await connectionsTask) ?? []
        if let data = UserDefaults.standard.data(forKey: "modesto.savedHostEndpoints"),
           let decoded = try? JSONDecoder().decode([SavedHostEndpoint].self, from: data) {
            savedEndpoints = decoded
        }
    }

    private func saveEndpoints() {
        guard let data = try? JSONEncoder().encode(savedEndpoints) else { return }
        UserDefaults.standard.set(data, forKey: "modesto.savedHostEndpoints")
    }
}

private struct AddHostView: View {
    var onConnected: (SavedHostEndpoint) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = "My Mac"
    @State private var address = "http://"
    @State private var isChecking = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field { case name, address }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackdrop(accent: ModestoColor.success)
                ScrollView {
                    VStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                            Text("Pair a Modesto host")
                                .font(ModestoFont.largeTitle)
                                .foregroundStyle(ModestoColor.textPrimary)
                            Text("Enter the address shown by Modesto Desktop. The app verifies its health endpoint before saving it.")
                                .font(ModestoFont.body)
                                .foregroundStyle(ModestoColor.textSecondary)
                        }

                        GlassSurface {
                            VStack(spacing: ModestoSpacing.lg) {
                                field("Name", text: $name, prompt: "Studio Mac", field: .name)
                                field("Server address", text: $address, prompt: "http://192.168.1.20:51820", field: .address)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .keyboardType(.URL)
                            }
                        }

                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(ModestoFont.footnote)
                                .foregroundStyle(ModestoColor.warning)
                                .padding(.horizontal, ModestoSpacing.sm)
                        }

                        Button {
                            connect()
                        } label: {
                            HStack {
                                if isChecking { ProgressView().tint(.white) }
                                Text(isChecking ? "Checking host…" : "Connect securely")
                            }
                            .font(ModestoFont.bodyMedium)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ModestoSpacing.md)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isChecking || name.trimmingCharacters(in: .whitespaces).isEmpty || address == "http://")
                    }
                    .padding(ModestoSpacing.lg)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, prompt: String, field: Field) -> some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
            Text(label)
                .font(ModestoFont.caption)
                .foregroundStyle(ModestoColor.textSecondary)
            TextField(prompt, text: text)
                .font(field == .address ? ModestoFont.mono : ModestoFont.body)
                .foregroundStyle(ModestoColor.textPrimary)
                .focused($focusedField, equals: field)
                .padding(ModestoSpacing.md)
                .background(ModestoColor.surfaceRaised, in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))
        }
    }

    private func connect() {
        errorMessage = nil
        isChecking = true
        Task {
            do {
                let normalized = try await HostHealthProbe.verify(address)
                onConnected(SavedHostEndpoint(
                    id: UUID().uuidString,
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    address: normalized,
                    lastConnectedAt: Date()
                ))
            } catch {
                errorMessage = error.localizedDescription
            }
            isChecking = false
        }
    }
}

private enum HostHealthProbe {
    static func verify(_ rawAddress: String) async throws -> String {
        let value = rawAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(string: value),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil else {
            throw ConnectionProbeError.invalidAddress
        }

        components.path = "/health"
        guard let healthURL = components.url else { throw ConnectionProbeError.invalidAddress }
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 8
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ConnectionProbeError.unhealthyHost
        }

        components.path = ""
        components.query = nil
        components.fragment = nil
        guard let baseURL = components.url else { throw ConnectionProbeError.invalidAddress }
        return baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

private enum ConnectionProbeError: LocalizedError {
    case invalidAddress
    case unhealthyHost

    var errorDescription: String? {
        switch self {
        case .invalidAddress: "Enter a full http:// or https:// server address."
        case .unhealthyHost: "That server did not report a healthy Modesto instance."
        }
    }
}

#Preview {
    ConnectionHubView(environment: .mock)
        .preferredColorScheme(.dark)
}
