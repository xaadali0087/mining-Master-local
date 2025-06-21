import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useState } from "react";
import { FOOD_ITEMS } from "@/constants/food";

export default function FoodEffects() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex justify-center w-full">
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold p-3 rounded-lg transition-all duration-300 font-winky shadow-lg shadow-amber-900/20"
        data-component-name="FoodEffects"
      >
        Food Effects
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-0 !max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl">
          <div className="bg-amber-950/50 border-b border-amber-500/30 p-6">
            <DialogHeader className="flex justify-between items-center">
              <DialogTitle className="text-3xl font-bold text-amber-400 font-winky drop-shadow-md">
                <span className="mr-3">📜</span> Food Effects
              </DialogTitle>
              <DialogClose className="h-8 w-8 rounded-full bg-amber-800/30 hover:bg-amber-700 p-1 text-amber-300 transition-colors" />
            </DialogHeader>
            <p className="text-amber-200/90 mt-2 pl-1">
              View the effects of various foods on your mining operations
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {FOOD_ITEMS.map((food) => (
              <div
                key={food.id}
                className="bg-gradient-to-br from-[#1a0d00] to-[#150800] border border-amber-500/30 rounded-lg p-5 hover:border-amber-400 hover:shadow-md hover:shadow-amber-900/30 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-amber-900/20 px-3 py-1 rounded-bl-lg text-amber-200/70 text-xs">
                  {food.price === 0 ? "FREE" : `${food.price} 💎`}
                </div>
                <div className="flex items-start">
                  <span className="text-4xl mr-4 mt-1">{food.icon}</span>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-amber-400 mb-2 font-winky">
                      {food.name}
                    </h4>
                    <div className="space-y-1">
                      <p className="text-amber-200/90 font-body flex items-center">
                        <span className="text-amber-300 mr-2">💎</span>
                        <span>{food.gemChance}% chance to find gems</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
