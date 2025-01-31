"use client";

import CollateralGraph from "./_components/CollateralGraph";
import CollateralOperations from "./_components/CollateralOperations";
import MintOperations from "./_components/MintOperations";
import PriceActions from "./_components/PriceActions";
import UserPositionsTable from "./_components/UserPositionsTable";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10 pb-16">
        <div className="px-5 w-full">
          <div className="relative flex justify-center items-center mb-8">
            <h1 className="text-2xl">Stablecoin challenge</h1>
            <PriceActions />
          </div>
          <div className="flex flex-wrap gap-8 justify-center">
            <div className="flex flex-col gap-8">
              <CollateralOperations />
              <MintOperations />
            </div>
            <div className="flex flex-col gap-8">
              <CollateralGraph />
              <UserPositionsTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
