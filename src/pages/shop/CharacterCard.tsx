import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CharacterMint {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  comingSoon: boolean;
}

interface CharacterCardProps {
  character: CharacterMint;
}

export default function CharacterCard({ character }: CharacterCardProps) {
  return (
    <Card className="bg-[#2a1a0a]/90 border-[#3a2410] shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="border-b border-amber-900/50 pb-4">
        <CardTitle className="text-2xl text-amber-400">
          {character.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="space-y-4 flex-1">
          <div className="aspect-square bg-[#1a0d00]/50 rounded-lg flex items-center justify-center">
            <span className="text-amber-400 text-lg">Coming Soon</span>
          </div>
          <p className="text-amber-200">{character.description}</p>
          <div className="flex justify-between items-center text-amber-300">
            <span>Price:</span>
            <span className="font-bold">{character.price} GEMS</span>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button
            disabled={character.comingSoon}
            className="w-full bg-amber-600 hover:bg-amber-500 text-[#1a0d00] font-bold py-3 text-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {character.comingSoon ? "Coming Soon" : "Mint Character"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
