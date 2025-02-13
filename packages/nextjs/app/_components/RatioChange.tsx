import React from "react";
import { formatEther } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { calculatePositionRatio, getRatioColorClass } from "~~/utils/helpers";

type UserPositionProps = {
  user: string;
  ethPrice: number;
  inputMintAmount: number;
};

const RatioChange = ({ user, ethPrice, inputMintAmount }: UserPositionProps) => {
  const { data: userCollateral } = useScaffoldReadContract({
    contractName: "BasicLending",
    functionName: "s_userCollateral",
    args: [user],
  });

  const { data: userMinted } = useScaffoldReadContract({
    contractName: "BasicLending",
    functionName: "s_userBorrowed",
    args: [user],
  });

  const mintedAmount = Number(formatEther(userMinted || 0n));
  const ratio =
    mintedAmount === 0
      ? "N/A"
      : calculatePositionRatio(Number(formatEther(userCollateral || 0n)), mintedAmount, ethPrice).toFixed(1);

  const newRatio = calculatePositionRatio(
    Number(formatEther(userCollateral || 0n)),
    mintedAmount + inputMintAmount,
    ethPrice,
  ).toFixed(1);

  if (inputMintAmount <= 0) {
    return null;
  }

  return (
    <div className="text-sm">
      {ratio === "N/A" ? (
        <span className="text-green-600">∞</span>
      ) : (
        <span className={`${getRatioColorClass(ratio)} mx-0`}>{ratio}%</span>
      )}{" "}
      → <span className={getRatioColorClass(newRatio)}>{newRatio}%</span>
    </div>
  );
};

export default RatioChange;
