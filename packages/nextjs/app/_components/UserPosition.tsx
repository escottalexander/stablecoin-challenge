import React from "react";
import { formatEther } from "viem";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";
import { calculatePositionRatio, getRatioColorClass } from "~~/utils/helpers";

type UserPositionProps = {
  user: string;
  ethPrice: number;
  connectedAddress: string;
};

const UserPosition = ({ user, ethPrice, connectedAddress }: UserPositionProps) => {
  const { data: userCollateral } = useScaffoldReadContract({
    contractName: "BasicLending",
    functionName: "s_userCollateral",
    args: [user],
  });

  const { data: userBorrowed } = useScaffoldReadContract({
    contractName: "BasicLending",
    functionName: "s_userBorrowed",
    args: [user],
  });

  const { data: basicLendingContract } = useDeployedContractInfo({
    contractName: "BasicLending",
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "Corn",
    functionName: "allowance",
    args: [user, basicLendingContract?.address],
  });

  const { writeContractAsync: writeBasicLendingContract, isPending: isLiquidating } = useScaffoldWriteContract({
    contractName: "BasicLending",
  });
  const { writeContractAsync: writeCornContract } = useScaffoldWriteContract({
    contractName: "Corn",
  });

  const mintedAmount = Number(formatEther(userBorrowed || 0n));
  const ratio =
    mintedAmount === 0
      ? "N/A"
      : calculatePositionRatio(Number(formatEther(userCollateral || 0n)), mintedAmount, ethPrice).toFixed(1);

  const isPositionSafe = ratio == "N/A" || Number(ratio) >= 150;
  const liquidatePosition = async () => {
    if (allowance === undefined || userBorrowed === undefined || basicLendingContract === undefined) return;
    try {
      if (allowance < userBorrowed) {
        await writeCornContract({
          functionName: "approve",
          args: [basicLendingContract?.address, userBorrowed],
        });
      }
      await writeBasicLendingContract({
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
