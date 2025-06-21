import { useState } from "react";
import BankHeader from "./components/BankHeader";
import BankAlert from "./components/BankAlert";
import BankCard from "./components/BankCard";

export default function Bank() {
  const [isDisabled] = useState(true); // This will be controlled by TGE status

  const handleDeposit = (amount: string) => {
    console.log("Depositing:", amount);
    // Implement deposit logic here
  };

  const handleWithdraw = (amount: string) => {
    console.log("Withdrawing:", amount);
    // Implement withdraw logic here
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <BankHeader />
        <BankAlert />
        <BankCard
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
