import React, { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { BanknotesIcon, PaperAirplaneIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Address, AddressInput, IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { AddressType } from "~~/types/abitype/abi";

const TokenActions = () => {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [sendValue, setSendValue] = useState("");

  const [inputAddress, setInputAddress] = useState<AddressType>();

  const { data: stableCoinBalance } = useScaffoldReadContract({
    contractName: "StableCoin",
    functionName: "balanceOf",
    args: [address],
  });
  const myUSDBalance = formatEther(stableCoinBalance || 0n);

  const { writeContractAsync: sendStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoin",
  });

  const handleSend = async () => {
    try {
      await sendStableCoin({
        functionName: "transfer",
        args: [inputAddress, parseEther(sendValue)],
      });
      setInputAddress("");
      setSendValue("");
    } catch (error) {
      console.error("Error sending stablecoins:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute mt-3 top-[100px] right-10 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl">
      <div className="px-5 py-5 flex flex-col items-center gap-1 indicator">
        <span className="top-3 right-3 indicator-item">
          <div
            className="tooltip tooltip-info tooltip-left"
            data-tip="Here you can send MyUSD to any address"
          >
            <QuestionMarkCircleIcon className="h-4 w-4" />
          </div>
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm">{myUSDBalance} MyUSD</span>
          <label htmlFor="myusd-modal" className="btn btn-circle btn-xs">
            <PaperAirplaneIcon className="h-3 w-3" />
          </label>
        </div>
      </div>
      <input type="checkbox" id="myusd-modal" className="modal-toggle" />
      <label htmlFor="myusd-modal" className="modal cursor-pointer">
        <label className="modal-box relative">
          {/* dummy input to capture event onclick on modal box */}
          <input className="h-0 w-0 absolute top-0 left-0" />
          <h3 className="text-xl font-bold mb-3">Send MyUSD</h3>
          <label htmlFor="myusd-modal" className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3">
            ✕
          </label>
          <div className="space-y-3">
            <div className="flex space-x-4">
              <div>
                <span className="text-sm font-bold">From:</span>
                <Address address={address} onlyEnsOrAddress />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold pl-3">Available:</span>
                <span className="pl-3">{myUSDBalance} MyUSD</span>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <AddressInput
                placeholder="Destination Address"
                value={inputAddress ?? ""}
                onChange={value => setInputAddress(value as AddressType)}
              />
              <IntegerInput
                value={sendValue}
                onChange={newValue => {
                  setSendValue(newValue);
                }}
                placeholder="Amount"
                disableMultiplyBy1e18
              />
              <button className="h-10 btn btn-primary btn-sm px-2 rounded-full" onClick={handleSend} disabled={loading}>
                {!loading ? (
                  <BanknotesIcon className="h-6 w-6" />
                ) : (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </label>
      </label>
    </div>
  );
};

export default TokenActions;
