import SwiftUI

/// One connected machine and the agent providers running on it, grouped
/// into a single card instead of scattering each provider as its own
/// horizontal chip — a host is what you're actually connecting to; the
/// providers are what's running on it.
struct HostGroupCard: View {
    var host: RuntimeHost
    var connections: [RuntimeConnection]
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        GroupedCard {
            GroupedRow {
                HStack(spacing: ModestoSpacing.md) {
                    HostMark(host: host, size: ModestoIconSize.md)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(host.name)
                            .font(ModestoFont.bodyMedium)
                            .foregroundStyle(ModestoColor.textPrimary)
                        if let detail = host.detail {
                            Text(detail)
                                .font(ModestoFont.footnote)
                                .foregroundStyle(ModestoColor.textSecondary)
                                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
                        }
                    }
                    Spacer(minLength: ModestoSpacing.sm)
                    StatusDot(token: host.status.color, label: host.status.label, pulse: host.status == .connecting)
                }
            }

            if !connections.isEmpty {
                GroupedDivider()
                GroupedRow {
                    if dynamicTypeSize.isAccessibilitySize {
                        VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                            connectionBadges
                        }
                    } else {
                        HStack(spacing: ModestoSpacing.sm) {
                            connectionBadges
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var connectionBadges: some View {
        ForEach(connections) { connection in
            HStack(spacing: ModestoSpacing.xs) {
                RuntimeMark(connection: connection, size: ModestoIconSize.xs)
                Text(connection.name)
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textSecondary)
            }
            .padding(.horizontal, ModestoSpacing.sm)
            .padding(.vertical, 4)
            .background(ModestoColor.surfaceRaised, in: Capsule())
        }
    }
}
