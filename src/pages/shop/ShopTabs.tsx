import { Button } from "@/components/ui/button";
import { ZapIcon, UsersIcon } from "lucide-react";

interface ShopTabsProps {
  selectedTab: "boosts" | "characters";
  onTabChange: (tab: "boosts" | "characters") => void;
}

export default function ShopTabs({ selectedTab, onTabChange }: ShopTabsProps) {
  return (
    <div className="flex justify-center space-x-4 mb-8">
      <Button
        onClick={() => onTabChange("boosts")}
        className={`px-4 py-2 text-base font-medium transition-all duration-300 ${
          selectedTab === "boosts"
            ? "bg-amber-600 text-[#1a0d00]"
            : "bg-[#2a1a0a] text-amber-400 hover:bg-[#3a2410]"
        }`}
      >
        <ZapIcon className="h-4 w-4 mr-2" />
        Mining Boosts
      </Button>
      <Button
        disabled
        className={`px-4 py-2 text-base font-medium transition-all duration-300 bg-[#2a1a0a] text-amber-400 opacity-60 cursor-not-allowed`}
      >
        <UsersIcon className="h-4 w-4 mr-2" />
        Character Mints
      </Button>
    </div>
  );
}
