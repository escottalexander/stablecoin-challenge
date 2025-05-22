import hre from "hardhat";
import { DEX, RateController, MyUSDStaking, MyUSDEngine } from "../typechain-types";

const ethers = hre.ethers;

// --- Config ---
const TARGET_PRICE = 1;
const PRICE_TOLERANCE = 0.000005; // 0.01%
const RATE_ADJUSTMENT_INTERVAL = 2000; // ms
const BORROW_RATE_MIN = 200; // 2%
const BORROW_RATE_MAX = 3000; // 30%
const SAVINGS_RATE_MIN = 200; // 2%
const PRICE_WINDOW = 10;
const RATE_CHANGE_DELAY = 10; // Number of iterations to wait before changing rate again
const PEG_HIT_THRESHOLD = 2; // Number of peg hits required to activate growth mode
const RATE_SPREAD = 100; // 1% spread between borrow and savings rate
// --- State ---
const priceHistory: number[] = [];
let iterationsSinceLastChange = 0;
let isInitialized = false;
let isGrowthMode = false;
let pegHits = 0;
let lastRateDirection: "UP" | "DOWN" | null = null;

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
  effectiveLow: number; // Last rate that was too low
  effectiveHigh: number; // Last rate that was too high
}

function getNextRate(
  state: BinarySearchState,
  direction: "UP" | "DOWN" | "FLAT",
  isPriceStable: boolean,
): { newRate: number; newState: BinarySearchState } {
  const { low, high, lastRate, effectiveLow, effectiveHigh } = state;

  // Reset effective bounds if price is stable
  if (isPriceStable) {
    return {
      newRate: lastRate,
      newState: {
        low,
        high,
        lastRate,
        effectiveLow: low,
        effectiveHigh: high,
      },
    };
  }

  // Use effective bounds if they exist, otherwise use min/max
  const searchLow = effectiveLow > 0 ? effectiveLow : low;
  const searchHigh = effectiveHigh > 0 ? effectiveHigh : high;

  // If bounds are too tight (less than 10 bps apart), reset them with 100 bps margin
  if (searchHigh - searchLow < 10) {
    const midPoint = Math.floor((searchLow + searchHigh) / 2);
    const newLow = Math.max(midPoint - 50, low);
    const newHigh = Math.min(midPoint + 50, high);

    return {
      newRate: lastRate,
      newState: {
        low,
        high,
        lastRate,
        effectiveLow: newLow,
        effectiveHigh: newHigh,
      },
    };
  }

  // Determine if we need to adjust the bounds
  if (direction === "UP" || direction === "FLAT") {
    // Price is too high, need lower rate
    const newRate = Math.floor((searchLow + lastRate) / 2);
    return {
      newRate,
      newState: {
        low,
        high,
        lastRate: newRate,
        effectiveLow: searchLow,
        effectiveHigh: lastRate, // Current rate was too high
      },
    };
  } else {
    // Price is too low, need higher rate
    const newRate = Math.floor((lastRate + searchHigh) / 2);
    return {
      newRate,
      newState: {
        low,
        high,
        lastRate: newRate,
        effectiveLow: lastRate, // Current rate was too low
        effectiveHigh: searchHigh,
      },
    };
  }
}

function checkPegHit(direction: "UP" | "DOWN" | "FLAT"): boolean {
  if (direction === "FLAT") return false;

  const isHit = lastRateDirection !== null && lastRateDirection !== direction;
  lastRateDirection = direction;
  return isHit;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const dex = await ethers.getContract<DEX>("DEX", deployer);
  const rateController = await ethers.getContract<RateController>("RateController", deployer);
  const engine = await ethers.getContract<MyUSDEngine>("MyUSDEngine", deployer);
  const staking = await ethers.getContract<MyUSDStaking>("MyUSDStaking", deployer);

  const startBorrowRate = await engine.borrowRate();
  const startSavingsRate = await staking.savingsRate();
  logChange(`Interest Rate Controller started in TEMPERED mode`);

  // Ensure savings rate is 0 initially
  if (startSavingsRate > 0) {
    logChange("Setting savings rate to 0 for tempered mode");
    await rateController.setSavingsRate(0);
  }

  // Initialize binary search states
  const borrowState: BinarySearchState = {
    low: BORROW_RATE_MIN,
    high: BORROW_RATE_MAX,
    lastRate: Number(startBorrowRate),
    effectiveLow: BORROW_RATE_MIN,
    effectiveHigh: BORROW_RATE_MAX,
  };

  const savingsState: BinarySearchState = {
    low: SAVINGS_RATE_MIN,
    high: Number(startBorrowRate),
    lastRate: Number(startSavingsRate),
    effectiveLow: SAVINGS_RATE_MIN,
    effectiveHigh: Number(startBorrowRate),
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
      const isPriceStable = Math.abs(deviation) <= PRICE_TOLERANCE;

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
      let shouldChangeRate =
        Math.abs(deviation) > PRICE_TOLERANCE && !isMovingTowardsPeg && iterationsSinceLastChange >= RATE_CHANGE_DELAY;

      // Activate growth mode after stable peg detection
      if (iterationsSinceLastChange > RATE_CHANGE_DELAY * 2 && isPriceStable && !isGrowthMode) {
        isGrowthMode = true;
        logChange("Activating GROWTH mode after stable peg detection!");
        borrowState.effectiveLow = BORROW_RATE_MIN;
        shouldChangeRate = true;
      }
      const totalShares = await staking.totalShares();
      if (shouldChangeRate || (isGrowthMode && totalShares === 0n)) {
        // Check for peg hit
        if (!isGrowthMode && checkPegHit(direction)) {
          // Only count as a new peg hit if it's been a while since the last one
          pegHits++;
          logChange(`Peg hit detected! (${pegHits}/${PEG_HIT_THRESHOLD})`);

          // Activate growth mode after threshold hits
          if (pegHits >= PEG_HIT_THRESHOLD) {
            isGrowthMode = true;
            logChange("Activating GROWTH mode after stable peg detection!");
            borrowState.effectiveLow = BORROW_RATE_MIN;
          }
        }

        const { newRate, newState } = getNextRate(borrowState, direction, isPriceStable);
        logChange(
          `Price ${currentPriceEth.toFixed(6)} ${currentPriceEth > TARGET_PRICE ? "above" : "below"} peg, ` +
            `adjusting borrow rate to ${newRate}bps [${newState.effectiveLow}, ${newState.effectiveHigh}]`,
        );
        await rateController.setBorrowRate(newRate);
        Object.assign(borrowState, newState);
        iterationsSinceLastChange = 0;

        // --- Savings rate logic (only in growth mode) ---
        if (isGrowthMode) {
          const maximumRate = Math.max(borrowState.lastRate - RATE_SPREAD, SAVINGS_RATE_MIN);
          // Set new borrow rate as the upper bound for savings rate
          Object.assign(savingsState, { ...savingsState, high: maximumRate });

          const { newRate, newState } = getNextRate(savingsState, direction, isPriceStable);
          // Ensure savings rate stays within bounds and doesn't exceed current borrow rate
          const boundedRate = Math.min(Math.max(newRate, SAVINGS_RATE_MIN), maximumRate);
          logChange(
            `Price ${currentPriceEth.toFixed(6)} ${currentPriceEth > TARGET_PRICE ? "above" : "below"} peg, ` +
              `adjusting savings rate to ${boundedRate}bps [${newState.effectiveLow}, ${maximumRate}]`,
          );
          await rateController.setSavingsRate(boundedRate);
          Object.assign(savingsState, {
            ...newState,
            high: maximumRate,
            effectiveHigh: maximumRate,
          });
          Object.assign(borrowState, {
            ...borrowState,
            low: savingsState.lastRate,
            effectiveLow: savingsState.lastRate,
          });
        }
      } else {
        iterationsSinceLastChange++;
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
