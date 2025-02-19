import { HDNodeWallet, parseEther } from "ethers";
import hre from "hardhat";
import { CornDEX, BasicLending, Corn, MovePrice } from "../typechain-types";
const ethers = hre.ethers;
interface SimulatedAccount {
  wallet: HDNodeWallet;
  initialEth: bigint;
}

const liquidationInProgress = new Set<string>();

async function fundAccountsIfNeeded(accounts: SimulatedAccount[], deployer: any) {
  for (const account of accounts) {
    const currentBalance = await ethers.provider.getBalance(account.wallet.address);
    
    // Fund if balance drops below 2 ETH
    if (currentBalance < ethers.parseEther("2")) {
      // Random amount between 3-13 ETH
      const randomEth = 3 + Math.random() * 10;
      const topUpAmount = ethers.parseEther(randomEth.toString());
      
      const tx = await deployer.sendTransaction({
        to: account.wallet.address,
        value: topUpAmount,
      });
      await tx.wait();
      console.log(`Topped up ${account.wallet.address} with ${randomEth.toFixed(2)} ETH`);
    }
  }
}

async function simulatePeriodicFunding(accounts: SimulatedAccount[], deployer: any) {
  console.log("Starting periodic funding checker...");

  ethers.provider.on("block", async blockNumber => {
    try {
      // Check every 10 blocks
      if (blockNumber % 10 === 0) {
        await fundAccountsIfNeeded(accounts, deployer);
      }
    } catch (error) {
      console.error(`Error in periodic funding at block ${blockNumber}`);
    }
  });
}

async function setupAccounts(lending: BasicLending, corn: Corn): Promise<SimulatedAccount[]> {
  console.log("Setting up simulated accounts...");

  const accounts: SimulatedAccount[] = [];
  const initialEth = ethers.parseEther("12"); // 12 ETH each
  const [deployer] = await ethers.getSigners();

  // Create deterministic wallets using a base mnemonic
  const baseMnemonic = "test test test test test test test test test test test junk";

  // Create 5 deterministic wallets
  for (let i = 0; i < 5; i++) {
    const wallet = ethers.HDNodeWallet.fromPhrase(baseMnemonic, `m/44'/60'/0'/0/${i}`).connect(ethers.provider);
    accounts.push({
      wallet,
      initialEth,
    });
  }

  // Do initial funding
  await fundAccountsIfNeeded(accounts, deployer);


  return accounts;
}

async function movePrice(movePrice: MovePrice) {
  console.log("Starting price oracle simulator...");

  let trend = Math.random() > 0.5 ? 1 : -1; // Start with random trend
  let trendDuration = 0;
  let maxTrendDuration = Math.floor(Math.random() * 13) + 5; // Random duration between 5-17 blocks

  ethers.provider.on("block", async blockNumber => {
    try {
      // Increment trend duration
      trendDuration++;

      // Maybe switch trend direction
      if (trendDuration >= maxTrendDuration) {
        trend *= -1; // Reverse trend
        trendDuration = 0;
        maxTrendDuration = Math.floor(Math.random() * 10) + 5; // New random duration
        console.log(`Block ${blockNumber}: Trend reversed to ${trend > 0 ? 'upward' : 'downward'}`);
      }

      // Add some noise to the trend
      const noise = (Math.random() * 2.5 - 1.6);
      const direction = trend + noise;
      
      const amount = parseEther("24000");
      const amountToSell = direction > 0 ? amount : -amount * 1000n;
  
      const tx = await movePrice.movePrice(amountToSell);
      await tx.wait();

    } catch (error) {
      console.error(`Error updating price at block ${blockNumber}:`, error);
    }
  });
}

async function simulateBorrowing(lending: BasicLending, accounts: SimulatedAccount[]) {
  console.log("Starting random borrowing simulator...");

  ethers.provider.on("block", async blockNumber => {
    try {
      // 20% chance each block that a random account will try to borrow
      if (Math.random() < 0.30) {
        const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
        const lendingWithAccount = lending.connect(randomAccount.wallet);

        const collateralValue = await lending.calculateCollateralValue(randomAccount.wallet.address);
        if (collateralValue > 0n) {
          const aggressiveBorrower = Math.random() < 0.3;
          
          // Calculate max borrow amount based on collateral
          let maxBorrowAmount: bigint;
          if (aggressiveBorrower) {
            // Aggressive: 85-99% of collateral
            const percentage = 85 + Math.random() * 14;
            maxBorrowAmount = (collateralValue * BigInt(Math.floor(percentage * 10))) / 1000n;
          } else {
            // Conservative: 30-70% of collateral
            const percentage = 30 + Math.random() * 40;
            maxBorrowAmount = (collateralValue * BigInt(Math.floor(percentage * 10))) / 1000n;
          }
          
          if (maxBorrowAmount > 0n) {
            try {
              await lendingWithAccount.borrowCorn(maxBorrowAmount);
              console.log(
                `Account ${randomAccount.wallet.address} borrowed ${ethers.formatEther(maxBorrowAmount)} CORN ` +
                `(${aggressiveBorrower ? 'aggressive' : 'conservative'}, ` +
                `${((Number(maxBorrowAmount) * 100) / Number(collateralValue)).toFixed(1)}% of collateral)`
              );
            } catch (error) {
              // Silently fail if borrowing not possible
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error in random borrowing at block ${blockNumber}:`, error);
    }
  });
}

async function simulateLiquidator(lending: BasicLending, corn: Corn, accounts: SimulatedAccount[]) {
  console.log("Starting liquidator bot...");

  const cornDEX = await ethers.getContract<CornDEX>("CornDEX");

  ethers.provider.on("block", async blockNumber => {
    try {
      // Get all historical AddCollateral events to find users
      const filter = lending.filters.CollateralAdded();
      const events = await lending.queryFilter(filter);
      const users = [...new Set(events.map(event => event.args[0]))];

      // Check each user's position
      for (const user of users) {
        // Skip if already being liquidated
        if (liquidationInProgress.has(user.toLowerCase())) continue;

        const amountBorrowed = await lending.s_userBorrowed(user);
        if (amountBorrowed === 0n) continue;
        
        const isLiquidatable = await lending.isLiquidatable(user);
        if (!isLiquidatable) continue;

        // Find eligible liquidators
        const eligibleLiquidators = [];
        for (const account of accounts) {
          // Skip if this is the user being checked
          if (account.wallet.address.toLowerCase() === user.toLowerCase()) continue;

          const liquidatorBalance = await corn.balanceOf(account.wallet.address);
          if (liquidatorBalance >= amountBorrowed) {
            eligibleLiquidators.push(account);
          }
        }

        // If no eligible liquidators, try to swap ETH for CORN using a random account
        if (eligibleLiquidators.length === 0) {
          const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
          if (randomAccount.wallet.address.toLowerCase() !== user.toLowerCase()) {
            const cornDEXWithAccount = cornDEX.connect(randomAccount.wallet);
            
            // Calculate how much ETH we need to swap to get enough CORN
            const currentPrice = await cornDEX.currentPrice();
            // Add 10% buffer for price impact and slippage
            const ethNeeded = (amountBorrowed * currentPrice * 110n) / (1000n * parseEther("1"));
            const balance = await ethers.provider.getBalance(randomAccount.wallet.address);
            const maxETHPossible = ethNeeded > balance ? balance - ethers.parseEther("0.1") : ethNeeded;
            if (maxETHPossible < ethers.parseEther("0.01")) continue;
            try {
              const swapTx = await cornDEXWithAccount.swap(maxETHPossible, { 
                value: maxETHPossible 
              });
              await swapTx.wait();
              
              // Verify the swap gave enough CORN
              const newBalance = await corn.balanceOf(randomAccount.wallet.address);
              if (newBalance >= amountBorrowed) {
                eligibleLiquidators.push(randomAccount);
                console.log(`Account ${randomAccount.wallet.address} swapped ${ethers.formatEther(ethNeeded)} ETH for CORN`);
              }
            } catch (error) {
              console.error(`Failed to swap ETH for CORN`);
            }
          }
        }

        // Randomly select one of the eligible liquidators
        const liquidator = eligibleLiquidators[Math.floor(Math.random() * eligibleLiquidators.length)];
        if (!liquidator) continue;

        // Mark user as being liquidated
        liquidationInProgress.add(user.toLowerCase());
        console.log(`Account ${liquidator.wallet.address} found liquidatable position for user: ${user}`);

        const lendingWithLiquidator = lending.connect(liquidator.wallet);
        const cornWithLiquidator = corn.connect(liquidator.wallet);

        try {
          const approveTx = await cornWithLiquidator.approve(lending.target, amountBorrowed);
          await approveTx.wait();

          const tx = await lendingWithLiquidator.liquidate(user);
          await tx.wait();

          const balance = await ethers.provider.getBalance(user);
          const twoETH = parseEther("2");
          if (balance > twoETH) {
            await lendingWithLiquidator.addCollateral({ value: balance - twoETH });
          }

          console.log(`Successfully liquidated position for user ${user} at block ${blockNumber}`);
        } catch (error) {
          console.error(`Failed to liquidate user ${user}`);
        } finally {
          liquidationInProgress.delete(user.toLowerCase());
        }

        // Only liquidate one position per block
        break;
      }
    } catch (error) {
      console.error(`Error in liquidator at block ${blockNumber}`);
    }
  });
}

async function simulateAddCollateral(lending: BasicLending, accounts: SimulatedAccount[]) {
  console.log("Starting random collateral simulator...");

  ethers.provider.on("block", async blockNumber => {
    try {
      // 15% chance each block that a random account will add collateral
      if (Math.random() < 0.20) {
        const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
        const lendingWithAccount = lending.connect(randomAccount.wallet);

        // Get current balance and collateral
        const balance = await ethers.provider.getBalance(randomAccount.wallet.address);
        const currentCollateral = await lending.s_userCollateral(randomAccount.wallet.address);
        
        // Only proceed if account has more than 3 ETH (keep some for gas)
        if (balance > ethers.parseEther("3")) {
          // Calculate a random amount to add as collateral
          const maxPossible = balance - ethers.parseEther("2"); // Keep 2 ETH for operations
          
          // Random percentage of available ETH (20-80%)
          const percentage = 20 + Math.random() * 60;
          const amountToAdd = (maxPossible * BigInt(Math.floor(percentage * 10))) / 1000n;

          if (amountToAdd > ethers.parseEther("0.1")) {
            try {
              const tx = await lendingWithAccount.addCollateral({ value: amountToAdd });
              await tx.wait();
              
              console.log(
                `Account ${randomAccount.wallet.address} added ${ethers.formatEther(amountToAdd)} ETH as collateral ` +
                `(${percentage.toFixed(1)}% of available balance, ` +
                `total collateral: ${ethers.formatEther(currentCollateral + amountToAdd)} ETH)`
              );
            } catch (error) {
              // Silently fail if transaction fails
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error in random collateral at block ${blockNumber}`);
    }
  });
}

async function disableAutomine() {
  // Disable automine
  await ethers.provider.send("evm_setAutomine", [false]);
  await ethers.provider.send("evm_setIntervalMining", [2000]);
  console.log("Set to mine blocks every 2 seconds");
}

async function main() {
  // Initial setup
  const [deployer] = await ethers.getSigners();
  const movePriceContract = await ethers.getContract<MovePrice>("MovePrice", deployer);
  const lending = await ethers.getContract<BasicLending>("BasicLending", deployer);
  const corn = await ethers.getContract<Corn>("Corn", deployer);

  // Setup accounts
  const accounts = await setupAccounts(lending, corn);

  // Disable automine now that accounts are set up
  await disableAutomine();

  // Start oracle price simulation
  await movePrice(movePriceContract);

  // Start liquidator bot with accounts
  await simulateLiquidator(lending, corn, accounts);

  // Start random borrowing simulation
  await simulateBorrowing(lending, accounts);

  // Start random collateral additions
  await simulateAddCollateral(lending, accounts);

  // Start periodic funding checks
  await simulatePeriodicFunding(accounts, deployer);

  // Keep the script running
  process.stdin.resume();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
