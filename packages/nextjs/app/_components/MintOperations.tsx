import React, { useState } from "react";
import RatioChange from "./RatioChange";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MintOperations = () => {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");

  const { address } = useAccount();

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "CornPriceOracle",
    functionName: "price",
  });

  const { writeContractAsync: writeBasicLendingContract } = useScaffoldWriteContract({
    contractName: "BasicLending",
  });

  const handleMint = async () => {
    try {
      await writeBasicLendingContract({
        functionName: "borrowCorn",
        args: [mintAmount ? parseEther(mintAmount) : 0n],
      });
      setMintAmount("");
    } catch (error) {
      console.error("Error borrowing corn:", error);
    }
  };

  const handleBurn = async () => {
    try {
      await writeBasicLendingContract({
        functionName: "repayCorn",
        args: [burnAmount ? parseEther(burnAmount) : 0n],
      });
      setBurnAmount("");
    } catch (error) {
      console.error("Error repaying corn:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body">
        <div className="w-full flex justify-between">
          <h2 className="card-title">Mint Operations</h2>
        </div>

        <div className="form-control">
          <label className="label flex justify-between">
            <span className="label-text">Mint MyUSD</span>{" "}
            {address && (
              <RatioChange
                user={address}
                ethPrice={Number(formatEther(ethPrice || 0n))}
                inputMintAmount={Number(mintAmount)}
              />
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="input input-bordered w-full"
              value={mintAmount}
              onChange={e => setMintAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleMint} disabled={!mintAmount}>
              Mint
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Repay Debt</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="input input-bordered w-full"
              value={burnAmount}
              onChange={e => setBurnAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleBurn} disabled={!burnAmount}>
              Repay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MintOperations;
