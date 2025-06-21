import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, TrophyIcon } from "lucide-react";

export default function LeaderboardHeader() {
  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-center">
        <TrophyIcon className="h-10 w-10 text-amber-400 mr-3" />
        <h1 className="text-5xl font-bold text-white text-center font-winky">
          Mining Masters Leaderboard
        </h1>
      </div>

      <Alert className="bg-yellow-900/50 border-yellow-800 max-w-3xl mx-auto">
        <InfoIcon className="h-5 w-5 text-amber-300" />
        <AlertDescription className="text-amber-200 font-medium ml-2">
          Top miners are ranked by their total gems collected. Rankings are
          updated every hour.
        </AlertDescription>
      </Alert>
    </div>
  );
}
