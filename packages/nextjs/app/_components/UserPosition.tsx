import React from "react";
import { formatEther } from "viem";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

function getRatioColorClass(ratio: number): string {
  if (ratio < 150) return "text-red-600";
  if (ratio < 200) return "text-yellow-600";
  return "text-green-600";
}

function calculatePositionRatio(userCollateral: number, mintedAmount: number, ethPrice: number): number {
  const collateralValue = userCollateral * ethPrice;
  if (mintedAmount === 0) return Number.MAX_SAFE_INTEGER; // Return max if no stablecoins are minted
  return (collateralValue / mintedAmount) * 100; // Calculate position ratio
}

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
  console.log({ allowance });

  const { writeContractAsync: writeEngineContract, isPending: isLiquidating } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });
  const { writeContractAsync: writeStableContract, isPending: isApproving } = useScaffoldWriteContract({
    contractName: "StableCoin",
  });

  const ratio = calculatePositionRatio(
    Number(formatEther(userCollateral || 0n)),
    Number(formatEther(userMinted || 0n)),
    ethPrice,
  );

  const isPositionSafe = ratio >= 150;
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
      <td className={getRatioColorClass(ratio)}>{ratio.toFixed(1)}%</td>
      <td className="flex justify-center">
        <button onClick={liquidatePosition} disabled={isPositionSafe} className="btn btn-ghost">
          {isLiquidating ? <span className="loading loading-spinner loading-sm"></span> : "Liquidate"}
        </button>
      </td>
    </tr>
  );
};

export default UserPosition;
