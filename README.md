# 💵 MyUSD Stablecoin

![hero-stablecoin](public/hero-stablecoin.png)

> 💰 Build your own decentralized stablecoin! In this challenge, you'll build the core engine for **MyUSD**, a crypto-backed stablecoin designed to maintain a peg to $1 USD. You'll get to wear the hat of a DeFi protocol that wants to maintain price stability while also increasing adoption of your stablecoin product, diving deep into concepts like collateralization, minting, burning, interest rates, and liquidations – all crucial components of a robust stablecoin system.

<details markdown='1'><summary>❓ Wondering what a stablecoin is? Read the overview here.</summary>

Stablecoins are cryptocurrencies designed to maintain a stable value relative to a specific asset (in our case, $1 USD). In some ways they serve as a bridge between traditional finance and crypto, providing stability in an otherwise volatile market.

🤔 How do they maintain their peg? There are several mechanisms:

- 💎 **Collateralization**: Users lock up valuable assets (like ETH) as collateral to mint stablecoins. This ensures each stablecoin is backed by real value.
- 📊 **Interest Rates**: By adjusting borrowing and savings rates, we can influence supply and demand to maintain the peg.
- 🚨 **Liquidations**: If collateral value drops too low, positions can be liquidated to protect the system.
- 💸 **Market Operations**: The system can incentivize buying or selling to maintain the peg.

👍 Now that you understand the basics, let's build our own stablecoin system!

</details>

First we should mention there are lots of different types of stablecoins on the market. Some are backed 1-1 with actual USD denominated assets in a bank (USDC, USDT). Others are backed by crypto and use special mechanisms to maintain their peg (Dai, RAI, LUSD/BOLD).

This challenge is modeled after one of the first crypto-backed stablecoins called Dai - back when the only thing backing it was ETH. Later Dai would allow multiple types of collateral and change it's design somewhat so the version we are building is commonly referred to as "single collateral Dai".

You are highly encouraged to have completed the Over-collateralized Lending challenge prior to attempting this one since we will be building on that same basic system.

---

## Checkpoint 0: 📦 Environment 📚

🛠️ Before you begin, you need to install the following tools:

- [Node (v18 LTS)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

📥 Then download the challenge to your computer and install dependencies by running:

```sh
npx create-eth@latest -e challenge-stablecoin challenge-stablecoin 
cd challenge-stablecoin
```

> 💻 In the same terminal, start your local network (a blockchain emulator in your computer):

```sh
yarn chain
```

> 🛰️ In a second terminal window, deploy your contract (locally):

```sh
cd challenge-stablecoin
yarn deploy
```

> 📱 In a third terminal window, start your frontend:

```sh
cd challenge-stablecoin
yarn start
```

📱 Open http://localhost:3000 to see the app.

> 👩‍💻 Rerun `yarn deploy` whenever you want to deploy new contracts to the frontend. If you haven't made any contract changes, you can run `yarn deploy --reset` for a completely fresh deploy.

---

## Checkpoint 1: 🎯 System Overview

Let's understand the key components and mechanics of our stablecoin system.

These are located in `packages/hardhat/contracts`. Go check them out now!

### Core Components

1. **MyUSD Token (`MyUSD.sol`)**
   - The actual stablecoin token (ERC20)
   - Can be minted and burned only by the engine

2. **Engine (`MyUSDEngine.sol`)**
   - This is what *you* will be editing
   - Core contract managing the stablecoin system
   - Handles collateral deposits (ETH)
   - Controls minting/burning of MyUSD
   - Manages interest rates and liquidations
   - Enforces collateralization requirements

3. **Oracle (`Oracle.sol`)**
   - Provides ETH/MyUSD and ETH/USD price feeds
   - ETH/USD price is **fixed** at time you deploy the contracts
   - We did this to simplify all the potential "moving pieces" and minimize the learning curve

4. **Staking (`MyUSDStaking.sol`)**
   - Allows users to stake MyUSD
   - Earns yield from borrow rates
   - Creates buy pressure for MyUSD

5. **Rate Controller**
   - Manages borrow and savings rates
   - Key tool for maintaining the $1 peg

This system creates a stablecoin where we have two levers to pull in order to maintain the peg.

---

## Checkpoint 2: 🧱 Depositing Collateral & Understanding Value

First, users need a way to deposit collateral (ETH) into the system. We also need to know the USD value of this collateral.

Open the `packages/hardhat/contracts/MyUSDEngine.sol` file to begin adding the logic to the existing (empty) methods.

### ✏️ Tasks:

1.  **Implement `addCollateral()`**
    *   This function is `payable`, so it will receive ETH (`msg.value`).
    *   It should update the `s_userCollateral` mapping for `msg.sender` to reflect how much ETH they sent the contract.
    *   It should emit a `CollateralAdded` event.
    *   Don't forget to revert if `msg.value` is zero using `Engine__InvalidAmount()`.

    <details markdown='1'>
    <summary>💡 Hint: Adding Collateral</summary>

    This is a simple function that:
    - Receives ETH via `msg.value`
    - Updates a mapping to track how much ETH each user has deposited
    - Emits an event for tracking
    
    Remember to:
    - Check for zero value
    - Use the existing mapping
    - Include the current ETH price (in MyUSD) in the event
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function addCollateral() public payable {
        if (msg.value == 0) revert Engine__InvalidAmount();
        
        s_userCollateral[msg.sender] += msg.value;
        emit CollateralAdded(msg.sender, msg.value, i_oracle.getETHMyUSDPrice());
    }
    ```

    </details>
    </details>

2.  **Implement `calculateCollateralValue(address user)`**
    *   This function should return the total USD value of the ETH collateral held by a `user`.
    *   Use `i_oracle.getETHMyUSDPrice()` to get the current price of ETH in MyUSD (it returns price with 1e18 precision).
    *   The collateral amount `s_userCollateral[user]` is in wei (1e18 wei = 1 ETH).
    *   Calculation: `(collateralAmount * ethPrice) / PRECISION`.

    <details markdown='1'>
    <summary>💡 Hint: Calculating Collateral Value</summary>
    This function converts ETH to USD value:
    - Get the user's ETH amount from the mapping
    - Get the current ETH price from the oracle
    - Multiply them together and divide by PRECISION
    
    Think about:
    - Why we need to divide by PRECISION
    - What units the oracle price is in
    - What units the collateral amount is in
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function calculateCollateralValue(address user) public view returns (uint256) {
        uint256 collateralAmount = s_userCollateral[user];
        return (collateralAmount * i_oracle.getETHMyUSDPrice()) / PRECISION;
    }
    ```
    </details>
    </details>

Go ahead and re-deploy your contracts with `yarn deploy --reset` and test your front-end to see if you can add collateral. 

On the right side of the screen you will see a three icon menu. Hover the top icon to make the collateral menu appear.

[TODO: SHOW IMAGE COLLATERAL OPERATIONS MENU]

### 🥅 Goals:

- [ ] Users can send ETH to contract using the `addCollateral` function.
- [ ] `s_userCollateral` correctly tracks the amount of ETH deposited by each user.
- [ ] `calculateCollateralValue` returns the correct USD value of a user's collateral.
- [ ] The frontend should update to show your address has performed an action.

---

## Checkpoint 3: 💰 Interest Calculation System

Now that users can deposit collateral, we need to set up the interest calculation system before we can let them mint MyUSD. This system uses a share-based approach to efficiently track interest accrual. Unlike traditional systems where interest is used as revenue, our stablecoin uses interest rates as a tool to maintain the peg - higher rates discourage borrowing when the price is below $1, helping to destroy demand for loans and pushing the price back up.

> [!NOTE]
> The complexity starts to go up from here so pay close attention.

To handle interest accrual efficiently, we use a **share-based** system. Instead of updating every user's balance when interest accrues, we use two key variables:
- `debtExchangeRate`: How much MyUSD each share is worth
- `lastUpdateTime`: When we last updated the exchange rate

Here's how it works:

1. When Bob mints 100 MyUSD, he gets 100 shares (1 share = 1 MyUSD initially)
2. After a year at 10% interest:
   - Bob still has 100 shares
   - But each share is now worth 1.1 MyUSD
   - So he owes 110 MyUSD total (100 shares × 1.1 exchange rate)
3. Now if Alice mints 100 MyUSD:
   - She gets 90.91 shares (100 MyUSD ÷ 1.1 exchange rate)
   - These shares are worth 100 MyUSD at the current rate
   - But she won't owe interest on the first year's debt

The exchange rate only updates when the borrow rate changes, and we calculate any new interest based on the time since the last update.

<details markdown='1'>
<summary>💡 Hint: Understanding Shares and Exchange Rate</summary>
Think of shares like a "debt token" that represents a portion of the total debt pool. The exchange rate tells us how much MyUSD each share is worth. As interest accrues, the exchange rate increases, making each share worth more MyUSD. This way, we don't need to update every user's balance - we just update the exchange rate.
</details>

Keep in mind, in the absence of decimals we will assume that a borrow rate of 125 is equivalent to a 1.25% annual rate. This will mean we need to multiply by 10000
### ✏️ Tasks:

1.  **Implement `_getCurrentExchangeRate()`**
    *   Calculate what the `debtExchangeRate` would be if interest were accrued right now.
    *   If `totalDebtShares` is 0, return current `debtExchangeRate`.
    *   Calculate interest based on total debt value and time elapsed. This will require multiplying the total debt by the borrow rate and the time elapsed since the last update but you will need to divide by `SECONDS_PER_YEAR` and 100% (`10000`)
    *   Return the current exchange rate which should be the existing exchange rate + interest (in shares, not value *which is what we figured above*)

    <details markdown='1'>
    <summary>💡 Hint: Calculating Current Exchange Rate</summary>
    You need to calculate how much interest has accrued since the last update. Think about:
    - How much time has passed since `lastUpdateTime`
    - What the total debt value is currently (`totalDebtShares` x `debtExchangeRate`)
    - How much interest that debt has earned at the current `borrowRate`
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function _getCurrentExchangeRate() internal view returns (uint256) {
        if (totalDebtShares == 0) return debtExchangeRate;
        
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        if (timeElapsed == 0 || borrowRate == 0) return debtExchangeRate;
        
        uint256 totalDebtValue = (totalDebtShares * debtExchangeRate) / PRECISION;
        uint256 interest = (totalDebtValue * borrowRate * timeElapsed) / (SECONDS_PER_YEAR * 10000);
        
        return debtExchangeRate + (interest * PRECISION) / totalDebtShares;
    }
    ```

    </details>
    </details>

2.  **Implement `_accrueInterest()`**
    *   Update `debtExchangeRate` using `_getCurrentExchangeRate()`.
    *   Update `lastUpdateTime` to current timestamp.

    <details markdown='1'>
    <summary>💡 Hint: Accruing Interest</summary>
    This function updates the exchange rate to include accrued interest:
    - Get the new exchange rate
    - Update the stored rate
    - Update the timestamp
    
    Remember to:
    - Handle the case where there are no debt shares
    - Update both the exchange rate and timestamp
    - Use the helper function we just created (`_getCurrentExchangeRate()`)
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function _accrueInterest() internal {
        if (totalDebtShares == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }
        
        debtExchangeRate = _getCurrentExchangeRate();
        lastUpdateTime = block.timestamp;
    }
    ```

    </details>
    </details>

3.  **Implement `_getMyUSDToShares(uint256 amount)`**
    *   Convert a MyUSD `amount` into the equivalent number of `debtShares`.
    *   Use `_getCurrentExchangeRate()` to get the current rate.

    <details markdown='1'>
    <summary>💡 Hint: Converting MyUSD to Shares</summary>
    Think about this like a currency conversion:
    - If 1 share = 1.1 MyUSD (exchange rate)
    - Then 100 MyUSD = 100/1.1 shares
    
    You need to:
    - Get the current exchange rate
    - Use it to calculate how many shares represent the given amount
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function _getMyUSDToShares(uint256 amount) internal view returns (uint256) {
        uint256 currentExchangeRate = _getCurrentExchangeRate();
        return (amount * PRECISION) / currentExchangeRate;
    }
    ```

    </details>
    </details>

### 🥅 Goals:

- [ ] Interest accrues correctly based on time elapsed and borrow rate
- [ ] Exchange rate updates properly when interest accrues
- [ ] Shares are calculated correctly based on current exchange rate
- [ ] The system handles edge cases (no shares, zero interest, etc.)

Nothing material to test on the frontend but you may need to return to these helper methods you just created if something isn't working as expected later.

---

## Checkpoint 4: 💰 Minting MyUSD & Position Health

Now that we have our interest calculation system in place, we can implement the minting functionality. Users should be able to mint MyUSD against their collateral, but we must ensure they don't mint too much, keeping the system over-collateralized. This is where the `COLLATERAL_RATIO` (150%) comes in.

### ✏️ Tasks:

1.  **Implement `getCurrentDebtValue(address user)`**
    *   This function calculates how much MyUSD a user actually owes, including interest.
    *   If user has no shares (`s_userDebtShares[user] == 0`), return 0.
    *   Get the current exchange rate using `_getCurrentExchangeRate()`.
    *   Calculate: `(s_userDebtShares[user] * currentExchangeRate) / PRECISION`.
    *   This represents the total debt value including accrued interest.

    <details markdown='1'>
    <summary>💡 Hint: Calculating Current Debt Value</summary>
    This is the inverse of `_getMyUSDToShares`:
    - If we know how many shares a user has
    - And we know the current exchange rate
    - We can calculate their total debt value
    
    Remember to handle the case where a user has no shares!
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function getCurrentDebtValue(address user) public view returns (uint256) {
        if (s_userDebtShares[user] == 0) return 0;
        uint256 currentExchangeRate = _getCurrentExchangeRate();
        return (s_userDebtShares[user] * currentExchangeRate) / PRECISION;
    }
    ```

    </details>
    </details>

2.  **Implement `calculatePositionRatio(address user)`**
    *   This function calculates a user's collateralization ratio.
    *   Get the user's current debt value using `getCurrentDebtValue(user)`.
    *   Get the user's collateral value using `calculateCollateralValue(user)`.
    *   If debt value is 0, return `type(uint256).max` (infinite ratio).
    *   Calculate: `(collateralValue * PRECISION) / debtValue`.
    *   This ratio must stay above 150% to keep the position safe.

    <details markdown='1'>
    <summary>💡 Hint: Calculating Position Ratio</summary>
    The position ratio is like a health score for a user's position:
    - Higher ratio = safer position
    - Lower ratio = riskier position
    
    Think about:
    - What happens if someone has no debt?
    - How to handle division by zero
    - Why we need to multiply by `PRECISION` before dividing
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function calculatePositionRatio(address user) public view returns (uint256) {
        uint256 debtValue = getCurrentDebtValue(user);
        if (debtValue == 0) return type(uint256).max;
        
        uint256 collateralValue = calculateCollateralValue(user);
        return (collateralValue * PRECISION) / debtValue;
    }
    ```

    </details>
    </details>

3.  **Implement `_validatePosition(address user)`**
    *   This internal view function uses the last function and it reverts if the position is unsafe
    *   Get the position ratio using `calculatePositionRatio(user)`.
    *   A position is safe if `(positionRatio * 100) >= (COLLATERAL_RATIO * PRECISION)`.
    *   If unsafe, revert with `Engine__UnsafePositionRatio()`.

    <details markdown='1'>
    <summary>💡 Hint: Validating Position Safety</summary>
    This is a simple check that uses the position ratio:
    - Get the ratio
    - Compare it to the required ratio (150%)
    - Revert if it's too low
    
    Remember to handle the precision correctly when comparing!
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function _validatePosition(address user) internal view {
        uint256 positionRatio = calculatePositionRatio(user);
        if ((positionRatio * 100) < COLLATERAL_RATIO * PRECISION) {
            revert Engine__UnsafePositionRatio();
        }
    }
    ```

    </details>
    </details>

4.  **Implement `mintMyUSD(uint256 mintAmount)`**
    *   Finally get to mint some stablecoin tokens against your collateral!
    *   Revert with `Engine__InvalidAmount()` if `mintAmount` is 0.
    *   Calculate how many shares this mint amount represents using `_getMyUSDToShares(mintAmount)`.
    *   Update the user's debt shares: `s_userDebtShares[msg.sender] += shares`.
    *   Update total debt shares: `totalDebtShares += shares`.
    *   Validate the position is safe using `_validatePosition(msg.sender)`.
    *   Mint the MyUSD tokens to the user.
    *   Emit `DebtSharesMinted` event with the amount and shares.

    <details markdown='1'>
    <summary>💡 Hint: Minting MyUSD</summary>
    This function ties everything together:
    - Convert the mint amount to shares
    - Update the user's and total shares
    - Check if the position is still safe
    - Mint the actual tokens
    
    Remember to:
    - Check for zero amount
    - Update both share mappings
    - Validate before minting
    - Emit the event
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>

    ```solidity
    function mintMyUSD(uint256 mintAmount) public {
        if (mintAmount == 0) revert Engine__InvalidAmount();
        
        uint256 shares = _getMyUSDToShares(mintAmount);
        s_userDebtShares[msg.sender] += shares;
        totalDebtShares += shares;
        
        _validatePosition(msg.sender);
        i_myUSD.mintTo(msg.sender, mintAmount);
        
        emit DebtSharesMinted(msg.sender, mintAmount, shares);
    }
    ```

    </details>
    </details>

### 🥅 Goals:

- [ ] Users can mint MyUSD up to the allowed collateralization limit (150%).
- [ ] The share-based system correctly tracks debt including interest.
- [ ] `getCurrentDebtValue` shows the true amount owed including interest.
- [ ] `calculatePositionRatio` correctly reflects position health.
- [ ] The frontend should allow minting and show the MyUSD balance and position ratio.

---

## Checkpoint 5: 📈 Accruing Interest & Managing Borrow Rates

Now lets set up the ability for the rate controller to change the borrow rate.

Whenever the rate is changed we need to "lock-in" all the interest accrued since the last rate change using the `_accrueInterest` method we created in checkpoint 2.

### ✏️ Tasks:

1.  **Implement `setBorrowRate(uint256 newRate)`**
    *   Allow the `i_rateController` to change the annual `borrowRate`.
    *   Run `_accrueInterest()` to update the `debtExchangeRate`
    *   Update `borrowRate` and emit event.

    <details markdown='1'>
    <summary>💡 Hint: Setting Borrow Rate</summary>
    This function lets the rate controller adjust the borrow rate:
    - Check if caller is the rate controller
    - Run `_accrueInterest()`
    - Update the rate
    - Emit an event
    
    Remember to:
    - Use the modifier for access control
    - Emit the event with the new rate
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function setBorrowRate(uint256 newRate) external onlyRateController {
        _accrueInterest();
        borrowRate = newRate;
        emit BorrowRateUpdated(newRate);
    }
    ```
    </details>
    </details>

The funny thing about checking that only the rate controller can change the rate is that *anyone* can use the methods in the `RateController.sol` contract! We did this so that you can easily change rates from the frontend without having to authorize a specific account.

Go try it out on the frontend after redeploying with `yarn deploy --reset`. Click the edit icon next to the borrow rate and set a new rate.

### 🥅 Goals:

- [ ] The borrow rate can be updated

---

## Checkpoint 6: 💸 Repaying Debt & Withdrawing Collateral

Users need to be able to repay their MyUSD debt and withdraw their ETH collateral.

Since debt is always accruing we have decided to use a method (`repayUpTo`) that allows specifying an arbitrary amount *over* the debt that is owed so that a user can cancel their debt completely. If we simply made them specify the exact amount they owed, by the time their transaction was included their debt would have accrued more interest and a very small amount would remain unpaid.

### ✏️ Tasks:

1.  **Implement `repayUpTo(uint256 amount)`**
    *   This function allows a user to repay up to a certain `amount` of their MyUSD debt.
    *   First, convert the MyUSD `amount` the user wants to repay into `amountInShares` using `_getMyUSDToShares(amount)`.
    *   If `amountInShares` is more than the user's `s_userDebtShares[msg.sender]`, they are trying to repay more than they owe. In this case, we cap the repayment at their actual debt by:
        * Setting `amountInShares` to `s_userDebtShares[msg.sender]`
        * Recalculating the actual MyUSD `amount` to be repaid using `getCurrentDebtValue(msg.sender)`
    *   Check if the user has enough MyUSD balance: `i_myUSD.balanceOf(msg.sender) < amount`. Revert with `MyUSD__InsufficientBalance()` if not.
    *   Check if the MyUSD Engine contract has allowance to spend the user's MyUSD: `i_myUSD.allowance(msg.sender, address(this)) < amount`. Revert with `MyUSD__InsufficientAllowance()` if not.
    *   Update `s_userDebtShares[msg.sender]` and `totalDebtShares` by subtracting `amountInShares`.
    *   Burn the MyUSD from the user: `i_myUSD.burnFrom(msg.sender, amount)`.
    *   Emit `DebtSharesBurned`.

    <details markdown='1'>
    <summary>💡 Hint: Repaying Debt</summary>
    This function needs to handle several cases:
    - User wants to repay exactly what they owe
    - User wants to repay more than they owe (we cap at their actual debt)
    - User doesn't have enough balance
    - User hasn't approved enough allowance
    
    Remember to:
    - Convert MyUSD amount to shares first
    - If user tries to repay more than they owe, cap it at their actual debt
    - Update both user's shares and total shares
    - Burn the correct amount of MyUSD
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function repayUpTo(uint256 amount) public {
        uint256 amountInShares = _getMyUSDToShares(amount);
        // Check if user has enough debt
        if (amountInShares > s_userDebtShares[msg.sender]) {
            // will only use the max amount of MyUSD that can be repaid
            amountInShares = s_userDebtShares[msg.sender];
            amount = getCurrentDebtValue(msg.sender);
        }

        // Check balance
        if (amount == 0 || i_myUSD.balanceOf(msg.sender) < amount) {
            revert MyUSD__InsufficientBalance();
        }

        // Check allowance
        if (i_myUSD.allowance(msg.sender, address(this)) < amount) {
            revert MyUSD__InsufficientAllowance();
        }

        // Update user's debt shares and total shares
        s_userDebtShares[msg.sender] -= amountInShares;
        totalDebtShares -= amountInShares;

        i_myUSD.burnFrom(msg.sender, amount);

        emit DebtSharesBurned(msg.sender, amount, amountInShares);
    }
    ```
    </details>
    </details>

2.  **Implement `withdrawCollateral(uint256 amount)`**
    *   Revert with `Engine__InvalidAmount()` if `amount` is 0.
    *   Revert with `Engine__InsufficientCollateral()` if `s_userCollateral[msg.sender] < amount`.
    *   Decrease `s_userCollateral[msg.sender]` by `amount`.
    *   If the user still has debt (`s_userDebtShares[msg.sender] > 0`), call `_validatePosition(msg.sender)` to ensure they are still safely collateralized *after* the withdrawal. If not, the `_validatePosition` will revert (and because you haven't actually transferred ETH yet, the state change to `s_userCollateral` will also be reverted).
    *   If the position is still valid (or they have no debt), transfer the ETH: `payable(msg.sender).transfer(amount);`. Handle potential transfer failure with `Engine__TransferFailed()`.
    *   Emit `CollateralWithdrawn` with the current ETH price.

    <details markdown='1'>
    <summary>💡 Hint: Withdrawing Collateral</summary>
    This function needs to be careful about maintaining the user's position safety:
    - Check if they have enough collateral
    - Temporarily reduce their collateral to check if they'd still be safe
    - Only transfer ETH if the position remains safe
    
    Remember to:
    - Handle the case where user has no debt
    - Use the existing position validation
    - Handle ETH transfer failures
    - Emit the event with the current price
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert Engine__InvalidAmount();
        if (s_userCollateral[msg.sender] < amount) revert Engine__InsufficientCollateral();
        
        // Temporarily reduce the user's collateral to check if they remain safe
        uint256 newCollateral = s_userCollateral[msg.sender] - amount;
        s_userCollateral[msg.sender] = newCollateral;

        // Validate the user's position after withdrawal
        if (s_userDebtShares[msg.sender] > 0) {
            _validatePosition(msg.sender);
        }

        // Transfer the collateral to the user
        payable(msg.sender).transfer(amount);

        emit CollateralWithdrawn(msg.sender, msg.sender, amount, i_oracle.getETHMyUSDPrice());
    }
    ```
    </details>
    </details>

### 🥅 Goals:

- [ ] Users can repay their MyUSD debt. Their `s_userDebtShares` should decrease.
- [ ] Users can withdraw their ETH collateral, provided their position remains safe (above 150% collateralization if they have debt).
- [ ] Attempting to withdraw too much collateral leading to an unsafe position should fail.
- [ ] The frontend should reflect these changes.

Go try it out on the frontend! Re-deploy with `yarn deploy --reset` and go try to do the full deposit, mint/borrow, repay, and withdraw workflow.

---

## Checkpoint 7: 🚨 Liquidation - Enforcing System Stability

What happens if the price of ETH drops or a user's debt accrues too much interest, causing their position to become under-collateralized (below 150%)? This is where liquidations come in. Anyone can trigger a liquidation for an unsafe position.

Liquidations are crucial for maintaining the system's solvency. They ensure that:
1. The system remains over-collateralized at all times
2. Debt is quickly resolved before it becomes "bad debt" (under-collateralized)
3. Users are incentivized to maintain safe positions

### ✏️ Tasks:

1.  **Implement `isLiquidatable(address user)`**
    *   This function checks if a user's position has become unsafe and can be liquidated.
    *   Calculate the user's current position ratio using `calculatePositionRatio(user)`. This will automatically use the current exchange rate to get up-to-date debt values.
    *   Return `true` if `(positionRatio * 100) < COLLATERAL_RATIO * PRECISION`, otherwise `false`.

    <details markdown='1'>
    <summary>💡 Hint: Checking Liquidation Status</summary>
    This function provides an important check for the system:
    - It compares the position's health against the minimum required ratio
    - It's used both by liquidators and by the system to monitor positions
    - It automatically uses current debt values through `calculatePositionRatio`
    
    Think about:
    - How the position ratio relates to the collateral ratio
    - Why we multiply by 100 and compare with COLLATERAL_RATIO * PRECISION
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function isLiquidatable(address user) public view returns (bool) {
        uint256 positionRatio = calculatePositionRatio(user);
        return (positionRatio * 100) < COLLATERAL_RATIO * PRECISION;
    }
    ```
    </details>
    </details>

2.  **Implement `liquidate(address user)`**
    *   This function allows anyone to liquidate an unsafe position by:
        * Paying off the user's debt
        * Receiving their collateral (plus a bonus)
        * Clearing their debt
    *   Check if the position is actually liquidatable using `if (!isLiquidatable(user)) revert Engine__NotLiquidatable();`.
    *   Get `userDebtValue = getCurrentDebtValue(user)`.
    *   Get `userCollateral = s_userCollateral[user]`.
    *   Get `collateralValue = calculateCollateralValue(user)`.
    *   The liquidator (`msg.sender`) must pay off the user's debt. Check if liquidator has enough MyUSD: `i_myUSD.balanceOf(msg.sender) < userDebtValue`. Revert if not.
    *   Check allowance for the engine to burn liquidator's MyUSD: `i_myUSD.allowance(msg.sender, address(this)) < userDebtValue`. Revert if not.
    *   Burn `userDebtValue` of MyUSD from `msg.sender`: `i_myUSD.burnFrom(msg.sender, userDebtValue)`.
    *   Clear the liquidated user's debt: `totalDebtShares -= s_userDebtShares[user]; s_userDebtShares[user] = 0;`.
    *   Calculate how much of the user's collateral the liquidator receives:
        *   `collateralToCoverDebt = (userDebtValue * userCollateral) / collateralValue;` (This is the amount of ETH collateral that has the same USD value as the debt).
        *   `rewardAmount = (collateralToCoverDebt * LIQUIDATOR_REWARD) / 100;`
        *   `amountForLiquidator = collateralToCoverDebt + rewardAmount;`
    *   Ensure `amountForLiquidator` does not exceed `userCollateral`. If it does, cap it at `userCollateral`.
    *   Reduce the liquidated user's collateral: `s_userCollateral[user] -= amountForLiquidator;`.
    *   Transfer `amountForLiquidator` ETH to `msg.sender`. Handle potential transfer failure.
    *   Emit `Liquidation` event.

    <details markdown='1'>
    <summary>💡 Hint: Liquidating Positions</summary>
    This is the core function that maintains system health:
    - It allows anyone to step in and resolve unsafe positions
    - It ensures the liquidator is compensated for their service
    - It protects the system from accumulating bad debt
    
    Key considerations:
    - Always accrue interest first to get current debt values
    - Calculate collateral amounts carefully to maintain system solvency
    - Handle edge cases where collateral might not cover the full debt
    - Ensure proper event emission for off-chain monitoring
    
    <details markdown='1'>
    <summary>🎯 Solution</summary>
    ```solidity
    function liquidate(address user) external {
        if (!isLiquidatable(user)) {
            revert Engine__NotLiquidatable();
        }

        uint256 userDebtValue = getCurrentDebtValue(user);
        uint256 userCollateral = s_userCollateral[user];
        uint256 collateralValue = calculateCollateralValue(user);

        if (i_myUSD.balanceOf(msg.sender) < userDebtValue) {
            revert MyUSD__InsufficientBalance();
        }

        if (i_myUSD.allowance(msg.sender, address(this)) < userDebtValue) {
            revert MyUSD__InsufficientAllowance();
        }

        i_myUSD.burnFrom(msg.sender, userDebtValue);

        totalDebtShares -= s_userDebtShares[user];
        s_userDebtShares[user] = 0;

        uint256 collateralToCoverDebt = (userDebtValue * userCollateral) / collateralValue;
        uint256 rewardAmount = (collateralToCoverDebt * LIQUIDATOR_REWARD) / 100;
        uint256 amountForLiquidator = collateralToCoverDebt + rewardAmount;
        
        if (amountForLiquidator > userCollateral) {
            amountForLiquidator = userCollateral;
        }

        s_userCollateral[user] = userCollateral - amountForLiquidator;

        (bool sent, ) = payable(msg.sender).call{ value: amountForLiquidator }("");
        require(sent, "Failed to send Ether");

        emit Liquidation(user, msg.sender, amountForLiquidator, userDebtValue, i_oracle.getETHMyUSDPrice());
    }
    ```
    </details>
    </details>

### 🥅 Goals:

- [ ] `isLiquidatable` should correctly identify positions below the `COLLATERAL_RATIO`.
- [ ] `liquidate` function should allow a third party to repay a risky user's debt and claim their collateral (with a bonus).
- [ ] The liquidated user's debt should be cleared, and their collateral reduced.
- [ ] The liquidator should receive the correct amount of collateral.
- [ ] Test this by creating a position and borrowing the maximum amount possible, then letting interest accrue by setting a high borrow rate.

<details markdown='1'>
<summary>💡 Hint: Liquidator's Incentive</summary>
The `LIQUIDATOR_REWARD` (10%) incentivizes anyone to monitor the system and liquidate unsafe positions. This creates a market for liquidators who:
- Monitor positions for safety
- Act quickly when positions become unsafe
- Help maintain system health
- Profit from their service

The reward is carefully balanced to:
- Be attractive enough to ensure liquidations happen
- Cover gas costs and provide a reasonable return
- Maintain system solvency
</details>

---

## Checkpoint 8: 🤖 Market Simulation

Now that we have implemented all the core functionality of our stablecoin system, let's see how it behaves in a simulated market environment. The `yarn simulate` script will run several automated bots that simulate different market participants.

We will focus on the borrowing aspect. These bot accounts each have a slow trickle of unlimited funds and they want to use it to get leveraged exposure to ETH. They will deposit collateral, then mint some MyUSD. After that they will take their newly minted MyUSD and swap it for more ETH. This will drive the price of MyUSD down since the only market participants are dumping it in favor of ETH.


### 🚀 Running the Simulation:

1. Make sure your local network is running (`yarn chain`)
2. Deploy your contracts (`yarn deploy --reset`)
3. Run the simulation:
```sh
yarn simulate
```

Watch the console output to see:
- Each bot accounts upper borrow rate limit preference
- The activity of each bot

Watch the frontend to see:
- Our precious MyUSD losing its peg!
- The total supply of MyUSD in circulation increasing

Now Raise the borrow rate to 30%.

What do you notice?
- Bots are exiting their positions
- Total supply drops significantly
- The peg is restored

Now this is just a small example of what a very small group of market participants can do to the price of an asset. 

Is our stablecoin doomed to either have a very small market cap or lose its peg perpetually? Find out in the next section...

### 🥅 Goals:

- [ ] Successfully run the simulation script
- [ ] Observe bullish market activities effect on the market
- [ ] Understand how the system components interact
- [ ] See how rates influence market behavior

---

## Checkpoint 9: ⚖️ The Other Side: Savings Rate & Market Dynamics

So far, we've focused on users borrowing MyUSD (which can create sell pressure if they swap MyUSD for ETH). But we saw how that made the stablecoin lose it's peg pretty quickly.

To maintain the $1 peg, we also need mechanisms to create *buy pressure* for MyUSD. What if we could create an incentive for the market to buy MyUSD instead of just selling it? This is where a **Savings Rate** comes in, managed by the `MyUSDStaking.sol` contract.

Users can stake their MyUSD into `MyUSDStaking.sol` to earn yield. This yield (the savings rate) makes holding MyUSD attractive and provides a new incentive besides leveraged exposure to ETH to use MyUSD.

<details markdown='1'>
<summary>Where does the yield come from?</summary>
No MyUSD can exist that is not paying for the borrow rate so as long as the savings rate is less than or equal to the borrow rate this is sustainable. Maybe you are thinking, "What about all the DEX liquidity?". Even this DEX liquidity is just a large borrower who deposited ETH collateral and has a lot of MyUSD borrowed and supplied to the DEX. Take a look at the <code>packages/hardhat/deploy/00_deploy_contract.ts</code> deploy file to see where the DEX is supplied with liquidity. Technically all of the MyUSD that is accrued from the borrow rate that is not being allocated to stakers should exist <i>somewhere</i> in the system but we decided against adding that to an already complex system. As a result, if everyone (including the DEX liquidity provider) decided to attempt repaying all their debt, they would not be able to do so.
</details>

Now that we understand where the yield comes from, we need to ensure our system can always pay it. Return to your `setBorrowRate` function in `MyUSDEngine.sol` and add a check to ensure the new rate is greater than or equal to the savings rate. This ensures the system can always pay stakers their yield. If the new rate is too low, revert with `Engine__InvalidBorrowRate()`.

<details markdown='1'>
<summary>💡 Hint: Setting Borrow Rate</summary>
The borrow rate must always be high enough to cover the savings rate:
- Get the current savings rate from the staking contract using `i_staking.savingsRate()`
- Compare it with the new borrow rate
- Revert if the borrow rate is too low
- Remember to do this check before accruing interest and updating the rate

<details markdown='1'>
<summary>🎯 Solution</summary>
```solidity
function setBorrowRate(uint256 newRate) external onlyRateController {
    if (newRate < i_staking.savingsRate()) revert Engine__InvalidBorrowRate();
    _accrueInterest();
    borrowRate = newRate;
    emit BorrowRateUpdated(newRate);
}
```
</details>
</details>

For the rest of this checkpoint **you won't need to edit any Solidity**, but you need to understand the interactions.

### 🧠 Concepts & Connections:

1.  **`MyUSDStaking.sol`:** This separate contract (already provided) has a `setSavingsRate(uint256 newRate)` function (callable by its owner, which is also the `RateController` in our setup) and a `savingsRate()` view function. Users would `approve` MyUSD to this contract and call a `stake(uint256 amount)` function on it.
2.  **`RateController.sol`:** This contract (which you can control via the UI/scripts) can call:
    *   `MyUSDEngine.setBorrowRate()`
    *   `MyUSDStaking.setSavingsRate()`
3.  **Constraint in `MyUSDEngine.setBorrowRate()`:**
    *   Remember the line: `if (newRate < i_staking.savingsRate()) revert Engine__InvalidBorrowRate();`
    *   This implies the `borrowRate` in your engine should generally be higher than or equal to the `savingsRate` offered by `MyUSDStaking.sol`. This makes sense: the system needs to earn more from borrowers than it pays out to savers to be sustainable (or to fund other operations).
4.  **The Levers for Peg Stability:**
    *   **High Borrow Rate:** Discourages minting MyUSD (reduces potential sell pressure).
    *   **Attractive Savings Rate:** Encourages buying/holding MyUSD to stake it (creates buy pressure).
    *   Finding the right balance between these rates is key to keeping MyUSD close to $1. If MyUSD is trading below $1, you might increase the savings rate or increase the borrow rate. If MyUSD is above $1, you might decrease the savings rate or decrease the borrow rate.

### 📖 Understanding:

*   Explore the frontend. You should see options to set both the **Borrow Rate** (for `MyUSDEngine`) and the **Savings Rate** (for `MyUSDStaking`).
*   The `DEX.sol` contract provides a simple market where ETH can be swapped for MyUSD. The price on this DEX will reflect the supply and demand for MyUSD.
*   Think about how changing the borrow and savings rates would influence users:
    *   If savings rate is high, people might buy MyUSD on the DEX to stake it, pushing the price up.
    *   If borrow rate is high, people might be less inclined to mint new MyUSD, or might buy MyUSD on the DEX to repay existing loans, reducing sell pressure or creating buy pressure.

### 🥅 Goals:

- [ ] Understand that `MyUSDEngine` and `MyUSDStaking` work together, influenced by rates set via `RateController`.
- [ ] Understand that the savings rate creates an incentive to hold/buy MyUSD.
- [ ] Observe the MyUSD price on the DEX tab of the frontend.

---

## Checkpoint 10: 🤖 Simulation & Finding Equilibrium

Now for the "Aha!" moment. Let's see how these mechanisms play out with simulated market activity and an automated rate controller.

### 🚀 Running Simulations:

1.  **`yarn simulate` Script:**
    *   This script spins up several simulated users (actors).
    *   Some actors will look at the `borrowRate`. If it's attractive, they will deposit ETH and mint MyUSD (potentially selling it on the DEX for more ETH, representing leveraged traders).
    *   Other actors will look at the `savingsRate`. If it's attractive, they will buy MyUSD from the DEX and stake it in `MyUSDStaking.sol`.
    *   Run this script from your `challenge-stablecoin` directory: `yarn simulate`.
    *   Observe your console and the frontend. You should see activity: collateral deposits, MyUSD mints, stakes, and DEX swaps. The MyUSD price on the DEX will fluctuate.
    *   Experiment: Manually set very high or very low borrow/savings rates using the frontend controls (which use `RateController.sol`) while running `yarn simulate`. How does the MyUSD price react?

2.  **`yarn interest-rate-controller` Script:**
    *   This script attempts to automatically adjust the `borrowRate` (in `MyUSDEngine`) and `savingsRate` (in `MyUSDStaking`) to try and bring the MyUSD price on the DEX towards $1.
    *   It will likely observe the DEX price and then make decisions:
        *   If MyUSD < $1: Try to increase savings rate (make holding MyUSD more attractive) or increase borrow rate (make minting MyUSD less attractive).
        *   If MyUSD > $1: Try to decrease savings rate or decrease borrow rate.
    *   Run this script: `yarn interest-rate-controller`.
    *   Observe its actions in the Hardhat console and how the MyUSD price on the DEX responds. Does it manage to stabilize the price near $1?

### 🤔 Key Takeaways:

*   **Demand Destruction:** High borrow rates make minting MyUSD expensive, reducing its supply and potential sell pressure. This is one lever.
*   **Demand Creation:** Attractive savings rates make holding MyUSD (and thus buying it) desirable, increasing demand and buy pressure. This is the other crucial lever.
*   **Dynamic Equilibrium:** The "correct" rates are not fixed; they depend on market conditions and sentiment. This stablecoin system constantly seeks equilibrium by adjusting these incentives.
*   **Arbitrary Rates:** The rates are ultimately set by a controller (in our case, `RateController.sol`, which you can manipulate). Their effectiveness depends on the market's reaction.
*   **Market Unpredictability:** We have only simulated two different types of market participants. Imagine what a real market would be like with thousands, maybe even millions, of participants. All constantly changing as new incentives to buy, sell or hold MyUSD emerge. Also think about how those market demands may change when in a bull market vs bear market.

### 🥅 Goals:

- [ ] Successfully run the `yarn simulate` script and observe market behaviors.
- [ ] Successfully run the `yarn interest-rate-controller` script and observe its attempts to stabilize the MyUSD price.
- [ ] Gain an intuitive understanding of how borrow and savings rates are the primary tools for managing a stablecoin's peg in this type of system.
- [ ] Appreciate that maintaining a peg is an active process of balancing incentives.

---

## Checkpoint 11: 💾 Deploy your contracts! 🛰

Well done on building a stablecoin engine! Now, let's get it on a public testnet.

📡 Edit the `defaultNetwork` to [your choice of public EVM networks](https://ethereum.org/en/developers/docs/networks/) in `packages/hardhat/hardhat.config.ts` (e.g., `sepolia`).

🔐 You will need to generate a **deployer address** using `yarn generate`. This creates a mnemonic and saves it locally.

👩‍🚀 Use `yarn account` to view your deployer account balances.

⛽️ You will need to send ETH to your **deployer address** with your wallet, or get it from a public faucet of your chosen network.

🚀 Run `yarn deploy` to deploy your smart contract to a public network (selected in `hardhat.config.ts`)

> 💬 Hint: You can set the `defaultNetwork` in `hardhat.config.ts` to `sepolia` **OR** you can `yarn deploy --network sepolia`.

---

## Checkpoint 12: 🚢 Ship your frontend! 🚁

✏️ Edit your frontend config in `packages/nextjs/scaffold.config.ts` to change the `targetNetwork` to `chains.sepolia` (or your chosen deployed network).

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

## Checkpoint 13: 📜 Contract Verification

Run the `yarn verify --network your_network` command to verify your contracts on Etherscan 🛰.

👉 Search your deployed `MyUSDEngine` contract address on [Sepolia Etherscan](https://sepolia.etherscan.io/) to get the URL you submit to 🏃‍♀️[SpeedRunEthereum.com](https://speedrunethereum.com).

---

> 🎉 Congratulations on completing the MyUSD Stablecoin Engine Challenge! You've gained valuable insights into the mechanics of decentralized stablecoins.

> 🏃 Head to your next challenge [here](https://speedrunethereum.com).

> 💬 Problems, questions, comments on the stack? Post them to the [🏗 scaffold-eth developers chat](https://t.me/joinchat/F7nCRK3kI93PoCOk)
```
