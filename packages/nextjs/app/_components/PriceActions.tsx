import React from "react";
import TooltipInfo from "./TooltipInfo";
import { formatEther } from "viem";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

const PriceActions = () => {
  const { data: price } = useScaffoldReadContract({
    contractName: "CornPriceOracle",
    functionName: "price",
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "CornPriceOracle" });

  const renderPrice =
    price === undefined ? <div className="mr-1 skeleton w-10 h-4"></div> : Number(formatEther(price)).toFixed(2);

  const handleClick = async (isIncrease: boolean) => {
    if (price === undefined) {
      console.error("Price is undefined");
      return;
    }
    const newPrice = isIncrease ? (price * 110n) / 100n : (price * 90n) / 100n;

    try {
      await writeContractAsync({
        functionName: "updatePrice",
        args: [newPrice],
      });
    } catch (e) {
      console.error("Error setting the price:", e);
    }
  };

  return (
    <div className="absolute mt-10 right-5 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl">
      <div className="w-[150px] py-5 flex flex-col items-center gap-2 indicator">
        <TooltipInfo
          top={3}
          right={3}
          infoText="Use these controls to simulate 10% price changes reported by the oracle"
        />
        <div className="flex items-center gap-1">
          <span className="text-sm">Price Oracle</span>
        </div>
        <span className="flex items-center text-xs">
          {renderPrice} {tokenName} / ETH
        </span>
        <div className="flex gap-2">
          <button onClick={() => handleClick(false)} className="btn btn-circle btn-xs">
            <MinusIcon className="h-3 w-3" />
          </button>
          <button onClick={() => handleClick(true)} className="btn btn-circle btn-xs">
            <PlusIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceActions;
