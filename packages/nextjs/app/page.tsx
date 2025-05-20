"use client";

import PriceGraph from "./_components/PriceGraph";
import RateControls from "./_components/RateControls";
import SideButtons from "./_components/SideButtons";
import SupplyGraph from "./_components/SupplyGraph";
import TokenActions from "./_components/TokenActions";
import UserPositionsTable from "./_components/UserPositionsTable";
import type { NextPage } from "next";
import StakersStable from "./_components/StakersTable";
const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10 pb-16">
        <div className="px-5 w-full">
          <div className="relative flex justify-center items-center mb-8">
            <h1 className="text-2xl">Stablecoin Challenge</h1>
            <TokenActions />
            <SideButtons />
          </div>
          <div className="flex w-full max-w-7xl px-[120px] mx-auto flex-col gap-8">
            <RateControls />
            <div className="flex w-full gap-8 justify-center">
              <div className="flex flex-col gap-8 w-3/5">
                <PriceGraph />
                <UserPositionsTable />
              </div>
              <div className="flex flex-col gap-8 w-2/5">
                <SupplyGraph />
                <StakersStable />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
