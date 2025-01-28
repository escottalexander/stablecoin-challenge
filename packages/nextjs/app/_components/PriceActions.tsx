import React from "react";
import { formatEther } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const PriceActions = () => {
  const { data: price } = useScaffoldReadContract({
    contractName: "StableCoinEngine",
    functionName: "s_pricePoint",
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "StableCoinEngine" });

  const renderPrice =
    price === undefined ? <div className="ml-1 skeleton w-20 h-4"></div> : formatEther(price);

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
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Adjust the price</h2>
        <div className="flex justify-center my-1">Stablecoin price: {renderPrice}</div>
        <div className="card-actions justify-between">
          <button className="btn btn-primary" onClick={() => handleClick(false)}>
            Decrease by 10%
          </button>
          <button className="btn btn-primary" onClick={() => handleClick(true)}>
            Increase by 10%
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceActions;
