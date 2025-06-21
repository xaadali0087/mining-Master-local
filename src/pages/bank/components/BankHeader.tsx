import { CoinsIcon } from "lucide-react";

export default function BankHeader() {
  return (
    <div className="flex items-center justify-center mb-8">
      <CoinsIcon className="h-10 w-10 text-amber-400 mr-3" />
      <h1 className="text-5xl font-bold text-white text-center font-winky">
        Mining Masters Bank
      </h1>
    </div>
  );
}
