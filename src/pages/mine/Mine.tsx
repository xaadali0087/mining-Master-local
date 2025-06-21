import BoostButton from "./BoostButton";
import EatButton from "./EatButton";
import EnterMines from "./EnterMines";
import FoodEffects from "./FoodEffect";
import MinerArea from "./MinerArea";
import ReturnFromMines from "./ReturnFromMines";
import { MiningProvider } from "../../contexts/MiningContext";

/**
 * @title Mine Component
 * @notice Main Mining area where players interact with their staked miners
 * @dev Integrates staking and wallet functionality for Ronin blockchain interactions
 */
export default function Mine() {
  return (
    <MiningProvider>
      <main className="pb-10">
        <div className="absolute z-0 inset-0 bg-[url('/images/Cave_Gems.png')] bg-cover bg-center opacity-30"></div>
        <MinerArea />
        <div className="flex flex-wrap justify-center items-center gap-6 mt-8 relative z-10">
          <div className="flex flex-col items-center gap-4 w-48">
            <FoodEffects />
            <EatButton />
          </div>
          <div className="flex flex-col items-center gap-4">
            <BoostButton />
          </div>
          <div
            className="flex flex-col items-center gap-4 w-48 relative"
            data-component-name="Mine"
          >
            <EnterMines />
            <ReturnFromMines />
          </div>
        </div>
      </main>
    </MiningProvider>
  );
}
