import React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatEther, zeroAddress } from "viem";
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
  const sortedEvents = combinedEvents.sort((a, b) => Number(a.blockData?.timestamp - b.blockData?.timestamp));

  const ratioData = sortedEvents.reduce((acc, event, idx) => {
    try {
      const collateralAdded = event.eventName === "CollateralAdded" ? BigInt(event.args.amount || 0) : 0n;
      const collateralWithdrawn = event.eventName === "CollateralWithdrawn" ? BigInt(event.args.amount || 0) : 0n;
      const price = event.args.price ? BigInt(event.args.price) : 0n;
      const debtAdded = event.eventName === "Transfer" ? getDebtFromTransferEvent(event) : 0n;

      const prevCollateral = acc[idx - 1]?.collateral || 0n;
      const prevDebt = acc[idx - 1]?.debt || 0n;

      const collateral =
        prevCollateral + (collateralAdded - collateralWithdrawn) * (price ? BigInt(formatEther(price)) : 0n);
      const debt = prevDebt + debtAdded;
      const ratio = Number(collateral || 1) / Number(debt || collateral || 1);

      return [
        ...acc,
        {
          name: event.blockData?.number || 0,
          ratio: Number.isFinite(ratio) ? ratio : 1,
          collateral: collateral,
          debt: debt,
        },
      ];
    } catch (error) {
      console.error("Error processing event:", error);
      return acc;
    }
  }, []);

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body h-96 w-96">
        <h2 className="card-title">System Collateral Ratio</h2>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart width={500} height={300} data={ratioData}>
            <XAxis
              domain={["auto", "auto"]}
              dataKey="name"
              stroke="#ffffff"
              tick={false}
              label={{ value: "Time", position: "insideBottom", fill: "#ffffff" }}
            />
            <YAxis
              domain={[0, 6]}
              tickFormatter={value => `${(value * 100).toFixed(0)}%`}
              stroke="#ffffff"
              tick={{ fill: "#ffffff" }}
            />
            <Tooltip />
            <Line type="monotone" dataKey="ratio" stroke="#82ca9d" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CollateralGraph;
