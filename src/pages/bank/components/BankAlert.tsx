import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export default function BankAlert() {
  return (
    <Alert className="mb-8 bg-yellow-900/50 border-yellow-800 max-w-3xl mx-auto animate-pulse">
      <InfoIcon className="h-5 w-5 text-amber-300" />
      <AlertDescription className="text-amber-200 font-medium ml-2">
        Deposit and withdraw functionality will be available after TGE (Token
        Generation Event)
      </AlertDescription>
    </Alert>
  );
}
