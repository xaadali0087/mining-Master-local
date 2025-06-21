import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// Define the Boost type
type Boost = {
  id: number;
  name: string;
  effect: string;
  duration: string;
  image: string;
  staked: boolean;
  boostType: "giveaway" | "purchased" | "permanent"; // Added to distinguish between boost types
  multiplier: number; // Multiplier effect
};

// Boost data including the permanent, purchased in-game, and giveaway boosts
const boosts: Boost[] = [
  {
    id: 1,
    name: "In-Game Mining Boost",
    effect: "10% extra gems on successful mining expeditions",
    duration: "24h",
    image: "/images/mining_boost.png",
    staked: false,
    boostType: "purchased",
    multiplier: 1.1,
  },
  {
    id: 2,
    name: "Giveaway Gem Boost",
    effect: "10% extra gems on successful mining expeditions",
    duration: "24h",
    image: "/images/gem_boost.png",
    staked: false,
    boostType: "giveaway",
    multiplier: 1.1,
  },
  {
    id: 3,
    name: "Lifetime Gem Boost",
    effect: "20% extra gems on all mining expeditions",
    duration: "permanent",
    image: "/images/giveaway_boost.png",
    staked: false,
    boostType: "permanent",
    multiplier: 1.2,
  },
];

export default function BoostButton() {
  const [open, setOpen] = useState(false);
  const [availableBoosts, setAvailableBoosts] = useState<Boost[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<{
    permanent: boolean;
    timeBoost: null | "giveaway" | "purchased";
  }>({ permanent: false, timeBoost: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock function to check wallet for boosts and active status
  const checkWalletForBoosts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call to check wallet
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock results - in production this would come from contract calls
      const hasInGameBoost = true; // Would check if player purchased the boost
      const hasGiveawayBoost = true; // Would check if player received giveaway boost

      // Check which boosts are active (would come from contract)
      const isPermanentActive = false;
      const isInGameActive = false;
      const isGiveawayActive = false;

      // Set active boost state
      setActiveBoosts({
        permanent: isPermanentActive,
        timeBoost: isInGameActive
          ? "purchased"
          : isGiveawayActive
          ? "giveaway"
          : null,
      });

      // Update available boosts based on wallet check
      const userBoosts = boosts
        .filter((boost) => {
          if (boost.boostType === "permanent") return true; // Always show permanent boosts
          if (boost.boostType === "purchased" && hasInGameBoost) return true;
          if (boost.boostType === "giveaway" && hasGiveawayBoost) return true;
          return false;
        })
        .map((boost) => ({
          ...boost,
          staked:
            (boost.boostType === "permanent" && isPermanentActive) ||
            (boost.boostType === "purchased" && isInGameActive) ||
            (boost.boostType === "giveaway" && isGiveawayActive),
        }));

      setAvailableBoosts(userBoosts);
    } catch (err) {
      console.error("Error checking wallet for boosts:", err);
      setError("Failed to verify your available boosts. Please try again.");
      setAvailableBoosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Check wallet when dialog opens
  const handleOpenDialog = () => {
    setOpen(true);
    checkWalletForBoosts();
  };

  const handleStake = async (boost: Boost) => {
    // Different activation logic based on boost type
    try {
      setLoading(true);

      // Check if trying to activate a 24-hour boost when another is already active
      if (
        (boost.boostType === "purchased" || boost.boostType === "giveaway") &&
        activeBoosts.timeBoost !== null &&
        activeBoosts.timeBoost !== boost.boostType
      ) {
        setError(
          `You already have a ${
            activeBoosts.timeBoost === "purchased" ? "in-game" : "giveaway"
          } boost active. Deactivate it first.`
        );
        setLoading(false);
        return;
      }

      if (boost.boostType === "purchased") {
        // For in-game purchased boosts
        console.log(`Activating purchased in-game boost: ${boost.name}`);
        // This would call the specific contract method for in-game boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          timeBoost: "purchased",
        }));
      } else if (boost.boostType === "giveaway") {
        // For giveaway boosts
        console.log(`Activating giveaway boost: ${boost.name}`);
        // This would call the specific contract method for giveaway boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          timeBoost: "giveaway",
        }));
      } else {
        // For permanent boosts
        console.log(`Activating permanent boost: ${boost.name}`);
        // This would call the specific contract method for permanent boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          permanent: true,
        }));
      }

      // Update the staked status in our local state
      setAvailableBoosts((prev) =>
        prev.map((b) => (b.id === boost.id ? { ...b, staked: true } : b))
      );
    } catch (err) {
      console.error(`Error activating ${boost.name}:`, err);
      setError(`Failed to activate ${boost.name}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (boost: Boost) => {
    // Different deactivation logic based on boost type
    try {
      setLoading(true);

      if (boost.boostType === "purchased") {
        console.log(`Deactivating purchased in-game boost: ${boost.name}`);
        // This would call the specific contract method for in-game boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          timeBoost: null,
        }));
      } else if (boost.boostType === "giveaway") {
        console.log(`Deactivating giveaway boost: ${boost.name}`);
        // This would call the specific contract method for giveaway boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          timeBoost: null,
        }));
      } else {
        console.log(`Deactivating permanent boost: ${boost.name}`);
        // This would call the specific contract method for permanent boosts
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate contract call

        // Update active boosts state
        setActiveBoosts((prev) => ({
          ...prev,
          permanent: false,
        }));
      }

      // Update the staked status in our local state
      setAvailableBoosts((prev) =>
        prev.map((b) => (b.id === boost.id ? { ...b, staked: false } : b))
      );
    } catch (err) {
      console.error(`Error deactivating ${boost.name}:`, err);
      setError(`Failed to deactivate ${boost.name}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <button
        className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky flex items-center shadow-lg shadow-amber-900/20"
        onClick={handleOpenDialog}
        data-component-name="BoostButton"
      >
        <img
          src="/images/Boost.png"
          alt="Boost"
          className="w-32 h-32 object-contain"
          data-component-name="BoostButton"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-0 !max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl">
          <div className="bg-amber-950/50 border-b border-amber-500/30 p-6">
            <DialogHeader className="flex justify-between items-center">
              <DialogTitle className="text-3xl font-bold text-amber-400 font-winky drop-shadow-md">
                <span className="mr-3">🚀</span> Available Boosts
              </DialogTitle>
              <DialogClose className="h-8 w-8 rounded-full bg-amber-800/30 hover:bg-amber-700 p-1 text-amber-300 transition-colors" />
            </DialogHeader>
            <p className="text-amber-200/90 mt-2 pl-1">
              Boost your mining operations with these powerful upgrades
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Active boosts summary */}
            <div className="col-span-2 mb-4 bg-amber-950/30 border border-amber-500/20 rounded-lg p-4">
              <h3 className="text-amber-400 font-winky text-lg mb-2">
                Active Boosts
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${
                      activeBoosts.permanent ? "bg-green-500" : "bg-gray-500"
                    }`}
                  ></div>
                  <span className="text-amber-200">
                    Lifetime Boost (20% Gems)
                  </span>
                </div>
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${
                      activeBoosts.timeBoost === "purchased"
                        ? "bg-green-500"
                        : "bg-gray-500"
                    }`}
                  ></div>
                  <span className="text-amber-200">
                    In-Game Boost (10% Gems)
                  </span>
                </div>
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${
                      activeBoosts.timeBoost === "giveaway"
                        ? "bg-green-500"
                        : "bg-gray-500"
                    }`}
                  ></div>
                  <span className="text-amber-200">
                    Giveaway Boost (10% Gems)
                  </span>
                </div>
                <div className="ml-auto text-amber-300/70 text-sm">
                  {activeBoosts.timeBoost !== null && (
                    <span>Only one 24-hour boost can be active at a time</span>
                  )}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="col-span-2 flex items-center justify-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
                <span className="ml-3 text-amber-300">
                  Checking your wallet for available boosts...
                </span>
              </div>
            ) : error ? (
              <div className="col-span-2 bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
                <p className="text-red-300">{error}</p>
                <button
                  onClick={checkWalletForBoosts}
                  className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium"
                >
                  Try Again
                </button>
              </div>
            ) : availableBoosts.length === 0 ? (
              <div className="col-span-2 bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-center">
                <p className="text-amber-300">
                  You don't have any boosts available.
                </p>
              </div>
            ) : (
              availableBoosts.map((boost) => (
                <div
                  key={boost.id}
                  className={`bg-gradient-to-br from-[#1a0d00] to-[#150800] border ${
                    boost.staked ? "border-green-500/50" : "border-amber-500/30"
                  } rounded-lg p-6 hover:border-amber-400 hover:shadow-md hover:shadow-amber-900/30 transition-all duration-300 relative overflow-hidden`}
                >
                  {boost.boostType === "permanent" ? (
                    <div className="absolute top-3 right-3 bg-amber-700/70 px-3 py-1 rounded-full text-amber-100 text-xs font-bold">
                      LIFETIME
                    </div>
                  ) : boost.boostType === "purchased" ? (
                    <div className="absolute top-3 right-3 bg-amber-600/60 px-3 py-1 rounded-full text-amber-100 text-xs font-bold">
                      IN-GAME
                    </div>
                  ) : (
                    <div className="absolute top-3 right-3 bg-green-600/60 px-3 py-1 rounded-full text-amber-100 text-xs font-bold">
                      GIVEAWAY
                    </div>
                  )}

                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 mb-4 relative">
                      <img
                        src={boost.image}
                        alt={boost.name}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-pulse"></div>
                    </div>

                    <h4 className="text-xl font-bold text-amber-400 font-winky text-center mb-3">
                      {boost.name}
                    </h4>

                    <div className="bg-amber-950/30 rounded-lg p-3 mb-4 w-full">
                      <p className="text-amber-200 text-md font-body text-center">
                        <span className="text-amber-300 mr-2">💎</span>{" "}
                        {boost.effect}
                      </p>
                      <p className="text-amber-200/80 text-sm font-body text-center mt-2">
                        {boost.boostType === "permanent" ? (
                          <span className="text-green-400">
                            Permanent boost - never expires
                          </span>
                        ) : boost.boostType === "purchased" ? (
                          <span className="text-amber-300/80">
                            In-game boost - burns after 24 hours of use
                          </span>
                        ) : (
                          <span className="text-green-300/80">
                            Giveaway boost - burns after 24 hours of use
                          </span>
                        )}
                      </p>
                    </div>

                    {!boost.staked ? (
                      <button
                        onClick={() => handleStake(boost)}
                        disabled={
                          (boost.boostType === "purchased" ||
                            boost.boostType === "giveaway") &&
                          activeBoosts.timeBoost !== null &&
                          activeBoosts.timeBoost !== boost.boostType
                        }
                        className={`${
                          (boost.boostType === "purchased" ||
                            boost.boostType === "giveaway") &&
                          activeBoosts.timeBoost !== null &&
                          activeBoosts.timeBoost !== boost.boostType
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        } 
                                text-white font-semibold px-5 py-2 rounded-lg transition-all duration-300 shadow-md w-full font-winky`}
                        title={
                          (boost.boostType === "purchased" ||
                            boost.boostType === "giveaway") &&
                          activeBoosts.timeBoost !== null &&
                          activeBoosts.timeBoost !== boost.boostType
                            ? `You already have a ${
                                activeBoosts.timeBoost === "purchased"
                                  ? "in-game"
                                  : "giveaway"
                              } boost active`
                            : ""
                        }
                      >
                        {(boost.boostType === "purchased" ||
                          boost.boostType === "giveaway") &&
                        activeBoosts.timeBoost !== null &&
                        activeBoosts.timeBoost !== boost.boostType
                          ? "Cannot Activate"
                          : "Activate Boost"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnstake(boost)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg transition-all duration-300 shadow-md w-full font-winky"
                      >
                        Deactivate Boost
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
