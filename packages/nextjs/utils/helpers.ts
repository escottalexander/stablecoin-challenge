export function getRatioColorClass(ratio: number | string): string {
  if (ratio === "N/A") return "";
  if (Number(ratio) < 150) return "text-red-600";
  if (Number(ratio) < 200) return "text-yellow-600";
  return "text-green-600";
}

export function calculatePositionRatio(userCollateral: number, mintedAmount: number, ethPrice: number): number {
  const collateralValue = userCollateral * ethPrice;
  if (mintedAmount === 0) return Number.MAX_SAFE_INTEGER; // Return max if no stablecoins are minted
  return (collateralValue / mintedAmount) * 100; // Calculate position ratio
}
