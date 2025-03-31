import React from "react";
import { formatEther } from "viem";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { collateralRatio, tokenName } from "~~/utils/constant";
import { calculatePositionRatio, getRatioColorClass } from "~~/utils/helpers";

type UserPositionProps = {
  user: string;
  ethPrice: number;
  connectedAddress: string;
};

const UserPosition = ({ user, ethPrice, connectedAddress }: UserPositionProps) => {
  const { data: userCollateral } = useScaffoldReadContract({
    contractName: "StablecoinEngine",
    functionName: "s_userCollateral",
    args: [user],
  });

  const { data: userBorrowed } = useScaffoldReadContract({
    contractName: "StablecoinEngine",
    functionName: "s_userBorrowed",
    args: [user],
  });

  const { data: stablecoinEngineContract } = useDeployedContractInfo({
    contractName: "StablecoinEngine",
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "Stablecoin",
    functionName: "allowance",
    args: [user, stablecoinEngineContract?.address],
  });

  const { writeContractAsync: writeStablecoinEngineContract, isPending: isLiquidating } = useScaffoldWriteContract({
    contractName: "StablecoinEngine",
  });
  const { writeContractAsync: writeStablecoinContract } = useScaffoldWriteContract({
    contractName: "Stablecoin",
  });

  const borrowedAmount = Number(formatEther(userBorrowed || 0n));
  const ratio =
    borrowedAmount === 0
      ? "N/A"
      : calculatePositionRatio(Number(formatEther(userCollateral || 0n)), borrowedAmount, ethPrice).toFixed(1);

  const isPositionSafe = ratio == "N/A" || Number(ratio) >= collateralRatio;
  const liquidatePosition = async () => {
    if (allowance === undefined || userBorrowed === undefined || stablecoinEngineContract === undefined) return;
    try {
      if (allowance < userBorrowed) {
        await writeStablecoinContract({
          functionName: "approve",
          args: [stablecoinEngineContract?.address, userBorrowed],
        });
      }
      await writeStablecoinEngineContract({
        functionName: "liquidate",
        args: [user],
      });
    } catch (e) {
      console.error("Error liquidating position:", e);
    }
  };

  return (
    <tr key={user} className={`${connectedAddress === user ? "bg-blue-100 dark:bg-blue-900" : ""}`}>
      <td>
        <AddressBlock address={user} disableAddressLink format="short" size="sm" />
      </td>
      <td>{Number(formatEther(userCollateral || 0n)).toFixed(2)} ETH</td>
      <td>
        {Number(formatEther(userBorrowed || 0n)).toFixed(2)} {tokenName}
      </td>
      <td className={getRatioColorClass(ratio)}>{ratio === "N/A" ? "N/A" : `${ratio}%`}</td>
      <td className="flex justify-center">
        <button onClick={liquidatePosition} disabled={isPositionSafe} className="btn btn-sm btn-ghost">
          {isLiquidating ? <span className="loading loading-spinner loading-sm"></span> : "Liquidate"}
        </button>
      </td>
    </tr>
  );
};

export default UserPosition;
