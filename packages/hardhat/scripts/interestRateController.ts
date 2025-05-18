import hre from "hardhat";
import { DEX, RateController } from "../typechain-types";

const ethers = hre.ethers;

// --- Config ---
// const TARGET_PRICE = ethers.parseEther("1"); // Unused
const PRICE_TOLERANCE = 0.0005; // 0.05%
const RATE_ADJUSTMENT_INTERVAL = 2000; // ms
const BORROW_RATE_MIN = 200; // 2%
const BORROW_RATE_MAX = 3000; // 30%
const SAVINGS_RATE_MIN = 200; // 2%
const PRICE_WINDOW = 3;
const EXP_BASE = 2;

// --- State ---
let mode: "TEMPERED" | "GROWTH" = "TEMPERED";
const priceHistory: number[] = [];
let borrowRateLow = BORROW_RATE_MIN;
let borrowRateHigh = BORROW_RATE_MAX;
let borrowRateThreshold = BORROW_RATE_MAX;
let lastBorrowRate = BORROW_RATE_MIN;
let lastSavingsRate = 0;
let binarySearchPhase = false;
let awayFromTargetCount = 1;
let lastPriceEth: number | null = null;

function logChange(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getPriceDirection(): "UP" | "DOWN" | "FLAT" {
  if (priceHistory.length < PRICE_WINDOW) return "FLAT";
  const [a, b, c] = priceHistory.slice(-PRICE_WINDOW);
  if (a < b && b < c) return "UP";
  if (a > b && b > c) return "DOWN";
  return "FLAT";
}

function priceDeviation(price: number): number {
  return (price - 1) / 1;
}

function expStep(base: number, exp: number, min = 1): number {
  return Math.max(min, Math.floor(Math.pow(base, exp)));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const dex = await ethers.getContract<DEX>("DEX", deployer);
  const rateController = await ethers.getContract<RateController>("RateController", deployer);

  logChange("Interest Rate Controller started in TEMPERED mode");

  setInterval(async () => {
    try {
      // --- Get price ---
      const currentPriceRaw = await dex.currentPrice();
      const currentPriceEth = 1 / (Number(ethers.formatEther(currentPriceRaw)) / 1800);
      priceHistory.push(currentPriceEth);
      if (priceHistory.length > PRICE_WINDOW) priceHistory.shift();
      const deviation = priceDeviation(currentPriceEth);
      const direction = getPriceDirection();

      if (lastPriceEth !== null) {
        if (Math.abs(currentPriceEth - 1) >= Math.abs(lastPriceEth - 1)) {
          awayFromTargetCount++;
        } else {
          awayFromTargetCount = 1;
        }
      }
      lastPriceEth = currentPriceEth;

      const step = expStep(EXP_BASE, awayFromTargetCount, 10);

      if (mode === "TEMPERED") {
        // Only adjust borrow rate, savings = 0
        await rateController.setSavingsRate(0);
        let nextBorrowRate = lastBorrowRate;
        if (!binarySearchPhase) {
          // Exponential up until direction change
          if (direction === "DOWN" || direction === "FLAT") {
            nextBorrowRate = Math.min(BORROW_RATE_MAX, lastBorrowRate + step);
            logChange(
              `TEMPERED: Price ${currentPriceEth.toFixed(6)} below peg, increasing borrow rate exponentially by ${step}bps to ${nextBorrowRate}`,
            );
            await rateController.setBorrowRate(nextBorrowRate);
            lastBorrowRate = nextBorrowRate;
            if (nextBorrowRate >= BORROW_RATE_MAX) {
              logChange(`TEMPERED: Hit max borrow rate, switching to binary search phase`);
              binarySearchPhase = true;
              borrowRateHigh = BORROW_RATE_MAX;
              borrowRateLow = BORROW_RATE_MIN;
            }
          } else {
            // Direction changed, start binary search
            logChange(`TEMPERED: Price direction changed to UP/FLAT, starting binary search for threshold`);
            binarySearchPhase = true;
            borrowRateHigh = lastBorrowRate;
            borrowRateLow = BORROW_RATE_MIN;
          }
        }
        if (binarySearchPhase) {
          // Binary search for threshold
          if (Math.abs(deviation) < PRICE_TOLERANCE) {
            borrowRateThreshold = lastBorrowRate;
            logChange(`TEMPERED: Peg restored at borrow rate ${borrowRateThreshold}bps. Switching to GROWTH mode.`);
            mode = "GROWTH";
            lastSavingsRate = 0;
            binarySearchPhase = false;
            awayFromTargetCount = 1;
          }
          if (direction === "UP" || direction === "FLAT") {
            // Overshot, step back
            borrowRateHigh = lastBorrowRate;
          } else {
            // Still down, need higher
            borrowRateLow = lastBorrowRate;
          }
          if (borrowRateHigh - borrowRateLow <= 10) {
            borrowRateThreshold = borrowRateHigh;
            logChange(
              `TEMPERED: Binary search converged. Threshold borrow rate: ${borrowRateThreshold}bps. Switching to GROWTH mode.`,
            );
            mode = "GROWTH";
            lastSavingsRate = 0;
            binarySearchPhase = false;
            awayFromTargetCount = 1;
          }
          const mid = Math.floor((borrowRateLow + borrowRateHigh) / 2);
          logChange(`TEMPERED: Binary search adjusting borrow rate to ${mid}bps [${borrowRateLow}, ${borrowRateHigh}]`);
          await rateController.setBorrowRate(mid);
          lastBorrowRate = mid;
        }
      } else if (mode === "GROWTH") {
        // Adjust both savings and borrow rate
        let nextSavingsRate = lastSavingsRate;
        let nextBorrowRate = lastBorrowRate;
        // --- Savings rate logic ---
        if (Math.abs(deviation) > PRICE_TOLERANCE) {
          // Exponential step based on deviation
          const exp = Math.ceil(Math.abs(deviation) * 10);
          const step = expStep(EXP_BASE, exp, 5);
          if (deviation > 0) {
            // Price above peg, lower savings rate, lower borrow rate
            if (lastSavingsRate > SAVINGS_RATE_MIN) {
              nextSavingsRate = Math.max(SAVINGS_RATE_MIN, lastSavingsRate - step);
              logChange(
                `GROWTH: Price above peg (${currentPriceEth.toFixed(6)}), lowering savings rate by ${step}bps to ${nextSavingsRate}`,
              );
              await rateController.setSavingsRate(nextSavingsRate);
            }
            if (lastBorrowRate > BORROW_RATE_MIN) {
              nextBorrowRate = Math.max(BORROW_RATE_MIN, lastBorrowRate - step);
              logChange(`GROWTH: Price above peg, lowering borrow rate by ${step}bps to ${nextBorrowRate}`);
              await rateController.setBorrowRate(nextBorrowRate);
            }
          } else {
            // Price below peg, raise savings rate, raise borrow rate
            if (lastSavingsRate < lastBorrowRate) {
              nextSavingsRate = Math.min(lastBorrowRate, lastSavingsRate + step);
              logChange(
                `GROWTH: Price below peg (${currentPriceEth.toFixed(6)}), raising savings rate by ${step}bps to ${nextSavingsRate}`,
              );
              await rateController.setSavingsRate(nextSavingsRate);
            }
            if (lastBorrowRate < BORROW_RATE_MAX) {
              nextBorrowRate = Math.min(BORROW_RATE_MAX, lastBorrowRate + step);
              logChange(`GROWTH: Price below peg, raising borrow rate by ${step}bps to ${nextBorrowRate}`);
              await rateController.setBorrowRate(nextBorrowRate);
            }
          }
        }
        // Clamp savings rate
        if (nextSavingsRate > nextBorrowRate) {
          nextSavingsRate = nextBorrowRate;
          logChange(`GROWTH: Clamping savings rate to borrow rate: ${nextSavingsRate}`);
          await rateController.setSavingsRate(nextSavingsRate);
        }
        lastSavingsRate = nextSavingsRate;
        lastBorrowRate = nextBorrowRate;
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
