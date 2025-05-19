import hre from "hardhat";
import { DEX, RateController, MyUSDStaking, MyUSDEngine } from "../typechain-types";

const ethers = hre.ethers;

// --- Config ---
const TARGET_PRICE = 1;
const PRICE_TOLERANCE = 0.00001; // 0.01%
const RATE_ADJUSTMENT_INTERVAL = 2000; // ms
const BORROW_RATE_MIN = 200; // 2%
const BORROW_RATE_MAX = 3000; // 30%
const SAVINGS_RATE_MIN = 200; // 2%
const PRICE_WINDOW = 5;
const RATE_CHANGE_DELAY = 5; // Number of iterations to wait before changing rate again

// --- State ---
const priceHistory: number[] = [];
let iterationsSinceLastChange = 0;
let isInitialized = false;

function logChange(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getPriceDirection(): "UP" | "DOWN" | "FLAT" {
  if (priceHistory.length < PRICE_WINDOW) return "FLAT";
  const a = priceHistory[0];
  const b = priceHistory[priceHistory.length - 1];
  if (a < b) return "UP";
  if (a > b) return "DOWN";
  return "FLAT";
}

function priceDeviation(price: number): number {
  return (price - 1) / 1;
}

interface BinarySearchState {
  low: number;
  high: number;
  lastRate: number;
}

function getNextRate(
  state: BinarySearchState,
  direction: "UP" | "DOWN" | "FLAT",
): { newRate: number; newState: BinarySearchState } {
  const { low, high, lastRate } = state;

  // Determine if we need to adjust the bounds
  if (direction === "UP" || direction === "FLAT") {
    // Price is too high, need lower rate
    const newRate = Math.floor((low + lastRate) / 2);
    return {
      newRate,
      newState: { low, high, lastRate: newRate },
    };
  } else {
    // Price is too low, need higher rate
    const newRate = Math.floor((lastRate + high) / 2);
    return {
      newRate,
      newState: { low, high, lastRate: newRate },
    };
  }
}

async function main() {
  const isGrowthMode = process.argv.includes("growth");
  const [deployer] = await ethers.getSigners();
  const dex = await ethers.getContract<DEX>("DEX", deployer);
  const rateController = await ethers.getContract<RateController>("RateController", deployer);
  const engine = await ethers.getContract<MyUSDEngine>("MyUSDEngine", deployer);
  const staking = await ethers.getContract<MyUSDStaking>("MyUSDStaking", deployer);

  const startBorrowRate = await engine.borrowRate();
  const startSavingsRate = await staking.savingsRate();
  logChange(`Interest Rate Controller started in ${isGrowthMode ? "GROWTH" : "TEMPERED"} mode`);

  // Ensure savings rate is 0 if not in growth mode
  if (!isGrowthMode) {
    if (startSavingsRate > 0) {
      logChange("Setting savings rate to 0 for tempered mode");
      await rateController.setSavingsRate(0);
    }
  }

  // Initialize binary search states
  const borrowState: BinarySearchState = {
    low: BORROW_RATE_MIN,
    high: BORROW_RATE_MAX,
    lastRate: Number(startBorrowRate),
  };

  const savingsState: BinarySearchState = {
    low: SAVINGS_RATE_MIN,
    high: Number(startBorrowRate), // Savings rate can't exceed borrow rate
    lastRate: Number(startSavingsRate),
  };

  setInterval(async () => {
    try {
      // --- Get price ---
      const currentPriceRaw = await dex.currentPrice();
      const currentPriceEth = 1 / (Number(ethers.formatEther(currentPriceRaw)) / 1800);
      priceHistory.push(currentPriceEth);
      if (priceHistory.length > PRICE_WINDOW) priceHistory.shift();
      const deviation = priceDeviation(currentPriceEth);
      const direction = getPriceDirection();

      // Initialize if not done yet
      if (!isInitialized) {
        if (priceHistory.length >= PRICE_WINDOW) {
          logChange("Initial price direction established");
          isInitialized = true;
        } else {
          logChange("Waiting for initial price data...");
          return;
        }
      }

      // --- Borrow rate logic ---
      const isMovingTowardsPeg =
        (TARGET_PRICE > currentPriceEth && direction === "UP") ||
        (TARGET_PRICE < currentPriceEth && direction === "DOWN");
      const shouldChangeRate =
        Math.abs(deviation) > PRICE_TOLERANCE && !isMovingTowardsPeg && iterationsSinceLastChange >= RATE_CHANGE_DELAY;

      if (shouldChangeRate) {
        const { newRate, newState } = getNextRate(borrowState, direction);
        logChange(
          `Price ${currentPriceEth.toFixed(6)} ${currentPriceEth > TARGET_PRICE ? "above" : "below"} peg, ` +
            `adjusting borrow rate to ${newRate}bps [${newState.low}, ${newState.high}]`,
        );
        await rateController.setBorrowRate(newRate);
        Object.assign(borrowState, newState);
        iterationsSinceLastChange = 0;
      } else {
        iterationsSinceLastChange++;
      }

      // --- Savings rate logic (only in growth mode) ---
      if (isGrowthMode) {
        if (Math.abs(deviation) > PRICE_TOLERANCE) {
          const { newRate, newState } = getNextRate(savingsState, direction);
          // Ensure savings rate stays within bounds
          const boundedRate = Math.min(Math.max(newRate, SAVINGS_RATE_MIN), borrowState.lastRate);
          logChange(
            `Price ${currentPriceEth.toFixed(6)} ${direction === "UP" ? "above" : "below"} peg, ` +
              `adjusting savings rate to ${boundedRate}bps [${newState.low}, ${newState.high}]`,
          );
          await rateController.setSavingsRate(boundedRate);
          Object.assign(savingsState, newState);
        }
      }
    } catch (e) {
      logChange(`Error: ${e}`);
    }
  }, RATE_ADJUSTMENT_INTERVAL);

  process.stdin.resume();
}

main().catch(e => {
  logChange(`Fatal error: ${e}`);
  process.exit(1);
});
