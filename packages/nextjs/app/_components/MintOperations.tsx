import React, { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MintOperations = () => {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");

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
            <span className="label-text">Burn MyUSD</span>
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
              Burn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MintOperations;
