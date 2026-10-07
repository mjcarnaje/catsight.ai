import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage } from "@/lib/api";

/** One click into the live demo: a temporary guest account, then the dashboard. */
export function useGuestSignIn() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  return useMutation({
    mutationFn: authApi.guest,
    onSuccess: (response) => {
      signIn(response);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) =>
      toast({ title: "Couldn't start the demo", description: errorMessage(error), variant: "destructive" }),
  });
}
