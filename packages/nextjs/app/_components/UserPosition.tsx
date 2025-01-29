import React from "react";
import { formatEther } from "viem";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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

  return (
    <tr key={user}>
      <td>
        <AddressBlock address={user} disableAddressLink format="short" size="sm" />
      </td>
      <td>{formatEther(userCollateral || 0n)} ETH</td>
      <td>{formatEther(userMinted || 0n)} MyUSD</td>
      <td>
        {calculatePositionRatio(
          Number(formatEther(userCollateral || 0n)),
          Number(formatEther(userMinted || 0n)),
          ethPrice,
        )}
        %
      </td>
    </tr>
  );
};

export default UserPosition;
