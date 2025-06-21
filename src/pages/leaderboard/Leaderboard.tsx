import { useState } from "react";
import LeaderboardHeader from "./LeaderboardHeader";
import LeaderboardTable from "./LeaderboardTable";

interface Player {
  id: string;
  rank: number;
  username: string;
  gems: number;
  level: number;
  avatar?: string;
}

export default function Leaderboard() {
  const [players] = useState<Player[]>([
    {
      id: "1",
      rank: 1,
      username: "MiningKing",
      gems: 1500000,
      level: 50,
      avatar: "/avatars/mining-king.png",
    },
    {
      id: "2",
      rank: 2,
      username: "GemHunter",
      gems: 1200000,
      level: 45,
    },
    {
      id: "3",
      rank: 3,
      username: "CrystalMaster",
      gems: 1000000,
      level: 40,
    },
    {
      id: "4",
      rank: 4,
      username: "DiamondDigger",
      gems: 800000,
      level: 35,
    },
    {
      id: "5",
      rank: 5,
      username: "GoldRush",
      gems: 600000,
      level: 30,
    },
    {
      id: "6",
      rank: 6,
      username: "SilverMiner",
      gems: 400000,
      level: 25,
    },
    {
      id: "7",
      rank: 7,
      username: "CopperCollector",
      gems: 200000,
      level: 20,
    },
    {
      id: "8",
      rank: 8,
      username: "IronWorker",
      gems: 100000,
      level: 15,
    },
    {
      id: "9",
      rank: 9,
      username: "StoneBreaker",
      gems: 50000,
      level: 10,
    },
    {
      id: "10",
      rank: 10,
      username: "RockCrusher",
      gems: 25000,
      level: 5,
    },
  ]);

  return (
    <>
      <LeaderboardHeader />
      <div className="max-w-4xl mx-auto">
        <LeaderboardTable players={players} />
      </div>
    </>
  );
}
