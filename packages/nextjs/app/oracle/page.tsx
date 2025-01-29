"use client";

import PriceActions from "../_components/PriceActions";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <PriceActions />
    </div>
  );
};

export default Home;
