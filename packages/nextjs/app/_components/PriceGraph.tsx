import React from "react";
import TooltipInfo from "./TooltipInfo";
import { useTheme } from "next-themes";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatEther } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const PriceGraph = () => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const strokeColor = isDarkMode ? "#ffffff" : "#000000";

  const { data: priceEvents } = useScaffoldEventHistory({
    contractName: "DEX",
    eventName: "PriceUpdated",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: borrowRateUpdatedEvents } = useScaffoldEventHistory({
    contractName: "MyUSDEngine",
    eventName: "BorrowRateUpdated",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: savingsRateUpdatedEvents } = useScaffoldEventHistory({
    contractName: "MyUSDStaking",
    eventName: "SavingsRateUpdated",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const combinedEvents = [
    ...(priceEvents || []),
    ...(borrowRateUpdatedEvents || []),
    ...(savingsRateUpdatedEvents || []),
  ];
  const sortedEvents = combinedEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber));

  type DataPoint = {
    blockNumber: number;
    price: number;
    borrowRate: number;
    savingsRate: number;
  };

  const priceData = sortedEvents.reduce<DataPoint[]>((acc, event, idx) => {
    const price = event.eventName === "PriceUpdated" ? 1 / (Number(formatEther(event.args.price || 0n)) / 1800) : 0;
    const borrowRate = event.eventName === "BorrowRateUpdated" ? Number(event.args.newRate || 0n) / 100 : 0;
    const savingsRate = event.eventName === "SavingsRateUpdated" ? Number(event.args.newRate || 0n) / 100 : 0;

    const prevPrice = acc[idx - 1]?.price || 1;
    const prevBorrowRate = acc[idx - 1]?.borrowRate || 0;
    const prevSavingsRate = acc[idx - 1]?.savingsRate || 0;

    return [
      ...acc,
      {
        blockNumber: Number(event.blockNumber) || 0,
        price: price && Number.isFinite(price) ? price : prevPrice,
        borrowRate: borrowRate && Number.isFinite(borrowRate) ? borrowRate : prevBorrowRate,
        savingsRate: savingsRate && Number.isFinite(savingsRate) ? savingsRate : prevSavingsRate,
      },
    ];
  }, []);

  const priceInitial = [{ blockNumber: 0, price: 1, savingsRate: 0, borrowRate: 0 }];

  return (
    <div className="card bg-base-100 w-full shadow-xl indicator">
      <TooltipInfo top={3} right={3} infoText="This graph shows the price of the stabletoken over time" />
      <div className="card-body h-96 w-full">
        <h2 className="card-title">Price Graph</h2>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart width={500} height={300} data={priceData.length > 0 ? priceData : priceInitial}>
            <XAxis
              domain={["auto", "auto"]}
              dataKey="blockNumber"
              stroke={strokeColor}
              tick={false}
              label={{ value: "Time (Blocks)", position: "insideBottom", fill: strokeColor }}
            />
            <YAxis
              yAxisId="left"
              scale="linear"
              domain={[(dataMin: number) => dataMin - 0.0001, (dataMax: number) => dataMax + 0.0001]}
              stroke="#ebc034"
              tick={{ fill: "#ebc034", fontSize: 12 }}
              label={{ value: "Price", angle: -90, position: "insideLeft", fill: "#ebc034" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              scale="linear"
              domain={[(dataMin: number) => dataMin - 0.0001, (dataMax: number) => dataMax + 0.0001]}
              stroke="#e33030"
              tick={{ fill: "#e33030", fontSize: 12 }}
              label={{ value: "Rates (%)", angle: 90, position: "insideRight", fill: "#e33030" }}
            />
            <Line yAxisId="left" type="monotone" dataKey="price" stroke="#ebc034" dot={false} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="borrowRate" stroke="#e33030" dot={false} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="savingsRate" stroke="#25cf0e" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PriceGraph;
