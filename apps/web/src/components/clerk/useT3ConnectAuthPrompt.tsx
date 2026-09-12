import { useNavigate } from "@tanstack/react-router";

export function useT3ConnectAuthPrompt() {
  const navigate = useNavigate();
  const openAuthPrompt = () => {
    void navigate({ to: "/sign-in" });
  };
  return { authPrompt: null, openAuthPrompt };
}
