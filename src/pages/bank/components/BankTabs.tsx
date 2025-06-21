import { Button } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface BankTabsProps {
  selectedTab: "deposit" | "withdraw";
  onTabChange: (tab: "deposit" | "withdraw") => void;
}

export default function BankTabs({ selectedTab, onTabChange }: BankTabsProps) {
  return (
    <div className="flex justify-center mb-8 w-full">
      <Button
        onClick={() => onTabChange("deposit")}
        className={`flex-1 px-4 py-2 text-base font-medium transition-all duration-300 ${
          selectedTab === "deposit"
            ? "bg-amber-600 text-[#1a0d00]"
            : "bg-[#2a1a0a] text-amber-400 hover:bg-[#3a2410]"
        }`}
      >
        <ArrowDownIcon className="h-4 w-4 mr-2" />
        Deposit
      </Button>
      <Button
        onClick={() => onTabChange("withdraw")}
        className={`flex-1 px-4 py-2 text-base font-medium transition-all duration-300 ${
          selectedTab === "withdraw"
            ? "bg-amber-600 text-[#1a0d00]"
            : "bg-[#2a1a0a] text-amber-400 hover:bg-[#3a2410]"
        }`}
      >
        <ArrowUpIcon className="h-4 w-4 mr-2" />
        Withdraw
      </Button>
    </div>
  );
}
