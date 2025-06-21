import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpIcon } from "lucide-react";

interface WithdrawFormProps {
  amount: string;
  onAmountChange: (value: string) => void;
  onWithdraw: () => void;
  isDisabled: boolean;
}

export default function WithdrawForm({
  amount,
  onAmountChange,
  onWithdraw,
  isDisabled,
}: WithdrawFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="withdraw-amount" className="text-amber-300 text-lg">
          Amount to Withdraw
        </Label>
        <div className="relative">
          <Input
            id="withdraw-amount"
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="bg-[#1a0d00] border-[#3a2410] text-white pl-4 h-12 text-lg focus:border-amber-500 focus:ring-amber-500/30"
          />
          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-500 font-medium">
            Gem
          </span>
        </div>
      </div>
      <Button
        onClick={onWithdraw}
        className="w-full bg-amber-600 hover:bg-amber-500 text-[#1a0d00] font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/30"
        disabled={isDisabled}
      >
        <ArrowUpIcon className="h-5 w-5 mr-2" />
        Withdraw Gem
      </Button>
    </div>
  );
}
