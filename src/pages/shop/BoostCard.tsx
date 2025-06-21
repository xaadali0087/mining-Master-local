import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BoostItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  multiplier: number;
  icon: string;
}

interface BoostCardProps {
  boost: BoostItem;
  onBuy: (boost: BoostItem) => void;
}

export default function BoostCard({ boost, onBuy }: BoostCardProps) {
  return (
    <Card className="bg-[#2a1a0a]/90 border-[#3a2410] shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="border-b border-amber-900/50 pb-4">
        <CardTitle className="text-2xl text-amber-400 flex items-center">
          <span className="text-3xl mr-2">{boost.icon}</span>
          {boost.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="space-y-4 flex-1">
          <p className="text-amber-200">{boost.description}</p>
          <div className="flex justify-between items-center text-amber-300">
            <span>Duration:</span>
            <span className="font-bold">{boost.duration}h</span>
          </div>
          <div className="flex justify-between items-center text-amber-300">
            <span>Bonus:</span>
            <span className="font-bold">10% more GEMS</span>
          </div>
          <div className="flex justify-between items-center text-amber-300">
            <span>Price:</span>
            <span className="font-bold">{boost.price} GEMS</span>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            onClick={() => onBuy(boost)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-[#1a0d00] font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/30"
          >
            Buy Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
