import React from "react";
import { Address as AddressBlock } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const UserPositionsTable = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "StableCoinEngine",
    eventName: "CollateralAdded",
    fromBlock: 0n, // should be the block number where the contract was deployed
    watch: true,
    blockData: true,
    transactionData: true,
    receiptData: true,
  });

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Address</th>
              <th>userCollateral</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr key={"skeleton"}>
                <td>
                  <div className="skeleton w-24 h-6"></div>
                </td>
                <td>
                  <div className="skeleton w-16 h-6"></div>
                </td>
              </tr>
            ) : (
              events &&
              events.map(event => (
                <tr key={event.args.user}>
                  <td>
                    <AddressBlock address={event.args.user} disableAddressLink size="sm" />
                  </td>
                  <td>{event.args.amount?.toString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserPositionsTable;
