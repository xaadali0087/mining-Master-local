import { useState } from "react";
import BoostCard from "./BoostCard";
import CharacterCard from "./CharacterCard";
import ShopHeader from "./ShopHeader";
import ShopTabs from "./ShopTabs";

interface BoostItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  multiplier: number;
  icon: string;
}

interface CharacterMint {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  comingSoon: boolean;
}

export default function Shop() {
  const [selectedTab, setSelectedTab] = useState<"boosts" | "characters">(
    "boosts"
  );

  // Only one mining boost is available in-game as per game design
  const miningBoosts: BoostItem[] = [
    {
      id: "boost-1",
      name: "24 hour in-game boost",
      description:
        "Get 10% more GEMS from mining expeditions for 24 hours. Cannot be combined with other 24h boosts.",
      price: 200,
      duration: 24,
      multiplier: 1.1,
      icon: "⚡",
    },
  ];

  const characterMints: CharacterMint[] = [
    {
      id: "char-1",
      name: "Mining Master",
      description: "A legendary miner with enhanced mining capabilities",
      price: 1000,
      image: "/characters/mining-master.png",
      comingSoon: true,
    },
    {
      id: "char-2",
      name: "Gem Seeker",
      description: "Specialized in finding rare gems and minerals",
      price: 1500,
      image: "/characters/gem-seeker.png",
      comingSoon: true,
    },
  ];

  const handleBuyBoost = (boost: BoostItem) => {
    // Implement buy boost logic here
    console.log("Buying boost:", boost);
  };

  return (
    <main className="py-20">
      <div className="container mx-auto px-4">
        <ShopHeader />

        <div className="max-w-6xl mx-auto">
          <ShopTabs selectedTab={selectedTab} onTabChange={setSelectedTab} />

          {selectedTab === "boosts" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {miningBoosts.map((boost) => (
                <BoostCard
                  key={boost.id}
                  boost={boost}
                  onBuy={handleBuyBoost}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {characterMints.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
