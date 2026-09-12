import SwiftUI

/// Consistent section title used across Home, Project, and Inbox lists, with
/// an optional trailing action like "See all".
struct SectionHeader: View {
    var title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(ModestoFont.headline)
                .foregroundStyle(ModestoColor.textPrimary)
            Spacer()
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(ModestoFont.subheadline)
                        .foregroundStyle(ModestoColor.accent)
                }
            }
        }
    }
}
