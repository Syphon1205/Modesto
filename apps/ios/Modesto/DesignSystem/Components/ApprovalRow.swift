import SwiftUI

/// Reused on Home ("Waiting for you") and Inbox. Tapping surfaces the full
/// approval action sheet; this row is presentation-only.
struct ApprovalRow: View {
    var approval: Approval

    var body: some View {
        SurfaceCard {
            HStack(spacing: ModestoSpacing.md) {
                RowIconBadge(systemImage: approval.kind.symbolName, tint: ModestoColor.warning)

                VStack(alignment: .leading, spacing: 3) {
                    Text(approval.title)
                        .font(ModestoFont.bodyMedium)
                        .foregroundStyle(ModestoColor.textPrimary)
                        .lineLimit(1)
                    Text(approval.detail)
                        .font(ModestoFont.mono)
                        .foregroundStyle(ModestoColor.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ModestoColor.textTertiary)
            }
        }
    }
}
