import SwiftUI

enum OnboardingStep: Int, CaseIterable {
    case welcome, providers, approvals, ready
}

/// First-run welcome flow, shown once before `RootTabView`. Mirrors the
/// tone and step shape of the desktop web app's `FirstRunOnboarding`
/// (welcome → providers → what-to-expect → get started), adapted for a
/// single-screen mobile flow with no setup steps that need a live backend.
struct OnboardingView: View {
    var onFinish: () -> Void

    @State private var step: OnboardingStep = .welcome

    private var stepIndex: Int { step.rawValue }
    private var isLastStep: Bool { step == OnboardingStep.allCases.last }

    var body: some View {
        VStack(spacing: 0) {
            header

            Spacer(minLength: ModestoSpacing.lg)

            Group {
                switch step {
                case .welcome: WelcomeStep()
                case .providers: ProvidersStep()
                case .approvals: ApprovalsPreviewStep()
                case .ready: ReadyStep()
                }
            }
            .id(step)
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .move(edge: .trailing)),
                removal: .opacity.combined(with: .move(edge: .leading))
            ))

            Spacer(minLength: ModestoSpacing.lg)

            footer
        }
        .padding(.horizontal, ModestoSpacing.xl)
        .padding(.bottom, ModestoSpacing.xl)
        .background(ModestoColor.background.ignoresSafeArea())
        .animation(.easeOut(duration: 0.22), value: step)
    }

    private var header: some View {
        HStack(spacing: ModestoSpacing.sm) {
            ModestoMark(size: ModestoIconSize.sm, color: ModestoColor.textPrimary)
            Text("Modesto")
                .font(ModestoFont.subheadline)
                .foregroundStyle(ModestoColor.textPrimary)
        }
        .padding(.top, ModestoSpacing.lg)
    }

    private var footer: some View {
        VStack(spacing: ModestoSpacing.lg) {
            HStack(spacing: ModestoSpacing.xs) {
                ForEach(OnboardingStep.allCases, id: \.rawValue) { candidate in
                    Capsule()
                        .fill(candidate == step ? ModestoColor.accent : ModestoColor.border)
                        .frame(width: candidate == step ? 20 : 6, height: 6)
                        .animation(.easeOut(duration: 0.2), value: step)
                }
            }

            HStack(spacing: ModestoSpacing.md) {
                Button(stepIndex > 0 ? "Back" : "Skip") {
                    if stepIndex > 0 {
                        step = OnboardingStep(rawValue: stepIndex - 1) ?? .welcome
                    } else {
                        onFinish()
                    }
                }
                .buttonStyle(.modestoSecondary)

                Button(isLastStep ? "Get Started" : "Continue") {
                    if isLastStep {
                        onFinish()
                    } else {
                        step = OnboardingStep(rawValue: stepIndex + 1) ?? step
                    }
                }
                .buttonStyle(.modestoPrimary)
                .frame(maxWidth: .infinity)
            }
        }
    }
}

#Preview {
    OnboardingView(onFinish: {})
        .preferredColorScheme(.dark)
}
