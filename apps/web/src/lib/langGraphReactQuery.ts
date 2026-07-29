import type {
  LangGraphConnectionConfigUpdate,
  LangGraphInvokeInput,
} from "@modesto/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { ensureNativeApi } from "../nativeApi";

export const langGraphQueryKey = ["langgraph", "snapshot"] as const;

export const langGraphSnapshotQueryOptions = () =>
  queryOptions({
    queryKey: langGraphQueryKey,
    queryFn: () => ensureNativeApi().langGraph.getSnapshot(),
    staleTime: 30_000,
  });

export function useUpdateLangGraphConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LangGraphConnectionConfigUpdate) =>
      ensureNativeApi().langGraph.updateConfig(input),
    onSuccess: (snapshot) => queryClient.setQueryData(langGraphQueryKey, snapshot),
  });
}

export function useTestLangGraphConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ensureNativeApi().langGraph.testConnection(),
    onSuccess: (status) =>
      queryClient.setQueryData(langGraphQueryKey, (current) =>
        current && typeof current === "object" ? { ...current, status } : current,
      ),
  });
}

export function useInvokeLangGraph() {
  return useMutation({
    mutationFn: (input: LangGraphInvokeInput) => ensureNativeApi().langGraph.invoke(input),
  });
}
