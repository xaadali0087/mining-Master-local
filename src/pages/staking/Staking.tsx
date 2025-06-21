import { useEffect, useState } from "react";
import { RewardsCard } from "./RewardsCard";
import { StakingCard } from "./StakingCard";
import { StakingHeader } from "./StakingHeader";

export default function Staking() {
  const [amount, setAmount] = useState("");
  const [stakedAmount, setStakedAmount] = useState(0);
  const [rewards, setRewards] = useState(0);
  const [stakingTime, setStakingTime] = useState(0);

  // Constants
  const REWARD_RATE = 0.008; // 0.8% per 24 hours
  const MIN_STAKING_PERIOD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Calculate rewards every second
  useEffect(() => {
    if (stakedAmount > 0) {
      const interval = setInterval(() => {
        const now = Date.now();
        const timeStaked = now - stakingTime;

        if (timeStaked >= MIN_STAKING_PERIOD) {
          const daysStaked = timeStaked / (24 * 60 * 60 * 1000);
          const calculatedRewards = stakedAmount * REWARD_RATE * daysStaked;
          setRewards(calculatedRewards);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [stakedAmount, stakingTime]);

  const handleStake = () => {
    const stakeAmount = parseFloat(amount);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      alert("Please enter a valid amount to stake");
      return;
    }
    setStakedAmount(stakeAmount);
    setStakingTime(Date.now());
    setAmount("");
  };

  const handleUnstake = () => {
    if (Date.now() - stakingTime < MIN_STAKING_PERIOD) {
      alert("You must stake for at least 24 hours before unstaking");
      return;
    }
    setStakedAmount(0);
    setRewards(0);
    setStakingTime(0);
  };

  const handleClaimRewards = () => {
    if (Date.now() - stakingTime < MIN_STAKING_PERIOD) {
      alert("You must stake for at least 24 hours before claiming rewards");
      return;
    }
    // Implement claim rewards logic here
    console.log("Claiming rewards:", rewards);
    setRewards(0);
  };

  const isStakingPeriodComplete =
    Date.now() - stakingTime >= MIN_STAKING_PERIOD;

  return (
    <main className="py-20">
      <div className="container mx-auto px-4">
        <StakingHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <StakingCard
            amount={amount}
            stakedAmount={stakedAmount}
            onAmountChange={setAmount}
            onStake={handleStake}
            onUnstake={handleUnstake}
          />

          <RewardsCard
            stakedAmount={stakedAmount}
            rewards={rewards}
            stakingTime={stakingTime}
            onClaimRewards={handleClaimRewards}
            isStakingPeriodComplete={isStakingPeriodComplete}
          />
        </div>
      </div>
    </main>
  );
}
