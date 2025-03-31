//
// This script executes when you run 'yarn test'
//

import { ethers } from "hardhat";
import { expect } from "chai";
import { Stablecoin, StablecoinDEX, StablecoinEngine } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("🚩 Stablecoin Challenge 🤓", function () {
  let stablecoinToken: Stablecoin;
  let stablecoinDEX: StablecoinDEX;
  let stablecoinEngine: StablecoinEngine;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const collateralAmount = ethers.parseEther("10");
  const borrowAmount = ethers.parseEther("5000");

  beforeEach(async function () {
    await ethers.provider.send("hardhat_reset", []);
    [owner, user1, user2] = await ethers.getSigners();

    const Stablecoin = await ethers.getContractFactory("Stablecoin");
    stablecoinToken = await Stablecoin.deploy();

    const StablecoinDEX = await ethers.getContractFactory("StablecoinDEX");
    stablecoinDEX = await StablecoinDEX.deploy(await stablecoinToken.getAddress());

    await stablecoinToken.mintTo(owner.address, ethers.parseEther("1000000"));
    await stablecoinToken.approve(stablecoinDEX.target, ethers.parseEther("1000000"));
    await stablecoinDEX.init(ethers.parseEther("1000000"), { value: ethers.parseEther("1000") });

    const StablecoinEngine = await ethers.getContractFactory("StablecoinEngine");
    stablecoinEngine = await StablecoinEngine.deploy(stablecoinDEX.target, stablecoinToken.target);

    await stablecoinToken.transferOwnership(stablecoinEngine.target);
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial state", async function () {
      expect(await stablecoinToken.owner()).to.equal(await stablecoinEngine.getAddress());
    });
  });

  describe("Collateral Operations", function () {
    it("Should allow adding collateral", async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
      expect(await stablecoinEngine.s_userCollateral(user1.address)).to.equal(collateralAmount);
    });

    it("Should emit CollateralAdded event", async function () {
      await expect(stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount }))
        .to.emit(stablecoinEngine, "CollateralAdded")
        .withArgs(user1.address, collateralAmount, await stablecoinDEX.currentPrice());
    });

    it("Should allow withdrawing collateral when no debt", async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
      await stablecoinEngine.connect(user1).withdrawCollateral(collateralAmount);
      expect(await stablecoinEngine.s_userCollateral(user1.address)).to.equal(0);
    });

    it("Should prevent withdrawing more than deposited", async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
      await expect(
        stablecoinEngine.connect(user1).withdrawCollateral(collateralAmount * 2n),
      ).to.be.revertedWithCustomError(stablecoinEngine, "StablecoinEngine__InvalidAmount");
    });
  });

  describe("Borrowing Operations", function () {
    beforeEach(async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
    });

    it("Should allow borrowing when sufficiently collateralized", async function () {
      expect(await stablecoinToken.balanceOf(user1.address)).to.equal(0n);
      await stablecoinEngine.connect(user1).borrowStablecoin(borrowAmount);
      expect(await stablecoinEngine.s_userBorrowed(user1.address)).to.equal(borrowAmount);
      expect(await stablecoinToken.balanceOf(user1.address)).to.equal(borrowAmount);
    });

    it("Should prevent borrowing when insufficiently collateralized", async function () {
      const tooMuchBorrow = ethers.parseEther("10000");
      await expect(stablecoinEngine.connect(user1).borrowStablecoin(tooMuchBorrow)).to.be.revertedWithCustomError(
        stablecoinEngine,
        "StablecoinEngine__UnsafePositionRatio",
      );
    });

    it("Should emit AssetBorrowed event", async function () {
      await expect(stablecoinEngine.connect(user1).borrowStablecoin(borrowAmount))
        .to.emit(stablecoinEngine, "AssetBorrowed")
        .withArgs(user1.address, borrowAmount, await stablecoinDEX.currentPrice());
    });
  });

  describe("Repayment Operations", function () {
    beforeEach(async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
      await stablecoinEngine.connect(user1).borrowStablecoin(borrowAmount);
    });

    it("Should allow repaying borrowed amount", async function () {
      await stablecoinToken.connect(user1).approve(stablecoinEngine.target, borrowAmount);
      await stablecoinEngine.connect(user1).repayStablecoin(borrowAmount);
      expect(await stablecoinEngine.s_userBorrowed(user1.address)).to.equal(0);
    });

    it("Should allow repaying less than full borrowed amount", async function () {
      await stablecoinToken.connect(user1).approve(stablecoinEngine.target, borrowAmount / 2n);
      await stablecoinEngine.connect(user1).repayStablecoin(borrowAmount / 2n);
      expect(await stablecoinEngine.s_userBorrowed(user1.address)).to.equal(borrowAmount / 2n);
    });

    it("Should prevent repaying more than borrowed", async function () {
      await stablecoinToken.connect(user1).approve(stablecoinEngine.target, borrowAmount * 2n);
      await expect(stablecoinEngine.connect(user1).repayStablecoin(borrowAmount * 2n)).to.be.revertedWithCustomError(
        stablecoinEngine,
        "StablecoinEngine__InvalidAmount",
      );
    });

    it("Should emit AssetRepaid event", async function () {
      await stablecoinToken.connect(user1).approve(stablecoinEngine.target, borrowAmount);
      await expect(stablecoinEngine.connect(user1).repayStablecoin(borrowAmount))
        .to.emit(stablecoinEngine, "AssetRepaid")
        .withArgs(user1.address, borrowAmount, await stablecoinDEX.currentPrice());
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await stablecoinEngine.connect(user1).addCollateral({ value: collateralAmount });
      await stablecoinEngine.connect(user1).borrowStablecoin(borrowAmount);
      await stablecoinToken
        .connect(await ethers.getImpersonatedSigner(stablecoinEngine.target as string))
        .mintTo(user2.address, borrowAmount);
      await stablecoinToken.connect(user2).approve(stablecoinEngine.target, borrowAmount);
    });

    it("Should allow liquidation when position is unsafe", async function () {
      // drop price of eth so that user1 position is below 1.2
      await stablecoinDEX.swap(ethers.parseEther("300"), { value: ethers.parseEther("300") });

      expect(await stablecoinEngine.isLiquidatable(user1)).to.be.true;
      const beforeBalance = await ethers.provider.getBalance(user2.address);
      await stablecoinEngine.connect(user2).liquidate(user1.address);
      const afterBalance = await ethers.provider.getBalance(user2.address);
      expect(await stablecoinEngine.s_userBorrowed(user1.address)).to.equal(0);
      expect(afterBalance).to.be.gt(beforeBalance);
    });

    it("Should prevent liquidation of safe positions", async function () {
      expect(await stablecoinEngine.isLiquidatable(user1)).to.be.false;
      await expect(stablecoinEngine.connect(user2).liquidate(user1.address)).to.be.revertedWithCustomError(
        stablecoinEngine,
        "StablecoinEngine__NotLiquidatable",
      );
    });

    it("Should emit appropriate events on liquidation", async function () {
      await stablecoinDEX.swap(ethers.parseEther("300"), { value: ethers.parseEther("300") });
      await expect(stablecoinEngine.connect(user2).liquidate(user1.address)).to.emit(stablecoinEngine, "Liquidation");
    });
  });
});
