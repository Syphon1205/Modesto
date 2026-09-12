import SwiftUI

/// User-facing appearance preference, persisted via `@AppStorage` and
/// applied once at the app root. `system` tracks the device setting;
/// `dark`/`light` pin the app regardless of it.
enum AppearanceMode: String, CaseIterable, Identifiable {
    case system, dark, light

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: "System"
        case .dark: "Dark"
        case .light: "Light"
        }
    }

    /// `nil` tells SwiftUI to follow the system setting.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .dark: .dark
        case .light: .light
        }
    }
}
