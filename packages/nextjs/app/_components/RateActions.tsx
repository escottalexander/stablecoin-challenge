import React, { useCallback, useState } from "react";
import TooltipInfo from "./TooltipInfo";
import { CheckIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface RateInputProps {
  label: string;
  value: bigint | undefined;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
  newValue: string;
  onNewValueChange: (value: string) => void;
}

const RateInput: React.FC<RateInputProps> = ({
  label,
  value,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  newValue,
  onNewValueChange,
}) => {
  const formattedValue = Number(value || 0n) / 100;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-bold">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1 px-4">
          <div className="max-h-8">
            <IntegerInput value={newValue} onChange={onNewValueChange} disableMultiplyBy1e18 />
          </div>
          <label className="btn btn-circle btn-xs" onClick={() => onSave(newValue)}>
            <CheckIcon className="h-3 w-3" />
          </label>
          <label className="btn btn-circle btn-xs" onClick={onCancel}>
            <XMarkIcon className="h-3 w-3" />
          </label>
        </div>
      ) : (
        <span className="flex items-center text-xs">
          <span className="text-xs">{formattedValue}%</span>
          <label className="btn btn-circle btn-xs" onClick={onEdit}>
            <PencilIcon className="h-3 w-3" />
          </label>
        </span>
      )}
    </div>
  );
};

const RateActions: React.FC = () => {
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

  const handleSaveSavingsRate = useCallback(
    async (value: string) => {
      console.log(value);
      try {
        await writeStakingContractAsync({
          functionName: "setSavingsRate",
          args: [BigInt(Number(value) * 100)],
        });
        setIsEditingSR(false);
      } catch (error) {
        console.error("Failed to update savings rate:", error);
      }
    },
    [writeStakingContractAsync],
  );

  const handleSaveBorrowRate = useCallback(
    async (value: string) => {
      try {
        await writeEngineContractAsync({
          functionName: "setBorrowRate",
          args: [BigInt(Number(value) * 100)],
        });
        setIsEditingBR(false);
      } catch (error) {
        console.error("Failed to update borrow rate:", error);
      }
    },
    [writeEngineContractAsync],
  );

  return (
    <div className="absolute mt-14 right-5 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl z-10">
      <div className="w-[150px] py-5 flex flex-col items-center gap-2 indicator">
        <TooltipInfo top={3} right={3} infoText="Set the borrow rate and savings rate for the engine in %" />

        <RateInput
          label="Borrow Rate"
          value={borrowRate}
          isEditing={isEditingBR}
          onEdit={() => setIsEditingBR(true)}
          onCancel={() => setIsEditingBR(false)}
          onSave={handleSaveBorrowRate}
          newValue={newBorrowRate}
          onNewValueChange={setNewBorrowRate}
        />

        <RateInput
          label="Savings Rate"
          value={savingsRate}
          isEditing={isEditingSR}
          onEdit={() => setIsEditingSR(true)}
          onCancel={() => setIsEditingSR(false)}
          onSave={handleSaveSavingsRate}
          newValue={newSavingsRate}
          onNewValueChange={setNewSavingsRate}
        />
      </div>
    </div>
  );
};

export default RateActions;
