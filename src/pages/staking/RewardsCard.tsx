import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CoinsIcon, TimerIcon } from "lucide-react";

interface RewardsCardProps {
  stakedAmount: number;
  rewards: number;
  stakingTime: number;
  onClaimRewards: () => void;
  isStakingPeriodComplete: boolean;
}

export function RewardsCard({
  stakedAmount,
  rewards,
  stakingTime,
  onClaimRewards,
  isStakingPeriodComplete,
}: RewardsCardProps) {
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <Card className="bg-[#2a1a0a]/90 border-[#3a2410] shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="border-b border-amber-900/50 pb-4">
        <CardTitle className="text-2xl text-amber-400 flex items-center">
          <CoinsIcon className="h-6 w-6 mr-2" />
          Your Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="space-y-6 flex-1">
          <div className="bg-[#1a0d00]/50 p-4 rounded-lg border border-amber-900/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-amber-300">Currently Staked:</span>
              <span className="text-white font-bold">{stakedAmount} GEMS</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-amber-300">Reward Rate:</span>
              <span className="text-white font-bold">0.8% per 24h</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-300">Pending Rewards:</span>
              <span className="text-white font-bold">
                {rewards.toFixed(4)} GEMX
              </span>
            </div>
          </div>

          {stakingTime > 0 && (
            <div className="bg-[#1a0d00]/50 p-4 rounded-lg border border-amber-900/30">
              <div className="flex items-center text-amber-300 mb-2">
                <TimerIcon className="h-5 w-5 mr-2" />
                <span>Time Staked:</span>
              </div>
              <div className="text-white font-bold text-center">
                {formatTime(Date.now() - stakingTime)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          <Button
            onClick={onClaimRewards}
            className="w-full bg-amber-600 hover:bg-amber-500 text-[#1a0d00] font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/30"
            disabled={rewards <= 0 || !isStakingPeriodComplete}
          >
            <CoinsIcon className="h-5 w-5 mr-2" />
            Claim Rewards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
