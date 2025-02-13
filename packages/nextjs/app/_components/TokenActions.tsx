import React from "react";
import { TokenSwapModal } from "./Modals/TokenSwapModal";
import { TokenTransferModal } from "./Modals/TokenTransferModal";
import { formatEther } from "viem";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { ArrowsRightLeftIcon, PaperAirplaneIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const TokenActions = () => {
  const { address, chain: ConnectedChain } = useAccount();
  const transferModalId = "myusd-transfer-modal";
  const swapModalId = "myusd-swap-modal";

  const { data: cornBalance } = useScaffoldReadContract({
    contractName: "Corn",
    functionName: "balanceOf",
    args: [address],
  });

  const { data: Cornprice } = useScaffoldReadContract({
    contractName: "CornPriceOracle",
    functionName: "price",
  });

  const myUSDBalance = formatEther(cornBalance || 0n);

  return (
    <div className="absolute mt-3 top-[100px] right-5 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl">
      <div className="w-[150px] py-5 flex flex-col items-center gap-1 indicator">
        <span className="top-3 right-3 indicator-item">
          <div
            className="tooltip tooltip-info tooltip-left"
            data-tip="Here you can send MyUSD to any address or swap it"
          >
            <QuestionMarkCircleIcon className="h-4 w-4" />
          </div>
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm">{myUSDBalance} MyUSD</span>
          <div className="flex gap-2">
            <label htmlFor={`${transferModalId}`} className="btn btn-circle btn-xs">
              <PaperAirplaneIcon className="h-3 w-3" />
            </label>
            {ConnectedChain?.id === hardhat.id && (
              <label htmlFor={`${swapModalId}`} className="btn btn-circle btn-xs">
                <ArrowsRightLeftIcon className="h-3 w-3" />
              </label>
            )}
          </div>
        </div>
      </div>
      <TokenTransferModal myUSDBalance={myUSDBalance} connectedAddress={address || ""} modalId={`${transferModalId}`} />
      <TokenSwapModal
        myUSDBalance={myUSDBalance}
        connectedAddress={address || ""}
        ETHprice={Number(formatEther(Cornprice || 0n)).toFixed(2)}
        modalId={`${swapModalId}`}
      />
    </div>
  );
};

export default TokenActions;
