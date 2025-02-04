import React, { useState } from "react";
import RatioChange from "./RatioChange";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { AddressInput, IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MintOperations = () => {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [sendAmount, setSendAmount] = useState("");

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

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "EthPriceOracle",
    functionName: "price",
  });

  const { writeContractAsync: mintStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const { writeContractAsync: burnStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  const { writeContractAsync: sendStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoin",
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

  const handleSend = async () => {
    try {
      await sendStableCoin({
        functionName: "transfer",
        args: [addressInput, parseEther(sendAmount)],
      });
      setBurnAmount("");
    } catch (error) {
      console.error("Error sending stablecoins:", error);
    }
  };

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body">
        <div className="w-full flex justify-between">
          <h2 className="card-title">Mint Operations</h2>
          <div className="flex flex-col items-end text-sm">
            <div className="stat-title my-0">
              MyUSD Balance: <span className="font-bold">{formatEther(stableCoinBalance || 0n).slice(0, 8)}</span>
            </div>
            <div className="stat-title">
              Outstanding Debt: <span className="font-bold">{formatEther(userMinted || 0n).slice(0, 8)}</span>
            </div>
          </div>
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
        <div className="divider mb-0"></div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Send MyUSD</span>
          </label>
          <div className="flex flex-col gap-2">
            <AddressInput
              value={addressInput}
              placeholder="Send to"
              onChange={newValue => {
                setAddressInput(newValue);
              }}
            />
            <IntegerInput
              value={sendAmount}
              onChange={newValue => {
                setSendAmount(newValue);
              }}
              placeholder="Amount"
              disableMultiplyBy1e18
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={!sendAmount}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MintOperations;
