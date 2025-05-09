import React from "react";
import TooltipInfo from "./TooltipInfo";
import { useTheme } from "next-themes";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
    transactionData: true,
    receiptData: true,
  });

  const priceEventsArray = priceEvents
    ?.map(event => {
      return {
        blockNumber: event.blockNumber,
        price: 1 / (Number(formatEther(event.args.price || 0n)) / 1800),
      };
    })
    .reverse();

  return (
    <div className="card bg-base-100 w-full shadow-xl indicator">
      <TooltipInfo top={3} right={3} infoText="This graph shows the price of the stabletoken over time" />
      <div className="card-body h-96 w-full">
        <h2 className="card-title">Price Graph</h2>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart width={500} height={300} data={priceEventsArray}>
            <XAxis
              domain={["auto", "auto"]}
              dataKey="blockNumber"
              stroke={strokeColor}
              tick={false}
              label={{ value: "Time", position: "insideBottom", fill: strokeColor }}
            />
            <YAxis
              scale="linear"
              domain={[(dataMin: number) => dataMin - 0.0001, (dataMax: number) => dataMax + 0.0001]}
              stroke={strokeColor}
              tick={{ fill: strokeColor }}
            />
            <Tooltip />
            <ReferenceLine y={1.0} stroke="#ff4d4d" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="price" stroke="#82ca9d" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PriceGraph;
