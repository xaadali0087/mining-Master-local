import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BankTabs from "./BankTabs";
import DepositForm from "./DepositForm";
import WithdrawForm from "./WithdrawForm";
import { useState } from "react";

interface BankCardProps {
  onDeposit: (amount: string) => void;
  onWithdraw: (amount: string) => void;
  isDisabled: boolean;
}

export default function BankCard({
  onDeposit,
  onWithdraw,
  isDisabled,
}: BankCardProps) {
  const [selectedTab, setSelectedTab] = useState<"deposit" | "withdraw">(
    "deposit"
  );
  const [amount, setAmount] = useState("");

  const handleDeposit = () => {
    onDeposit(amount);
    setAmount("");
  };

  const handleWithdraw = () => {
    onWithdraw(amount);
    setAmount("");
  };

  return (
    <Card className="bg-[#1a0d00] border-[#3a2410] shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-amber-300">
          Bank Operations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BankTabs selectedTab={selectedTab} onTabChange={setSelectedTab} />
        {selectedTab === "deposit" ? (
          <DepositForm
            amount={amount}
            onAmountChange={setAmount}
            onDeposit={handleDeposit}
            isDisabled={isDisabled}
          />
        ) : (
          <WithdrawForm
            amount={amount}
            onAmountChange={setAmount}
            onWithdraw={handleWithdraw}
            isDisabled={isDisabled}
          />
        )}
      </CardContent>
    </Card>
  );
}
