import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { zeroAddress } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const getDebtFromTransferEvent = (event: any) => {
  try {
    const amount = BigInt(event.args.value || 0);
    if (event.args.to === zeroAddress) return amount * -1n;
    if (event.args.from === zeroAddress) return amount;
    return 0n;
  } catch (error) {
    console.error("Error in getDebtFromTransferEvent:", error);
    return 0n;
  }
};

const CollateralGraph = () => {
  const { data: addEvents } = useScaffoldEventHistory({
    contractName: "StableCoinEngine",
    eventName: "CollateralAdded",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: true,
    receiptData: true,
  });

  const { data: withdrawEvents } = useScaffoldEventHistory({
    contractName: "StableCoinEngine",
    eventName: "CollateralWithdrawn",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: true,
    receiptData: true,
  });

  const { data: transferEvents } = useScaffoldEventHistory({
    contractName: "StableCoin",
    eventName: "Transfer",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: true,
    receiptData: true,
  });

  const combinedEvents = [...(addEvents || []), ...(withdrawEvents || []), ...(transferEvents || [])];
  const sortedEvents = combinedEvents.sort((a, b) => Number((a as any).blockNumber - (b as any).blockNumber));

  const ratioData = sortedEvents.reduce<Array<{ name: number; ratio: number; collateral: bigint; debt: bigint }>>(
    (acc, event) => {
      try {
        const collateralAdded = event.eventName === "CollateralAdded" ? BigInt(event.args.amount || 0) : 0n;
        const collateralWithdrawn = event.eventName === "CollateralWithdrawn" ? BigInt(event.args.amount || 0) : 0n;
        const price =
          event.eventName === "CollateralAdded" || event.eventName === "CollateralWithdrawn"
            ? BigInt(event.args.price || 0)
            : 0n;
        const debtAdded = event.eventName === "Transfer" ? getDebtFromTransferEvent(event) : 0n;

        const prevCollateral = acc[acc.length - 1]?.collateral || 0n;
        const prevDebt = acc[acc.length - 1]?.debt || 0n;

        const collateral = prevCollateral + (collateralAdded - collateralWithdrawn) * (price ? price : 0n);
        const debt = prevDebt + debtAdded;

        // Avoid division by zero and ensure proper number conversion
        const ratio = debt === 0n ? (collateral === 0n ? 1 : Number(collateral)) : Number(collateral) / Number(debt);

        return [
          ...acc,
          {
            name: (event as any).blockNumber || 0,
            ratio: Number.isFinite(ratio) ? ratio : 1,
            collateral: collateral,
            debt: debt,
          },
        ];
      } catch (error) {
        console.error("Error processing event:", error);
        return acc;
      }
    },
    [],
  );

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body h-96 w-96">
        <h2 className="card-title">System Collateral Ratio</h2>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart width={500} height={300} data={ratioData}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={value => `${(value * 100).toFixed(0)}%`} />
            <Tooltip />
            <Line type="monotone" dataKey="ratio" stroke="#82ca9d" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CollateralGraph;
