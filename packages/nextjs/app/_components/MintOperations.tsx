import React, { useState } from "react";
import RatioChange from "./RatioChange";
import TooltipInfo from "./TooltipInfo";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

const MintOperations = () => {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");

  const { address } = useAccount();

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "getPrice",
  });

  const { writeContractAsync: writeStablecoinEngineContract } = useScaffoldWriteContract({
    contractName: "MyUSDEngine",
  });

  const handleMint = async () => {
    try {
      await writeStablecoinEngineContract({
        functionName: "mintStableCoin",
        args: [mintAmount ? parseEther(mintAmount) : 0n],
      });
      setMintAmount("");
    } catch (error) {
      console.error("Error minting MyUSD:", error);
    }
  };

  const handleBurn = async () => {
    try {
      await writeStablecoinEngineContract({
        functionName: "burnStableCoin",
        args: [burnAmount ? parseEther(burnAmount) : 0n],
      });
      setBurnAmount("");
    } catch (error) {
      console.error("Error burning MyUSD:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl indicator">
      <TooltipInfo
        top={3}
        right={3}
        infoText={`Use these controls to mint and burn ${tokenName} from the MyUSDEngine pool`}
      />
      <div className="card-body">
        <div className="w-full flex justify-between">
          <h2 className="card-title">Mint Operations</h2>
        </div>

        <div className="form-control">
          <label className="label flex justify-between">
            <span className="label-text">Mint {tokenName}</span>{" "}
            {address && (
              <RatioChange
                user={address}
                ethPrice={Number(formatEther(ethPrice || 0n))}
                inputAmount={Number(mintAmount)}
              />
            )}
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput value={mintAmount} onChange={setMintAmount} placeholder="Amount" disableMultiplyBy1e18 />
            <button className="btn btn-sm btn-primary" onClick={handleMint} disabled={!mintAmount}>
              Mint
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label flex justify-between">
            <span className="label-text">Burn Debt</span>
            {address && (
              <RatioChange
                user={address}
                ethPrice={Number(formatEther(ethPrice || 0n))}
                inputAmount={-Number(burnAmount)}
              />
            )}
          </label>
          <div className="flex gap-2 items-center">
            <IntegerInput value={burnAmount} onChange={setBurnAmount} placeholder="Amount" disableMultiplyBy1e18 />
            <button className="btn btn-sm btn-primary" onClick={handleBurn} disabled={!burnAmount}>
              Burn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MintOperations;
