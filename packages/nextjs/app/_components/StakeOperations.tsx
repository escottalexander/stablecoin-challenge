import React, { useState } from "react";
import TooltipInfo from "./TooltipInfo";
import { parseEther } from "viem";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const StakeOperations = () => {
  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { writeContractAsync: writeMyUSDContract } = useScaffoldWriteContract({
    contractName: "MyUSD",
  });

  const { data: myUSDCStakingContract } = useScaffoldContract({ contractName: "MyUSDStaking" });

  const { writeContractAsync: writeStablecoinEngineContract } = useScaffoldWriteContract({
    contractName: "MyUSDStaking",
  });

  const handleStake = async () => {
    if (!myUSDCStakingContract) {
      notification.error("MyUSDStaking contract not found");
      return;
    }
    try {
      await writeMyUSDContract({
        functionName: "approve",
        args: [myUSDCStakingContract.address, stakeAmount ? parseEther(stakeAmount) : 0n],
      });

      await writeStablecoinEngineContract({
        functionName: "stake",
        args: [stakeAmount ? parseEther(stakeAmount) : 0n],
      });
      setStakeAmount("");
    } catch (error) {
      console.error("Error staking:", error);
    }
  };

  const handleWithdraw = async () => {
    try {
      await writeStablecoinEngineContract({
        functionName: "withdraw",
        args: [withdrawAmount ? parseEther(withdrawAmount) : 0n],
      });
      setWithdrawAmount("");
    } catch (error) {
      console.error("Error withdrawing:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl indicator">
      <TooltipInfo top={3} right={3} infoText="Use these controls to stake or unstake MyUSD" />
      <div className="card-body">
        <h2 className="card-title">Stake Operations</h2>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Stake (MyUSD)</span>
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput value={stakeAmount} onChange={setStakeAmount} placeholder="Amount" disableMultiplyBy1e18 />
            <button className="btn btn-sm btn-primary" onClick={handleStake} disabled={!stakeAmount}>
              Stake
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Withdraw (MyUSD)</span>
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              placeholder="Amount"
              disableMultiplyBy1e18
            />
            <button className="btn btn-sm btn-primary" onClick={handleWithdraw} disabled={!withdrawAmount}>
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakeOperations;
