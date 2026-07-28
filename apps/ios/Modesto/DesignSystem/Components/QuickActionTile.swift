import SwiftUI

/// A compact icon-over-label action tile, used in Home's Quick Actions row.
/// Optionally carries a small numeric badge (e.g. pending Inbox items).
struct QuickActionTile: View {
    var symbolName: String
    var title: String
    var badge: Int = 0
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: ModestoSpacing.sm) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: symbolName)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(ModestoColor.textPrimary)
                        .frame(width: 48, height: 48)
                        .background(ModestoColor.surfaceRaised, in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))

                    if badge > 0 {
                        Text(badge > 9 ? "9+" : "\(badge)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(4)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(ModestoColor.danger, in: Circle())
                            .offset(x: 8, y: -8)
                    }
                }
                Text(title)
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textSecondary)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
