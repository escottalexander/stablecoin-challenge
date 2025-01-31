import React, { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MintOperations = () => {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const { address } = useAccount();

  const { data: stableCoinBalance } = useScaffoldReadContract({
    contractName: "StableCoin",
    functionName: "balanceOf",
    args: [address],
  });

  const { data: userMinted } = useScaffoldReadContract({
    contractName: "StableCoinEngine",
    functionName: "s_userMinted",
    args: [address],
  });

  const { writeContractAsync: mintStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const { writeContractAsync: burnStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const handleMint = async () => {
    try {
      await mintStableCoin({
        functionName: "mintStableCoin",
        args: [mintAmount ? parseEther(mintAmount) : 0n],
      });
      setMintAmount("");
    } catch (error) {
      console.error("Error minting stablecoins:", error);
    }
  };

  const handleBurn = async () => {
    try {
      await burnStableCoin({
        functionName: "burnStableCoin",
        args: [burnAmount ? parseEther(burnAmount) : 0n],
      });
      setBurnAmount("");
    } catch (error) {
      console.error("Error burning stablecoins:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Mint Operations</h2>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Mint MyUSD</span>
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
        <div className="divider"></div>
        <div className="w-full">
          <div className="stat-title">
            MyUSD Balance: <span className="font-bold">{formatEther(stableCoinBalance || 0n).slice(0, 8)}</span>
          </div>
          <div className="stat-title">Outstanding Debt: {formatEther(userMinted || 0n).slice(0, 8)}</div>
        </div>
      </div>
    </div>
  );
};

export default MintOperations;
