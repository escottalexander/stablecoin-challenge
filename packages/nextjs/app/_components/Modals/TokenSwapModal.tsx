import { useEffect, useState } from "react";
import { Address, createWalletClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { ArrowDownIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { Balance, IntegerInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useTransactor } from "~~/hooks/scaffold-eth";

const localWalletClient = createWalletClient({
  chain: hardhat,
  transport: http(),
});
const FAUCET_ACCOUNT_INDEX = 0;

type TokenSwapModalProps = {
  myUSDBalance: string;
  connectedAddress: string;
  ETHprice: string;
  modalId: string;
};

export const TokenSwapModal = ({ myUSDBalance, connectedAddress, ETHprice, modalId }: TokenSwapModalProps) => {
  const burnAddress = "0x000000000000000000000000000000000000dead";

  const faucetTxn = useTransactor(localWalletClient);
  const writeTx = useTransactor();

  const [faucetAddress, setFaucetAddress] = useState<Address>();

  const [loading, setLoading] = useState(false);
  const [sellToken, setSellToken] = useState<"MyUSD" | "ETH">("MyUSD");
  const [sellValue, setSellValue] = useState("");
  const [buyValue, setBuyValue] = useState("");

  const { writeContractAsync: sendStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoin",
  });

  const { writeContractAsync: mintStableCoin } = useScaffoldWriteContract({
    contractName: "StableCoinEngine",
  });

  useEffect(() => {
    const getFaucetAddress = async () => {
      try {
        const accounts = await localWalletClient.getAddresses();
        setFaucetAddress(accounts[FAUCET_ACCOUNT_INDEX]);
      } catch (error) {
        console.error("⚡️ ~ file: Faucet.tsx:getFaucetAddress ~ error", error);
      }
    };
    getFaucetAddress();
  }, []);

  const handleChangeSellToken = () => {
    setSellToken(sellToken === "MyUSD" ? "ETH" : "MyUSD");
    setSellValue("");
    setBuyValue("");
  };

  const ethToMyUSD = (ethAmount: string): string => {
    const myUSDAmount = Number(ethAmount) * Number(ETHprice);
    return myUSDAmount.toFixed(8);
  };

  const MyUSDToETH = (myUSDAmount: string): string => {
    const ethAmount = Number(myUSDAmount) / Number(ETHprice);
    return ethAmount.toFixed(8);
  };

  const handleChangeInput = (isSell: boolean, newValue: string) => {
    if (newValue === "") {
      setSellValue("");
      setBuyValue("");
      return;
    }
    if (isSell) {
      setSellValue(newValue);
      const myUSDAmount = sellToken === "ETH" ? ethToMyUSD(newValue) : MyUSDToETH(newValue);
      setBuyValue(myUSDAmount);
    } else {
      setBuyValue(newValue);
      const ethAmount = sellToken === "MyUSD" ? ethToMyUSD(newValue) : MyUSDToETH(newValue);
      setSellValue(ethAmount);
    }
  };

  const handleSwap = async () => {
    setLoading(true);
    if (sellToken === "MyUSD") {
      try {
        await sendStableCoin({
          functionName: "transfer",
          args: [burnAddress, parseEther(sellValue)],
        });
        await faucetTxn({
          to: connectedAddress,
          value: parseEther(buyValue as `${number}`),
          account: faucetAddress,
        });

        setSellValue("");
        setBuyValue("");
      } catch (error) {
        console.error("Error sending stablecoins:", error);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await writeTx({
          to: faucetAddress,
          value: parseEther(sellValue as `${number}`),
          account: connectedAddress,
        });
        await mintStableCoin({
          functionName: "mintStableCoin",
          args: [parseEther(buyValue)],
        });

        setBuyValue("");
        setSellValue("");
      } catch (error) {
        console.error("Error minting stablecoins:", error);
      } finally {
        setLoading(false);
      }
    }
  };
  return (
    <div>
      <input type="checkbox" id={`${modalId}`} className="modal-toggle" />
      <label htmlFor={`${modalId}`} className="modal cursor-pointer">
        <label className="modal-box relative">
          {/* dummy input to capture event onclick on modal box */}
          <input className="h-0 w-0 absolute top-0 left-0" />
          <h3 className="text-xl font-bold mb-3">Simple Swap</h3>
          <label htmlFor={`${modalId}`} className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3">
            ✕
          </label>
          <div className="space-y-3">
            <div className="flex space-x-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold pl-3">Available:</span>
                <div className="flex">
                  <span className="text-sm pl-3">{myUSDBalance} MyUSD</span>
                  <Balance address={connectedAddress as Address} className="min-h-0 h-auto" />
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="flex full-width flex-row">
                <div className="basis-10/12">
                  <IntegerInput
                    value={sellValue}
                    onChange={newValue => {
                      handleChangeInput(true, newValue);
                    }}
                    placeholder={`Sell ${sellToken}`}
                    disableMultiplyBy1e18
                  />
                </div>
                <span className="basis-2/12 flex justify-center items-center text-md">
                  {sellToken === "MyUSD" ? "MyUSD" : "ETH"}
                </span>
              </div>
              <div className="flex justify-center">
                <button className="btn btn-circle btn-sm" onClick={handleChangeSellToken}>
                  <ArrowDownIcon className="h-4 w-4 my-0" />
                </button>
              </div>
              <div className="flex full-width flex-row">
                <div className="basis-10/12">
                  <IntegerInput
                    value={buyValue}
                    onChange={newValue => {
                      handleChangeInput(false, newValue);
                    }}
                    placeholder={`Buy ${sellToken === "MyUSD" ? "ETH" : "MyUSD"}`}
                    disableMultiplyBy1e18
                  />
                </div>
                <span className="basis-2/12 flex justify-center items-center text-md">
                  {sellToken === "MyUSD" ? "ETH" : "MyUSD"}
                </span>
              </div>
              <button className="h-10 btn btn-primary btn-sm px-2 rounded-full" onClick={handleSwap} disabled={loading}>
                {!loading ? (
                  <ArrowsRightLeftIcon className="h-6 w-6" />
                ) : (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
                <span>Swap</span>
              </button>
            </div>
          </div>
        </label>
      </label>
    </div>
  );
};
