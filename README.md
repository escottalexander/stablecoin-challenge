# 💳🌽 Lending Challenge

> ❓ How does lending work onchain? First, traditional lending usually involves one party (such as banks) offering up money and another party agreeing to pay interest over-time in order to use that money. The only way this works is because the lending party has some way to hold the borrower accountable. This requires some way to identify the borrower and a legal structure that will help settle things if the borrower decides to stop making interest payments. In the onchain world we don't have a reliable identification system *(yet)* so all lending is "over-collateralized". Borrowers must lock up collateral in order to take out a loan. "Over-collateralized" means you can never borrow more value than you have supplied. I am sure you are wondering, "What is the benefit of a loan if you can't take out more than you put in?" Great question! This form of lending lacks the common use case seen in traditional lending where people may use the loan to buy a house they otherwise couldn't afford but here are a few primary use cases of permissionless lending in DeFi:

- Maintaining Price Exposure ~ You may have real world bills due but you are *sure* that ETH is going up in value from here and it would kill you to sell to pay your bills. You could get a loan against your ETH in a stablecoin and pay your bills. You would still have ETH locked up to come back to and all you would have to do is pay back the stablecoin loan.
- Leverage ~ You could deposit ETH and borrow a stablecoin but only use it to buy more ETH, increasing your exposure to the ETH price movements (to the upside 🎢 or the downside 🔻😰).
- Tax Advantages ~ In many jurisdictions, money obtained from a loan is taxed differently than money obtained other ways. It might be advantageous to avoid outright selling of an asset and instead get a loan against it.

> 👍 Now that you know the background of what is and is not possible with onchain lending, lets dive in to the challenge!

> 💬 The Lending contract accepts ETH deposits and allows depositors to take out a loan in CORN 🌽. The contract tracks each depositors address and only allows them to borrow as long as they maintain at least 120% of the loans value in ETH. If the collateral falls in value or if CORN goes up in value then the borrowers position may be liquidatable by anyone who pays back the loan. They have an incentive to do this because they collect a 10% fee on top of the value of the loan. 

> 📈 The Lending contract naively uses the price returned by a CORN/ETH DEX contract. This makes it easy for you to change the price of CORN by "moving the market" with large swaps. Shout out to the [DEX challenge](https://github.com/scaffold-eth/se-2-challenges/blob/challenge-4-dex/README.md)! Using a DEX as the sole price oracle would never work in a production grade system but it will help to demonstrate the different market conditions that affect a lending protocol.

> 🌽 Your job is to fill out the functions in the Lending contract so that it enables you to take out a CORN loan.

> 💬 Meet other builders working on this challenge and get help in the TODO

---

## Checkpoint 0: 📦 Environment 📚

Before you begin, you need to install the following tools:

- [Node (v18 LTS)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

Then download the challenge to your computer and install dependencies by running:

```sh
npx create-eth@0.1.0 -e lending-challenge lending-challenge
cd lending-challenge
```

> in the same terminal, start your local network (a blockchain emulator in your computer):

```sh
yarn chain
```

> in a second terminal window, 🛰 deploy your contract (locally):

```sh
cd lending-challenge
yarn deploy
```

> in a third terminal window, start your 📱 frontend:

```sh
cd lending-challenge
yarn start
```

📱 Open http://localhost:3000 to see the app.

> 👩‍💻 Rerun `yarn deploy` whenever you want to deploy new contracts to the frontend. If you haven't made any contract changes, you can run `yarn deploy --reset` for a completely fresh deploy.

---

## Checkpoint 1: 💳🌽 Lending Contract

Navigate to the `Debug Contracts` tab, you should see four smart contracts displayed called `Corn`, `CornDEX`, `Lending` and `MovePrice`. You don't need to worry about any of these except `Lending` but here is a quick description of each:
    - Corn ~ This is the ERC20 token that can be borrowed
    - CornDEX ~ This is the DEX contract that is used to swap between ETH and CORN but is also used as a makeshift price oracle
    - Lending ~ This is the contract that facilitates collateral depositing, loan creation and liquidation of loans in bad positions
    - MovePrice ~ This contract is only used for making large swaps in the DEX to change the asset ratio, changing the price reported by the DEX

`packages/hardhat/contracts/Lending.sol` Is where you will spend most of your time.

> Below is what your front-end will look like with no implementation code within your smart contracts yet. The buttons will likely break because there are no functions tied to them yet!

![ch-4-main](TODO: Add image of debug contracts)

> Check out the empty function in `Lending.sol` to see aspects of each function. If you can explain how each function will work with one another, that's great! 😎

---

### 🥅 Goals

- [ ] Review all the `Lending.sol` functions and envision how they might work together.

---

## Checkpoint 2: ➕ Adding and Removing Collateral

👀 Let's take a look at the `addCollateral` function inside `Lending.sol`. 

It should revert with `Lending_InvalidAmount()` if somebody calls it without value.

It needs to record any value that gets sent to it as being collateral posted by the sender into an existing mapping called `s_userCollateral`.

Let's also emit the `CollateralAdded` event with depositor address, amount they deposited and the `i_cornDEX.currentPrice()` which is the current value of ETH in CORN.
 > ⚠️ We are emitting the price returned by the DEX in every event solely for the front end to be able to visualize things properly.

Very good! Now let's look at the `withdrawCollateral` function. Don't want to send funds in if they can't be retrieved, now do we?!

Let's revert with `Lending_InvalidAmount()` right at the start if someone attempts to use the function with the `amount` parameter set to 0. We also want to revert if the sender doesn't have the `amount` of collateral they are requesting.

Now let's reduce the senders collateral (in the mapping) and send it back to their address.

Emit `CollateralWithdrawn` with the senders address, the amount they withdrew and the `currentPrice` from the DEX.

Excellent! Re-deploy your contract with `yarn deploy` but first shut down and restart `yarn chain`. We want to do a fresh deploy of all the contracts so that they each have correct constructor parameters. Now try out your methods from the front end and see if you need to make any changes.

Don't forget to give yourself some ETH from the faucet!
TODO: Add faucet screen shot

---

### 🥅 Goals

- [ ] Can you add collateral and withdraw collateral?
- [ ] Does the front end update when you do each action?

---

## Checkpoint 3: 🫶 Helper Methods

Now we need to add three methods that we will use in other functions to get various details about a users debt position.

Let's start with `calculateCollateralValue`. This function receives the address of the user in question and returns a uint256 representing the ETH collateral in CORN.

We know how to get the user's collateral and we know the price in CORN is returned by `i_cornDEX.currentPrice()`. Can you figure out how to return the collateral value in CORN?

<details markdown='1'><summary>🔎 Hint 1</summary>

> This method just needs to return the users collateral multiplied by the price of CORN (`i_cornDEX.currentPrice()`) *divided by 1e18* (since that is how many decimals CORN has).

<details markdown='1'><summary>Solution Code</summary>

```solidity
function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user]; // Get user's collateral amount
        return (collateralAmount * i_cornDEX.currentPrice()) / 1e18; // Calculate collateral value in terms of ETH price
    }
```

</details>
</details>

Let's turn our attention to the internal `_calculatePositionRatio` view function.

This function takes a user address and returns what we are calling the "position ratio". This is the percentage difference

### 🥅 Goals

- [ ] Can you send value from the RiggedRoll contract to your front end address?
- [ ] Is anyone able to call the withdraw function? What would be the downside to that?

### ⚔️ Side Quest

- [ ] Lock the withdraw function so it can only be called by the owner.

![WithdrawOnlyOwner](https://github.com/scaffold-eth/se-2-challenges/assets/55535804/e8397b1e-a077-4009-b518-30a6d8deb6e7)

> ⚠️ But wait, I am not the owner! You will want to set your front end address as the owner in `01_deploy_riggedRoll.ts`. This will allow your front end address to call the withdraw function.

## Checkpoint 4: 💾 Deploy your contracts! 🛰

📡 Edit the `defaultNetwork` to [your choice of public EVM networks](https://ethereum.org/en/developers/docs/networks/) in `packages/hardhat/hardhat.config.ts`

🔐 You will need to generate a **deployer address** using `yarn generate` This creates a mnemonic and saves it locally.

👩‍🚀 Use `yarn account` to view your deployer account balances.

⛽️ You will need to send ETH to your **deployer address** with your wallet, or get it from a public faucet of your chosen network.

🚀 Run `yarn deploy` to deploy your smart contract to a public network (selected in `hardhat.config.ts`)

> 💬 Hint: You can set the `defaultNetwork` in `hardhat.config.ts` to `sepolia` or `optimismSepolia` **OR** you can `yarn deploy --network sepolia` or `yarn deploy --network optimismSepolia`.

---

## Checkpoint 5: 🚢 Ship your frontend! 🚁

✏️ Edit your frontend config in `packages/nextjs/scaffold.config.ts` to change the `targetNetwork` to `chains.sepolia` (or `chains.optimismSepolia` if you deployed to OP Sepolia)

💻 View your frontend at http://localhost:3000 and verify you see the correct network.

📡 When you are ready to ship the frontend app...

📦 Run `yarn vercel` to package up your frontend and deploy.

> You might need to log in to Vercel first by running `yarn vercel:login`. Once you log in (email, GitHub, etc), the default options should work.

> If you want to redeploy to the same production URL you can run `yarn vercel --prod`. If you omit the `--prod` flag it will deploy it to a preview/test URL.

> Follow the steps to deploy to Vercel. It'll give you a public URL.

> 🦊 Since we have deployed to a public testnet, you will now need to connect using a wallet you own or use a burner wallet. By default 🔥 `burner wallets` are only available on `hardhat` . You can enable them on every chain by setting `onlyLocalBurnerWallet: false` in your frontend config (`scaffold.config.ts` in `packages/nextjs/`)

#### Configuration of Third-Party Services for Production-Grade Apps.

By default, 🏗 Scaffold-ETH 2 provides predefined API keys for popular services such as Alchemy and Etherscan. This allows you to begin developing and testing your applications more easily, avoiding the need to register for these services.
This is great to complete your **SpeedRunEthereum**.

For production-grade applications, it's recommended to obtain your own API keys (to prevent rate limiting issues). You can configure these at:

- 🔷`ALCHEMY_API_KEY` variable in `packages/hardhat/.env` and `packages/nextjs/.env.local`. You can create API keys from the [Alchemy dashboard](https://dashboard.alchemy.com/).

- 📃`ETHERSCAN_API_KEY` variable in `packages/hardhat/.env` with your generated API key. You can get your key [here](https://etherscan.io/myapikey).

> 💬 Hint: It's recommended to store env's for nextjs in Vercel/system env config for live apps and use .env.local for local testing.

---

## Checkpoint 6: 📜 Contract Verification

Run the `yarn verify --network your_network` command to verify your contracts on etherscan 🛰

👉 Search this address on [Sepolia Etherscan](https://sepolia.etherscan.io/) (or [Optimism Sepolia Etherscan](https://sepolia-optimism.etherscan.io/) if you deployed to OP Sepolia) to get the URL you submit to 🏃‍♀️[SpeedRunEthereum.com](https://speedrunethereum.com).

---

> 🏃 Head to your next challenge [here](https://speedrunethereum.com).

> 💬 Problems, questions, comments on the stack? Post them to the [🏗 scaffold-eth developers chat](https://t.me/joinchat/F7nCRK3kI93PoCOk)