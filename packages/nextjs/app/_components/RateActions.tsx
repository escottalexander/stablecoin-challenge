import React, { useState } from "react";
import TooltipInfo from "./TooltipInfo";
import { formatEther, parseEther } from "viem";
import { CheckIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const RateActions = () => {
  const [newBorrowRate, setNewBorrowRate] = useState<string>("0");
  const [newSavingsRate, setNewSavingsRate] = useState<string>("0");
  const [isEditingBR, setIsEditingBR] = useState<boolean>(false);
  const [isEditingSR, setIsEditingSR] = useState<boolean>(false);
  const { data: savingsRate } = useScaffoldReadContract({
    contractName: "MyUSDStaking",
    functionName: "savingsRate",
  });

  const { data: borrowRate } = useScaffoldReadContract({
    contractName: "MyUSDEngine",
    functionName: "borrowRate",
  });

  const { writeContractAsync: writeStakingContractAsync } = useScaffoldWriteContract({
    contractName: "MyUSDStaking",
  });

  const { writeContractAsync: writeEngineContractAsync } = useScaffoldWriteContract({
    contractName: "MyUSDEngine",
  });

  return (
    <div className="absolute mt-10 right-5 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl">
      <div className="w-[150px] py-5 flex flex-col items-center gap-2 indicator">
        <TooltipInfo top={3} right={3} infoText="This shows the price of the stablecoin" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold">Savings Rate</span>
          {isEditingSR ? (
            <div className="flex items-center gap-1 px-2">
              <IntegerInput value={newSavingsRate} onChange={setNewSavingsRate} disableMultiplyBy1e18 />
              <label
                className="btn btn-circle btn-xs"
                onClick={async () => {
                  await writeStakingContractAsync({
                    functionName: "setSavingsRate",
                    args: [parseEther(newSavingsRate)],
                  });
                  setIsEditingSR(false);
                }}
              >
                <CheckIcon className="h-3 w-3" />
              </label>

              <label className="btn btn-circle btn-xs" onClick={() => setIsEditingSR(false)}>
                <XMarkIcon className="h-3 w-3" />
              </label>
            </div>
          ) : (
            <span className="flex items-center text-xs">
              <span className="text-xs">{formatEther(savingsRate || 0n)}</span>
              <label className="btn btn-circle btn-xs" onClick={() => setIsEditingSR(true)}>
                <PencilIcon className="h-3 w-3" />
              </label>
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold">Borrow Rate</span>
          {isEditingBR ? (
            <div className="flex items-center gap-1 px-2">
              <IntegerInput value={newBorrowRate} onChange={setNewBorrowRate} disableMultiplyBy1e18 />

              <label
                className="btn btn-circle btn-xs"
                onClick={async () => {
                  await writeEngineContractAsync({
                    functionName: "setBorrowRate",
                    args: [parseEther(newBorrowRate)],
                  });
                  setIsEditingBR(false);
                }}
              >
                <CheckIcon className="h-3 w-3" />
              </label>

              <label
                className="btn btn-circle btn-xs"
                onClick={() => {
                  setIsEditingBR(false);
                }}
              >
                <XMarkIcon className="h-3 w-3" />
              </label>
            </div>
          ) : (
            <span className="flex items-center gap-1">
              <span className="text-xs">{formatEther(borrowRate || 0n)}</span>
              <label className="btn btn-circle btn-xs" onClick={() => setIsEditingBR(true)}>
                <PencilIcon className="h-3 w-3" />
              </label>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RateActions;
