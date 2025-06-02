//
// This script executes when you run 'yarn test'
//

import { ethers } from "hardhat";
import { expect } from "chai";
import { MyUSD, DEX, MyUSDEngine, Oracle, MyUSDStaking, RateController } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("🚩 Stablecoin Challenge 🤓", function () {
  let myUSDToken: MyUSD;
  let dex: DEX;
  let myUSDEngine: MyUSDEngine;
  let oracle: Oracle;
  let staking: MyUSDStaking;
  let rateController: RateController;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const collateralAmount = ethers.parseEther("10");
  const borrowAmount = ethers.parseEther("5000");

  beforeEach(async function () {
    await ethers.provider.send("hardhat_reset", []);
    [owner, user1, user2] = await ethers.getSigners();

    // Get the deployer's current nonce
    const deployerNonce = await ethers.provider.getTransactionCount(owner.address);

    // Calculate future addresses based on nonce
    const futureStakingAddress = ethers.getCreateAddress({
      from: owner.address,
      nonce: deployerNonce + 4, // +4 because it will be our fifth deployment
    });

    const futureEngineAddress = ethers.getCreateAddress({
      from: owner.address,
      nonce: deployerNonce + 5, // +5 because it will be our sixth deployment
    });

    // Deploy RateController first
    const RateControllerFactory = await ethers.getContractFactory("RateController");
    rateController = await RateControllerFactory.deploy(futureEngineAddress, futureStakingAddress);

    // Deploy MyUSD with future addresses
    const MyUSDFactory = await ethers.getContractFactory("MyUSD");
    myUSDToken = await MyUSDFactory.deploy(futureEngineAddress, futureStakingAddress);

    // Deploy DEX
    const DEXFactory = await ethers.getContractFactory("DEX");
    dex = await DEXFactory.deploy(await myUSDToken.getAddress());

    // Deploy Oracle
    const OracleFactory = await ethers.getContractFactory("Oracle");
    oracle = await OracleFactory.deploy(await dex.getAddress());

    // Deploy MyUSDStaking
    const MyUSDStakingFactory = await ethers.getContractFactory("MyUSDStaking");
    staking = await MyUSDStakingFactory.deploy(
      await myUSDToken.getAddress(),
      futureEngineAddress,
      await rateController.getAddress(),
    );

    // Finally deploy the MyUSDEngine at the predicted address
    const MyUSDEngineFactory = await ethers.getContractFactory("MyUSDEngine");
    myUSDEngine = await MyUSDEngineFactory.deploy(
      await oracle.getAddress(),
      await myUSDToken.getAddress(),
      await staking.getAddress(),
      await rateController.getAddress(),
    );

    // Verify addresses match predictions
    expect(await myUSDEngine.getAddress()).to.equal(futureEngineAddress);
    expect(await staking.getAddress()).to.equal(futureStakingAddress);

    const ethCollateralAmount = ethers.parseEther("5000");
    // Initialize DEX with liquidity
    const ethDEXAmount = ethers.parseEther("1000");
    const myUSDAmount = ethers.parseEther("1800000");

    // Add collateral and mint MyUSD for DEX initialization
    await myUSDEngine.addCollateral({ value: ethCollateralAmount });
    await myUSDEngine.mintMyUSD(myUSDAmount);

    const confirmedBalance = await myUSDToken.balanceOf(owner.address);
    // Don't add DEX liquidity if the deployer account doesn't have the stablecoins
    if (confirmedBalance == myUSDAmount) {
      // Approve DEX to use tokens and initialize DEX
      await myUSDToken.approve(dex.target, myUSDAmount);
      await dex.init(myUSDAmount, { value: ethDEXAmount });
    }
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial state", async function () {
      expect(await myUSDToken.owner()).to.equal(owner.address);
      expect(await dex.totalLiquidity()).to.be.gt(0);
      expect(await oracle.getPrice()).to.be.gt(0);
      expect(await myUSDEngine.borrowRate()).to.equal(0);
      expect(await staking.savingsRate()).to.equal(0);
    });
  });

  describe("Collateral Operations", function () {
    it("Should allow adding collateral", async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
      expect(await myUSDEngine.s_userCollateral(user1.address)).to.equal(collateralAmount);
    });

    it("Should emit CollateralAdded event", async function () {
      await expect(myUSDEngine.connect(user1).addCollateral({ value: collateralAmount }))
        .to.emit(myUSDEngine, "CollateralAdded")
        .withArgs(user1.address, collateralAmount, await oracle.getPrice());
    });

    it("Should allow withdrawing collateral when no debt", async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
      await myUSDEngine.connect(user1).withdrawCollateral(collateralAmount);
      expect(await myUSDEngine.s_userCollateral(user1.address)).to.equal(0);
    });

    it("Should prevent withdrawing more than deposited", async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
      await expect(myUSDEngine.connect(user1).withdrawCollateral(collateralAmount * 2n)).to.be.revertedWithCustomError(
        myUSDEngine,
        "Engine__InvalidAmount",
      );
    });
  });

  describe("Borrowing Operations", function () {
    beforeEach(async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
    });

    it("Should allow borrowing when sufficiently collateralized", async function () {
      expect(await myUSDToken.balanceOf(user1.address)).to.equal(0n);
      await myUSDEngine.connect(user1).mintMyUSD(borrowAmount);
      expect(await myUSDEngine.s_userDebtShares(user1.address)).to.equal(borrowAmount);
      expect(await myUSDToken.balanceOf(user1.address)).to.equal(borrowAmount);
    });

    it("Should prevent borrowing when insufficiently collateralized", async function () {
      const tooMuchBorrow = ethers.parseEther("1000000");
      await expect(myUSDEngine.connect(user1).mintMyUSD(tooMuchBorrow)).to.be.revertedWithCustomError(
        myUSDEngine,
        "Engine__UnsafePositionRatio",
      );
    });

    it("Should emit DebtSharesMinted event", async function () {
      await expect(myUSDEngine.connect(user1).mintMyUSD(borrowAmount))
        .to.emit(myUSDEngine, "DebtSharesMinted")
        .withArgs(user1.address, borrowAmount, borrowAmount);
    });
  });

  describe("Repayment Operations", function () {
    beforeEach(async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
      await myUSDEngine.connect(user1).mintMyUSD(borrowAmount);
    });

    it("Should allow repaying borrowed amount", async function () {
      await myUSDToken.connect(user1).approve(myUSDEngine.target, borrowAmount);
      await myUSDEngine.connect(user1).repayUpTo(borrowAmount);
      expect(await myUSDEngine.s_userDebtShares(user1.address)).to.equal(0);
    });

    it("Should allow repaying less than full borrowed amount", async function () {
      await myUSDToken.connect(user1).approve(myUSDEngine.target, borrowAmount / 2n);
      await myUSDEngine.connect(user1).repayUpTo(borrowAmount / 2n);
      expect(await myUSDEngine.s_userDebtShares(user1.address)).to.equal(borrowAmount / 2n);
    });

    it("Should allow repaying more than borrowed", async function () {
      await myUSDToken.connect(user1).approve(myUSDEngine.target, borrowAmount * 2n);
      await dex.connect(user1).swap(ethers.parseEther("10"), { value: ethers.parseEther("10") });
      await myUSDEngine.connect(user1).repayUpTo(borrowAmount * 2n);
      expect(await myUSDEngine.s_userDebtShares(user1.address)).to.equal(0);
    });

    it("Should emit DebtSharesBurned event", async function () {
      await myUSDToken.connect(user1).approve(myUSDEngine.target, borrowAmount);
      await expect(myUSDEngine.connect(user1).repayUpTo(borrowAmount))
        .to.emit(myUSDEngine, "DebtSharesBurned")
        .withArgs(user1.address, borrowAmount, await myUSDToken.balanceOf(user1.address));
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await myUSDEngine.connect(user1).addCollateral({ value: collateralAmount });
      await myUSDEngine.connect(user1).mintMyUSD(borrowAmount);
      await myUSDToken
        .connect(await ethers.getImpersonatedSigner(myUSDEngine.target as string))
        .mintTo(user2.address, borrowAmount * 10n);
      await myUSDToken.connect(user2).approve(myUSDEngine.target, borrowAmount * 10n);
    });

    it("Should allow liquidation when position is unsafe", async function () {
      // drop price of eth so that user1 position is below 1.5
      await dex.swap(ethers.parseEther("600"), { value: ethers.parseEther("600") });
      expect(await myUSDEngine.isLiquidatable(user1)).to.be.true;
      const beforeBalance = await ethers.provider.getBalance(user2.address);
      await myUSDEngine.connect(user2).liquidate(user1.address);
      const afterBalance = await ethers.provider.getBalance(user2.address);
      expect(await myUSDEngine.s_userDebtShares(user1.address)).to.equal(0);
      expect(afterBalance).to.be.gt(beforeBalance);
    });

    it("Should prevent liquidation of safe positions", async function () {
      expect(await myUSDEngine.isLiquidatable(user1)).to.be.false;
      await expect(myUSDEngine.connect(user2).liquidate(user1.address)).to.be.revertedWithCustomError(
        myUSDEngine,
        "Engine__NotLiquidatable",
      );
    });

    it("Should emit appropriate events on liquidation", async function () {
      await dex.swap(ethers.parseEther("1000"), { value: ethers.parseEther("1000") });
      await expect(myUSDEngine.connect(user2).liquidate(user1.address)).to.emit(myUSDEngine, "Liquidation");
    });
  });
});
