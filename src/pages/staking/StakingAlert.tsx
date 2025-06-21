import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export function StakingAlert() {
  return (
    <Alert className="mt-8 bg-yellow-900/50 border-yellow-800 max-w-3xl mx-auto">
      <InfoIcon className="h-5 w-5 text-amber-300" />
      <AlertDescription className="text-amber-200 font-medium ml-2">
        You must stake for at least 24 hours to receive rewards. Early unstaking
        will forfeit your rewards.
      </AlertDescription>
    </Alert>
  );
}
