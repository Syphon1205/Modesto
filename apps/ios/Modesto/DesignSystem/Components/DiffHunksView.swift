import SwiftUI

/// Renders a file's diff hunks — shared by the full-screen `DiffDetailView`
/// and the inline "Review changes" preview on an approval card, so a diff
/// looks identical whether you're reviewing it from Files or from Inbox.
struct DiffHunksView: View {
    var hunks: [DiffHunk]

    var body: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            ForEach(hunks) { hunk in
                VStack(alignment: .leading, spacing: 2) {
                    Text(hunk.header)
                        .font(ModestoFont.monoSmall)
                        .foregroundStyle(ModestoColor.textTertiary)
                        .padding(.bottom, ModestoSpacing.xs)
                    ForEach(hunk.lines) { line in
                        HStack(spacing: ModestoSpacing.sm) {
                            Text(prefix(for: line.kind))
                                .foregroundStyle(color(for: line.kind).opacity(0.7))
                            Text(line.text)
                                .foregroundStyle(color(for: line.kind))
                        }
                        .font(ModestoFont.mono)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(ModestoSpacing.md)
                .background(ModestoColor.surfaceRaised, in: RoundedRectangle(cornerRadius: ModestoRadius.md, style: .continuous))
            }
        }
    }

    private func prefix(for kind: DiffLine.Kind) -> String {
        switch kind {
        case .context: " "
        case .addition: "+"
        case .deletion: "-"
        }
    }

    private func color(for kind: DiffLine.Kind) -> Color {
        switch kind {
        case .context: ModestoColor.textSecondary
        case .addition: ModestoColor.success
        case .deletion: ModestoColor.danger
        }
    }
}
