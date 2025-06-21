import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, StoreIcon } from "lucide-react";

export default function ShopHeader() {
  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-center">
        <StoreIcon className="h-10 w-10 text-amber-400 mr-3" />
        <h1 className="text-5xl font-bold text-white text-center font-winky">
          Mining Masters Shop
        </h1>
      </div>

      <Alert className="bg-yellow-900/50 border-yellow-800 max-w-3xl mx-auto">
        <InfoIcon className="h-5 w-5 text-amber-300" />
        <AlertDescription className="text-amber-200 font-medium ml-2">
          All purchases are final and non-refundable. Boosts last for 24 hours
          from activation.
        </AlertDescription>
      </Alert>
    </div>
  );
}
