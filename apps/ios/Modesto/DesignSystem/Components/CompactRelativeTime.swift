import SwiftUI

/// A calm, chat-style relative timestamp. SwiftUI's default relative Date
/// style includes seconds for recent events, which creates visual noise in
/// a live thread.
struct CompactRelativeTime: View {
    var date: Date

    var body: some View {
        Text(label)
            .accessibilityLabel(Text(date, style: .relative))
    }

    private var label: String {
        let interval = max(0, Date().timeIntervalSince(date))
        switch interval {
        case ..<60:
            return "now"
        case ..<3_600:
            return "\(Int(interval / 60))m"
        case ..<86_400:
            return "\(Int(interval / 3_600))h"
        case ..<604_800:
            return "\(Int(interval / 86_400))d"
        default:
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
    }
}
