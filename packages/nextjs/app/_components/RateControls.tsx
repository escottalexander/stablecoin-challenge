import React, { useCallback, useState } from "react";
import TooltipInfo from "./TooltipInfo";
import { CheckIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface RateInputProps {
  value: bigint | undefined;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
  newValue: string;
  onNewValueChange: (value: string) => void;
  label: string;
}

const RateInput: React.FC<RateInputProps> = ({
  value,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  newValue,
  onNewValueChange,
  label,
}) => {
  const formattedValue = Number(value || 0n) / 100;

  return (
    <div className="flex justify-center items-center gap-2 w-full h-10">
      <span className="label-text text-base whitespace-nowrap">{label}</span>

      {isEditing ? (
        <div className="flex gap-1 w-full items-center">
          <div className="w-3/5">
            <IntegerInput value={newValue} onChange={onNewValueChange} placeholder="Rate" disableMultiplyBy1e18 />
          </div>
          <div className="flex gap-1">
            <label className="btn btn-sm btn-circle" onClick={() => onSave(newValue)}>
              <CheckIcon className="h-3 w-3" />
            </label>
            <label className="btn btn-sm btn-circle" onClick={onCancel}>
              <XMarkIcon className="h-3 w-3" />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex w-full items-center">
          <span className="flex px-2 justify-end w-1/2 font-medium">{formattedValue.toFixed(2)}%</span>
          <button className="w-1/3 btn btn-sm" onClick={onEdit} aria-label="Edit rate">
            <PencilIcon className="h-3 w-3" /> Edit
          </button>
        </div>
      )}
    </div>
  );
};

const RateControls: React.FC = () => {
  const [newBorrowRate, setNewBorrowRate] = useState<string>("");
  const [newSavingsRate, setNewSavingsRate] = useState<string>("");
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

  const { writeContractAsync: writeRateControllerContractAsync } = useScaffoldWriteContract({
    contractName: "RateController",
  });

  const handleSaveSavingsRate = useCallback(
    async (value: string) => {
      console.log(value);
      try {
        await writeRateControllerContractAsync({
          functionName: "setSavingsRate",
          args: [BigInt(Math.round(Number(value) * 100))],
        });
        setIsEditingSR(false);
      } catch (error) {
        console.error("Failed to update savings rate:", error);
      }
    },
    [writeRateControllerContractAsync],
  );

  const handleSaveBorrowRate = useCallback(
    async (value: string) => {
      try {
        await writeRateControllerContractAsync({
          functionName: "setBorrowRate",
          args: [BigInt(Math.round(Number(value) * 100))],
        });
        setIsEditingBR(false);
      } catch (error) {
        console.error("Failed to update borrow rate:", error);
      }
    },
    [writeRateControllerContractAsync],
  );

  return (
    <div className="card bg-base-100 w-full shadow-xl indicator">
      <TooltipInfo top={3} right={3} infoText="Set the borrow rate and savings rate for the engine in %" />

      <div className="card-body p-5">
        <h2 className="card-title my-0">Rate Controls</h2>

        <div className="flex justify-between">
          <div className="flex w-1/2 items-center gap-2">
            <RateInput
              label="Borrow Rate"
              value={borrowRate}
              isEditing={isEditingBR}
              onEdit={() => setIsEditingBR(true)}
              onCancel={() => {
                setIsEditingBR(false);
                setNewBorrowRate("");
              }}
              onSave={handleSaveBorrowRate}
              newValue={newBorrowRate}
              onNewValueChange={setNewBorrowRate}
            />
          </div>

          <div className="flex w-1/2 items-center gap-2">
            <RateInput
              label="Savings Rate"
              value={savingsRate}
              isEditing={isEditingSR}
              onEdit={() => setIsEditingSR(true)}
              onCancel={() => {
                setIsEditingSR(false);
                setNewSavingsRate("");
              }}
              onSave={handleSaveSavingsRate}
              newValue={newSavingsRate}
              onNewValueChange={setNewSavingsRate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateControls;
