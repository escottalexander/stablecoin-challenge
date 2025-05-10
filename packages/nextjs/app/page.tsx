"use client";

import BorrowOperations from "./_components/BorrowOperations";
import CollateralOperations from "./_components/CollateralOperations";
import PriceGraph from "./_components/PriceGraph";
import RateActions from "./_components/RateActions";
import TokenActions from "./_components/TokenActions";
import UserPositionsTable from "./_components/UserPositionsTable";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10 pb-16">
        <div className="px-5 w-full">
          <div className="relative flex justify-center items-center mb-8">
            <h1 className="text-2xl">Stablecoin Challenge</h1>
            <RateActions />
            <TokenActions />
          </div>
          <div className="flex flex-wrap gap-8 justify-center">
            <div className="flex flex-col gap-8">
              <CollateralOperations />
              <BorrowOperations />
            </div>
            <div className="flex flex-col gap-8">
              <PriceGraph />
              <UserPositionsTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
