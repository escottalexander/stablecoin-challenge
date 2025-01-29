"use client";

import CollateralGraph from "./_components/CollateralGraph";
import UserPositionsTable from "./_components/UserPositionsTable";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-12 w-full">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Stablecoin challenge</span>
            <div className="mt-5 flex gap-5">
              <div className="flex flex-col h-48 gap-5 w-full">
                <UserPositionsTable />
              </div>
              <div className="flex flex-col h-48 gap-5">
                <CollateralGraph />
              </div>
            </div>
          </h1>
        </div>
      </div>
    </>
  );
};

export default Home;
