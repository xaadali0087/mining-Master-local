import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Player {
  id: string;
  rank: number;
  username: string;
  gems: number;
  level: number;
  avatar?: string;
}

interface LeaderboardTableProps {
  players: Player[];
}

export default function LeaderboardTable({ players }: LeaderboardTableProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-400";
      case 2:
        return "text-gray-300";
      case 3:
        return "text-amber-600";
      default:
        return "text-amber-200";
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#2a1a0a]/90 border border-[#3a2410] rounded-lg shadow-2xl backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-amber-900/50">
            <TableHead className="w-[100px] text-amber-400">Rank</TableHead>
            <TableHead className="text-amber-400">Player</TableHead>
            <TableHead className="text-right text-amber-400">Level</TableHead>
            <TableHead className="text-right text-amber-400">
              Total Gems
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow
              key={player.id}
              className="border-b border-amber-900/30 hover:bg-[#3a2410]/50"
            >
              <TableCell className={`font-bold ${getRankColor(player.rank)}`}>
                <div className="flex items-center">
                  {getRankIcon(player.rank) || player.rank}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-[#1a0d00] flex items-center justify-center">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <span className="text-amber-400 text-sm">
                        {player.username[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-amber-200">{player.username}</span>
                </div>
              </TableCell>
              <TableCell className="text-right text-amber-300">
                Level {player.level}
              </TableCell>
              <TableCell className="text-right font-bold text-amber-400">
                {player.gems.toLocaleString()} GEMS
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
