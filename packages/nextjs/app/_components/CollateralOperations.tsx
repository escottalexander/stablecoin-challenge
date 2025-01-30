import React, { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const CollateralOperations = () => {
  const [collateralAmount, setCollateralAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { writeContractAsync: addCollateral } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const { writeContractAsync: withdrawCollateral } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const handleAddCollateral = async () => {
    try {
      await addCollateral({
        functionName: "addCollateral",
        value: collateralAmount ? parseEther(collateralAmount) : 0n,
      });
      setCollateralAmount("");
    } catch (error) {
      console.error("Error adding collateral:", error);
    }
  };

  const handleWithdrawCollateral = async () => {
    try {
      await withdrawCollateral({
        functionName: "withdrawCollateral",
        args: [withdrawAmount ? parseEther(withdrawAmount) : 0n],
      });
      setWithdrawAmount("");
    } catch (error) {
      console.error("Error withdrawing collateral:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Collateral Operations</h2>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Add Collateral (ETH)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="input input-bordered w-full"
              value={collateralAmount}
              onChange={e => setCollateralAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddCollateral} disabled={!collateralAmount}>
              Add
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Withdraw Collateral (ETH)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="input input-bordered w-full"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleWithdrawCollateral} disabled={!withdrawAmount}>
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollateralOperations;
