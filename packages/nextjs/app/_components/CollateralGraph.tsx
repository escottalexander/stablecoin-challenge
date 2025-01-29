import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatEther, zeroAddress } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const getDebtFromTransferEvent = (event: any) => {
  const amount = event.args.value;
  if (event.args.to === zeroAddress) return amount * -1n;
  if (event.args.from === zeroAddress) return amount;
  return 0n;
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
    const collateralAdded = event.eventName === "CollateralAdded" ? event.args.amount : 0n;
    const collateralWithdrawn = event.eventName === "CollateralWithdrawn" ? event.args.amount : 0n;
    const price = event.args.price || 0n;
    const debtAdded = event.eventName === "Transfer" ? getDebtFromTransferEvent(event) : 0n;

    const prevCollateral = acc[idx - 1]?.collateral || 0n;
    const prevDebt = acc[idx - 1]?.debt || 0n;

    const collateral = prevCollateral + (collateralAdded - collateralWithdrawn) * BigInt(formatEther(price));
    const debt = prevDebt + debtAdded;
    const ratio = Number(collateral) / Number(debt || collateral);
    return [...acc, { name: event.blockData?.number, ratio, collateral, debt }];
  }, []);

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
