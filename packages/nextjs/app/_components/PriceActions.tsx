import React from "react";
import { formatEther } from "viem";
import { MinusIcon, PlusIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

const PriceActions = () => {
  const { data: price } = useScaffoldReadContract({
    contractName: "CornPriceOracle",
    functionName: "price",
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "CornPriceOracle" });

  const renderPrice =
    price === undefined ? <div className="ml-1 skeleton w-20 h-4"></div> : Number(formatEther(price)).toFixed(2);

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
        <span className="top-3 right-3 indicator-item">
          <div
            className="tooltip tooltip-info tooltip-left"
            data-tip="Use these controls to simulate 10% price changes reported by the oracle"
          >
            <QuestionMarkCircleIcon className="h-4 w-4" />
          </div>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm">Price Oracle</span>
        </div>
        <span className="flex items-center text-xs">
          1 ETH = {renderPrice} {tokenName}
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
