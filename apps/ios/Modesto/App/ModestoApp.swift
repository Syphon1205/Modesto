import SwiftUI

@main
struct ModestoApp: App {
    @StateObject private var environment = AppEnvironment.mock
    @AppStorage("modesto.onboarding.completed") private var hasCompletedOnboarding = false
    @AppStorage("modesto.appearance") private var appearanceRawValue = AppearanceMode.system.rawValue

    private var appearance: AppearanceMode {
        AppearanceMode(rawValue: appearanceRawValue) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            AppRootView(hasCompletedOnboarding: $hasCompletedOnboarding)
                .environmentObject(environment)
                .preferredColorScheme(appearance.colorScheme)
                .tint(ModestoColor.accent)
        }
    }
}

/// Switches between first-run onboarding and the main tab shell. Kept
/// separate from `ModestoApp` so the transition animates as a normal
/// SwiftUI view change rather than a scene-level swap.
private struct AppRootView: View {
    @Binding var hasCompletedOnboarding: Bool

    var body: some View {
        Group {
            if hasCompletedOnboarding {
                RootTabView()
                    .transition(.opacity)
            } else {
                OnboardingView(onFinish: { hasCompletedOnboarding = true })
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.25), value: hasCompletedOnboarding)
    }
}
