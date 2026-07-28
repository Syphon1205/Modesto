import Foundation

/// Type-safe push destinations, shared by every tab's `NavigationStack` so
/// deep links and cross-tab navigation resolve the same way everywhere.
enum AppRoute: Hashable {
    case project(id: String)
    case session(id: String)
}
