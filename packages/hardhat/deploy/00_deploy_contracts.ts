import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` or `yarn account:import` to import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Get the deployer's current nonce
  const deployerNonce = await hre.ethers.provider.getTransactionCount(deployer);

  // Calculate future addresses based on nonce
  const futureEngineAddress = hre.ethers.getCreateAddress({
    from: deployer,
    nonce: deployerNonce + 3, // +3 because it will be our 4th deployment (after MyUSD, DEX, Staking)
  });

  // Deploy contracts knowing the future engine address
  await deploy("MyUSD", {
    from: deployer,
    args: [futureEngineAddress],
  });
  const stablecoin = await hre.ethers.getContract<Contract>("MyUSD", deployer);

  // Continue with other deployments
  await deploy("DEX", {
    from: deployer,
    args: [stablecoin.target],
  });
  const DEX = await hre.ethers.getContract<Contract>("DEX", deployer);

  await deploy("MyUSDStaking", {
    from: deployer,
    args: [stablecoin.target, futureEngineAddress],
  });
  const staking = await hre.ethers.getContract<Contract>("MyUSDStaking", deployer);

  // Finally deploy the engine at exactly the predicted address
  await deploy("MyUSDEngine", {
    from: deployer,
    args: [DEX.target, stablecoin.target, staking.target],
  });
  const engine = await hre.ethers.getContract<Contract>("MyUSDEngine", deployer);

  if (engine.target !== futureEngineAddress) {
    throw new Error(
      "Engine address does not match predicted address, did you add transactions above this line that would skew the nonce set for 'futureEngineAddress'?",
    );
  }

  if (hre.network.name === "localhost") {
    // Set the staking contract in the MyUSD contract
    await stablecoin.setStakingContract(staking.target);

    // Set deployer ETH balance
    await hre.ethers.provider.send("hardhat_setBalance", [
      deployer,
      `0x${hre.ethers.parseEther("100000000000").toString(16)}`,
    ]);

    // Set initial price of stablecoin (as determined by DEX liquidity)
    const ethAmount = hre.ethers.parseEther("10000000");
    const myUSDAmount = hre.ethers.parseEther("18000000000");

    // Mint stablecoins
    await stablecoin.mintTo(deployer, myUSDAmount);

    // Approve DEX to use tokens and initialize DEX
    await stablecoin.approve(DEX.target, myUSDAmount);
    await DEX.init(myUSDAmount, { value: ethAmount });
  }
};

export default deployContracts;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
// deployYourContract.tags = ["YourContract"];
