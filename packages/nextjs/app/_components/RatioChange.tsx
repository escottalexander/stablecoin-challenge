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
  if (inputMintAmount <= 0) {
    return null;
  }
  const { data: userCollateral } = useScaffoldReadContract({
    contractName: "StableCoinEngine",
    functionName: "s_userCollateral",
    args: [user],
  });

  const { data: userMinted } = useScaffoldReadContract({
    contractName: "StableCoinEngine",
    functionName: "s_userMinted",
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
