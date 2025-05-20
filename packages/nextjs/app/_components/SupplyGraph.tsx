import React from "react";
import TooltipInfo from "./TooltipInfo";
import { useTheme } from "next-themes";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatEther } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { INITIAL_DEX_SUPPLY } from "~~/utils/constant";

const SupplyGraph = () => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const strokeColor = isDarkMode ? "#ffffff" : "#000000";
  const purpleColor = "#8884d8";
  const greenColor = "#82ca9d";

  const { data: debtSharesMintedEvents, isLoading: isDebtSharesMintedLoading } = useScaffoldEventHistory({
    contractName: "MyUSDEngine",
    eventName: "DebtSharesMinted",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: debtSharesBurnedEvents, isLoading: isDebtSharesBurnedLoading } = useScaffoldEventHistory({
    contractName: "MyUSDEngine",
    eventName: "DebtSharesBurned",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: stakedEvents, isLoading: isStakedLoading } = useScaffoldEventHistory({
    contractName: "MyUSDStaking",
    eventName: "Staked",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: withdrawnEvents, isLoading: isWithdrawnLoading } = useScaffoldEventHistory({
    contractName: "MyUSDStaking",
    eventName: "Withdrawn",
    fromBlock: 0n,
    watch: true,
    blockData: true,
    transactionData: false,
    receiptData: false,
  });

  const { data: swapEvents, isLoading: isSwapLoading } = useScaffoldEventHistory({
    contractName: "DEX",
    eventName: "Swap",
    fromBlock: 0n,
    watch: true,
    blockData: true,
  });

  const isLoading =
    isDebtSharesMintedLoading || isDebtSharesBurnedLoading || isStakedLoading || isWithdrawnLoading || isSwapLoading;

  const combinedEvents = [
    ...(debtSharesMintedEvents || []),
    ...(debtSharesBurnedEvents || []),
    ...(stakedEvents || []),
    ...(withdrawnEvents || []),
    ...(swapEvents || []),
  ];
  const sortedEvents = combinedEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber));

  type DataPoint = {
    blockNumber: number;
    circulatingSupply: number;
    stakedSupply: number;
  };

  const supplyData = sortedEvents.reduce<DataPoint[]>((acc, event, idx) => {
    const prevCirculatingSupply = acc[idx - 1]?.circulatingSupply || 0;
    const prevStakedSupply = acc[idx - 1]?.stakedSupply || 0;

    let minted = event.eventName === "DebtSharesMinted" ? Number(formatEther(event.args.amount || 0n)) : 0;
    const burned = event.eventName === "DebtSharesBurned" ? Number(formatEther(event.args.amount || 0n)) : 0;
    const staked = event.eventName === "Staked" ? Number(formatEther(event.args.amount || 0n)) : 0;
    const withdrawn = event.eventName === "Withdrawn" ? Number(formatEther(event.args.amount || 0n)) : 0;

    let dexSentMyUSDAmount = 0;
    let dexReceivedMyUSDAmount = 0;
    if (event.eventName === "Swap") {
      if (event.args?.inputToken === "0x0000000000000000000000000000000000000000") {
        dexSentMyUSDAmount = Number(formatEther(event.args.outputAmount || 0n));
      } else {
        dexReceivedMyUSDAmount = Number(formatEther(event.args.inputAmount || 0n));
      }
    }
    if (minted >= INITIAL_DEX_SUPPLY) {
      minted = 0;
    }

    const circulatingSupply =
      prevCirculatingSupply + minted - burned - staked + withdrawn + dexSentMyUSDAmount - dexReceivedMyUSDAmount;
    const stakedSupply = prevStakedSupply + staked - withdrawn;

    return [
      ...acc,
      {
        blockNumber: Number(event.blockNumber) || 0,
        circulatingSupply:
          circulatingSupply && Number.isFinite(circulatingSupply) ? circulatingSupply : prevCirculatingSupply,
        stakedSupply: stakedSupply && Number.isFinite(stakedSupply) ? stakedSupply : prevStakedSupply,
      },
    ];
  }, []);

  return (
    <div className="card bg-base-100 w-full shadow-xl indicator">
      <TooltipInfo
        top={3}
        right={3}
        infoText="This graph displays the circulating supply (purple) and staked supply (green) over time."
      />
      <div className="card-body h-96 w-full">
        <div className="flex justify-between items-center">
          <h2 className="card-title mb-0">Supply Graph</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center text-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart width={500} height={300} data={supplyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <YAxis
                tickFormatter={value => {
                  if (value > 1000000) {
                    return `${(value / 1000000).toFixed(2)}M`;
                  }
                  if (value > 1000) {
                    return `${(value / 1000).toFixed(2)}k`;
                  }
                  return value;
                }}
                label={{
                  value: "MyUSD Amount",
                  angle: -90,
                  position: "insideLeft",
                  fill: strokeColor,
                  dy: 50,
                }}
                tick={{ fill: strokeColor, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="circulatingSupply"
                name="Circulating"
                stackId="1"
                stroke={purpleColor}
                fill={purpleColor}
              />
              <Area
                type="monotone"
                dataKey="stakedSupply"
                name="Staked"
                stackId="1"
                stroke={greenColor}
                fill={greenColor}
              />
              <XAxis
                domain={["auto", "auto"]}
                dataKey="blockNumber"
                stroke={strokeColor}
                tick={false}
                label={{ value: "Time (Blocks)", position: "insideBottom", fill: strokeColor }}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ paddingBottom: 10 }}
                formatter={value => <span style={{ color: strokeColor }}>{value}</span>}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SupplyGraph;
