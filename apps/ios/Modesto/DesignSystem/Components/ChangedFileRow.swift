import SwiftUI

/// One changed file: kind icon, path, and +/- counts. Used by Project
/// detail's Changes tab wherever a working-tree diff needs a row.
struct ChangedFileRow: View {
    var file: ChangedFile
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SurfaceCard {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                    identity
                    changeCounts
                }
            } else {
                HStack(spacing: ModestoSpacing.md) {
                    identity
                    Spacer(minLength: ModestoSpacing.sm)
                    changeCounts
                }
            }
        }
    }

    private var identity: some View {
        HStack(alignment: .top, spacing: ModestoSpacing.md) {
            Image(systemName: file.kind.symbolName)
                .foregroundStyle(file.kind.colorToken.color)
                .frame(width: 20)

            Text(file.path)
                .font(ModestoFont.mono)
                .foregroundStyle(ModestoColor.textPrimary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
                .truncationMode(.head)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var changeCounts: some View {
        HStack(spacing: ModestoSpacing.xs) {
            Text("+\(file.additions)")
                .foregroundStyle(ModestoColor.success)
            Text("-\(file.deletions)")
                .foregroundStyle(ModestoColor.danger)
        }
        .font(ModestoFont.caption)
    }
}
