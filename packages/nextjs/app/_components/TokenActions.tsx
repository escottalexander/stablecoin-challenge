import React from "react";
import { TokenSwapModal } from "./Modals/TokenSwapModal";
import { TokenTransferModal } from "./Modals/TokenTransferModal";
import TooltipInfo from "./TooltipInfo";
import { formatEther } from "viem";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { ArrowsRightLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

const TokenActions = () => {
  const { address, chain: ConnectedChain } = useAccount();
  const transferModalId = `${tokenName}-transfer-modal`;
  const swapModalId = `${tokenName}-swap-modal`;

  const { data: stablecoinBalance } = useScaffoldReadContract({
    contractName: "MyUSD",
    functionName: "balanceOf",
    args: [address],
  });

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "getPrice",
  });

  const myUSDPrice = 1 / (Number(formatEther(ethPrice || 0n)) / 1800);

  const tokenBalance = `${Math.floor(Number(formatEther(stablecoinBalance || 0n)) * 100) / 100}`;

  return (
    <div className="absolute mt-10 right-5 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl z-10">
      <div className="w-[150px] py-5 flex flex-col items-center gap-1 indicator">
        <TooltipInfo top={3} right={3} infoText={`Here you can set the savings rate and borrow rate`} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold">{tokenName} Wallet</span>
          <span className="text-sm">
            {tokenBalance} {tokenName}
          </span>
          <span className="flex items-center text-xs">
            1 {tokenName} = ${myUSDPrice.toFixed(5)}
          </span>
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
      <TokenTransferModal tokenBalance={tokenBalance} connectedAddress={address || ""} modalId={`${transferModalId}`} />
      <TokenSwapModal
        tokenBalance={tokenBalance}
        connectedAddress={address || ""}
        ETHprice={Number(formatEther(ethPrice || 0n)).toFixed(2)}
        modalId={`${swapModalId}`}
      />
    </div>
  );
};

export default TokenActions;
