import React, { useState } from "react";
import RatioChange from "./RatioChange";
import TooltipInfo from "./TooltipInfo";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

const BorrowOperations = () => {
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  const { address } = useAccount();

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "StablecoinDEX",
    functionName: "currentPrice",
  });

  const { writeContractAsync: writeStablecoinEngineContract } = useScaffoldWriteContract({
    contractName: "StablecoinEngine",
  });

  const handleBorrow = async () => {
    try {
      await writeStablecoinEngineContract({
        functionName: "borrowStablecoin",
        args: [borrowAmount ? parseEther(borrowAmount) : 0n],
      });
      setBorrowAmount("");
    } catch (error) {
      console.error("Error borrowing MyUSD:", error);
    }
  };

  const handleRepay = async () => {
    try {
      await writeStablecoinEngineContract({
        functionName: "repayStablecoin",
        args: [repayAmount ? parseEther(repayAmount) : 0n],
      });
      setRepayAmount("");
    } catch (error) {
      console.error("Error repaying MyUSD:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl indicator">
      <TooltipInfo
        top={3}
        right={3}
        infoText={`Use these controls to borrow and repay ${tokenName} from the StablecoinEngine pool`}
      />
      <div className="card-body">
        <div className="w-full flex justify-between">
          <h2 className="card-title">Borrow Operations</h2>
        </div>

        <div className="form-control">
          <label className="label flex justify-between">
            <span className="label-text">Borrow {tokenName}</span>{" "}
            {address && (
              <RatioChange
                user={address}
                ethPrice={Number(formatEther(ethPrice || 0n))}
                inputBorrowAmount={Number(borrowAmount)}
              />
            )}
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput value={borrowAmount} onChange={setBorrowAmount} placeholder="Amount" disableMultiplyBy1e18 />
            <button className="btn btn-sm btn-primary" onClick={handleBorrow} disabled={!borrowAmount}>
              Borrow
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Repay Debt</span>
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput value={repayAmount} onChange={setRepayAmount} placeholder="Amount" disableMultiplyBy1e18 />
            <button className="btn btn-sm btn-primary" onClick={handleRepay} disabled={!repayAmount}>
              Repay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BorrowOperations;
