import React from "react";
import { formatEther } from "viem";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { calculatePositionRatio, getRatioColorClass } from "~~/utils/helpers";

type UserPositionProps = {
  user: string;
  ethPrice: number;
};

const UserPosition = ({ user, ethPrice }: UserPositionProps) => {
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

  const { data: engineContract } = useDeployedContractInfo({
    contractName: "StableCoinEngine",
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "StableCoin",
    functionName: "allowance",
    args: [user, engineContract?.address],
  });

  const { writeContractAsync: writeEngineContract, isPending: isLiquidating } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });
  const { writeContractAsync: writeStableContract } = useScaffoldWriteContract({
    contractName: "StableCoin",
  });

  const mintedAmount = Number(formatEther(userMinted || 0n));
  const ratio =
    mintedAmount === 0
      ? "N/A"
      : calculatePositionRatio(Number(formatEther(userCollateral || 0n)), mintedAmount, ethPrice).toFixed(1);

  const isPositionSafe = ratio == "N/A" || Number(ratio) >= 150;
  const liquidatePosition = async () => {
    if (allowance === undefined || userMinted === undefined || engineContract === undefined) return;
    try {
      if (allowance < userMinted) {
        await writeStableContract({
          functionName: "approve",
          args: [engineContract?.address, userMinted],
        });
      }
      await writeEngineContract({
        functionName: "liquidate",
        args: [user],
      });
    } catch (e) {
      console.error("Error liquidating position:", e);
    }
  };

  return (
    <tr key={user}>
      <td>
        <AddressBlock address={user} disableAddressLink format="short" size="sm" />
      </td>
      <td>{Number(formatEther(userCollateral || 0n)).toFixed(2)} ETH</td>
      <td>{Number(formatEther(userMinted || 0n)).toFixed(2)} MyUSD</td>
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
