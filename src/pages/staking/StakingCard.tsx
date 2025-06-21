import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GemIcon } from "lucide-react";

interface StakingCardProps {
  amount: string;
  stakedAmount: number;
  onAmountChange: (value: string) => void;
  onStake: () => void;
  onUnstake: () => void;
}

export function StakingCard({
  amount,
  stakedAmount,
  onAmountChange,
  onStake,
  onUnstake,
}: StakingCardProps) {
  return (
    <Card className="bg-[#2a1a0a]/90 border-[#3a2410] shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="border-b border-amber-900/50 pb-4">
        <CardTitle className="text-2xl text-amber-400 flex items-center">
          <GemIcon className="h-6 w-6 mr-2" />
          Stake Your Gems
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <Label htmlFor="stake-amount" className="text-amber-300 text-lg">
              Amount to Stake
            </Label>
            <div className="relative">
              <Input
                id="stake-amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="bg-[#1a0d00] border-[#3a2410] text-white pl-4 h-12 text-lg focus:border-amber-500 focus:ring-amber-500/30"
                disabled={stakedAmount > 0}
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-500 font-medium">
                GEMS
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-4 mt-auto pt-6">
          <Button
            onClick={onStake}
            className="w-full bg-amber-600 hover:bg-amber-500 text-[#1a0d00] font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/30"
            disabled={stakedAmount > 0}
          >
            <GemIcon className="h-5 w-5 mr-2" />
            Stake Gems
          </Button>
          {stakedAmount > 0 && (
            <Button
              onClick={onUnstake}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-red-600/30"
            >
              Unstake Gems
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
