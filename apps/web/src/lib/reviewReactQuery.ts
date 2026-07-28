import type {
  ReviewFindingId,
  ReviewConfiguration,
  ReviewListResult,
  ReviewProvider,
  ReviewRunId,
  ReviewRuntime,
  ReviewStreamEvent,
  ReviewTarget,
  ThreadId,
} from "@modesto/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ensureNativeApi } from "../nativeApi";

export const reviewProvidersQueryKey = ["review", "providers"] as const;
export const reviewQueryKey = (threadId: ThreadId, provider: ReviewProvider) =>
  ["review", threadId, provider] as const;

export const reviewProvidersQueryOptions = () =>
  queryOptions({
    queryKey: reviewProvidersQueryKey,
    queryFn: () => ensureNativeApi().review.providers(),
    staleTime: 5_000,
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.providers.some((provider) => provider.installation === "not-found")
        ? 3_000
        : false,
  });

export const reviewListQueryOptions = (
  threadId: ThreadId,
  provider: ReviewProvider,
  enabled = true,
  runtime?: ReviewRuntime,
) =>
  queryOptions({
    queryKey: reviewQueryKey(threadId, provider),
    queryFn: () => ensureNativeApi().review.list({ threadId, provider }),
    enabled,
    refetchInterval: (query) => {
      if (
        query.state.data?.runs.some((run) => run.status === "queued" || run.status === "running")
      ) {
        return 2_000;
      }
      if (runtime && !query.state.data?.availability.supportedRuntimes.includes(runtime)) {
        return 3_000;
      }
      return false;
    },
  });

export function useStartReview(threadId: ThreadId, provider: ReviewProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { target: ReviewTarget; configuration: ReviewConfiguration }) =>
      ensureNativeApi().review.start({ threadId, provider, ...input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reviewQueryKey(threadId, provider) }),
  });
}

export function useCancelReview(threadId: ThreadId, provider: ReviewProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: ReviewRunId) => ensureNativeApi().review.cancel({ runId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reviewQueryKey(threadId, provider) }),
  });
}

export function useIgnoreReviewFinding(threadId: ThreadId, provider: ReviewProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { findingId: ReviewFindingId; ignored: boolean }) =>
      ensureNativeApi().review.ignoreFinding(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reviewQueryKey(threadId, provider) }),
  });
}

export function useReviewProgress(threadId: ThreadId, provider: ReviewProvider) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<Extract<ReviewStreamEvent, { type: "progress" }> | null>(
    null,
  );

  useEffect(
    () =>
      ensureNativeApi().review.onEvent((event) => {
        if (event.type === "progress") {
          if (event.threadId === threadId) setProgress(event);
          return;
        }
        if (
          event.type === "run" &&
          event.run.threadId === threadId &&
          event.run.provider === provider
        ) {
          queryClient.setQueryData<ReviewListResult>(
            reviewQueryKey(threadId, provider),
            (current) =>
              current
                ? {
                    ...current,
                    runs: [event.run, ...current.runs.filter((run) => run.id !== event.run.id)],
                  }
                : current,
          );
          return;
        }
        if (
          event.type === "finding" &&
          event.finding.threadId === threadId &&
          event.finding.provider === provider
        ) {
          queryClient.setQueryData<ReviewListResult>(
            reviewQueryKey(threadId, provider),
            (current) =>
              current
                ? {
                    ...current,
                    findings: [
                      event.finding,
                      ...current.findings.filter((finding) => finding.id !== event.finding.id),
                    ],
                  }
                : current,
          );
        }
      }),
    [provider, queryClient, threadId],
  );

  return progress;
}
