import SwiftUI

struct ProjectPreviewTab: View {
    var deployments: [Deployment]

    var body: some View {
        if deployments.isEmpty {
            EmptyStateView(
                symbolName: "safari",
                title: "No deployments",
                subtitle: "Preview and production deployments will show up here once this project is linked."
            )
        } else {
            VStack(spacing: ModestoSpacing.sm) {
                ForEach(deployments) { deployment in
                    DeploymentCard(deployment: deployment)
                }
            }
        }
    }
}

private struct DeploymentCard: View {
    var deployment: Deployment

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                HStack {
                    Label(deployment.environment, systemImage: "triangle")
                        .font(ModestoFont.subheadline)
                        .foregroundStyle(ModestoColor.textPrimary)
                    Spacer()
                    StatusDot(token: deployment.status.colorToken, label: deployment.status.label)
                }

                if let commitMessage = deployment.commitMessage {
                    Text(commitMessage)
                        .font(ModestoFont.footnote)
                        .foregroundStyle(ModestoColor.textSecondary)
                }

                if let urlString = deployment.url, let url = URL(string: urlString) {
                    Link(destination: url) {
                        Label("Open preview", systemImage: "arrow.up.right")
                            .font(ModestoFont.caption)
                    }
                }
            }
        }
    }
}
