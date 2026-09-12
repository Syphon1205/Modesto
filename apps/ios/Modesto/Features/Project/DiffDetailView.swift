import SwiftUI

struct DiffDetailView: View {
    var projectId: String
    var path: String
    var environment: AppEnvironment

    @State private var diff: FileDiff?

    var body: some View {
        ScrollView {
            if let diff {
                DiffHunksView(hunks: diff.hunks)
                    .padding(ModestoSpacing.lg)
            } else {
                EmptyStateView(symbolName: "doc.text", title: "No diff available", subtitle: path)
            }
        }
        .background(ModestoColor.background.ignoresSafeArea())
        .navigationTitle((path as NSString).lastPathComponent)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            diff = try? await environment.git.diff(projectId: projectId, path: path)
        }
    }
}
