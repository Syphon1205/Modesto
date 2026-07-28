import type { OpenClawConnectionConfigUpdate } from "@modesto/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { ensureNativeApi } from "../nativeApi";

export const openClawQueryKey = ["openclaw", "snapshot"] as const;

export const openClawSnapshotQueryOptions = () =>
  queryOptions({
    queryKey: openClawQueryKey,
    queryFn: () => ensureNativeApi().openClaw.getSnapshot(),
    refetchInterval: 15_000,
  });

export function useUpdateOpenClawConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenClawConnectionConfigUpdate) =>
      ensureNativeApi().openClaw.updateConfig(input),
    onSuccess: (snapshot) => queryClient.setQueryData(openClawQueryKey, snapshot),
  });
}

export function useSetupOpenClaw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ensureNativeApi().openClaw.setup({ installPlugin: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: openClawQueryKey }),
  });
}

export function useTestOpenClawConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ensureNativeApi().openClaw.testConnection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: openClawQueryKey }),
  });
}
