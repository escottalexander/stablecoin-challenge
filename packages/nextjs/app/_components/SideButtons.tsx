import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CollateralOperations from "./CollateralOperations";
import MintOperations from "./MintOperations";
import StakeOperations from "./StakeOperations";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { ChartBarIcon, CurrencyDollarIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { tokenName } from "~~/utils/constant";

type ButtonType = "collateral" | "mint" | "stake";

interface ButtonConfig {
  id: ButtonType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}

const BUTTONS: ButtonConfig[] = [
  { id: "collateral", icon: ChartBarIcon, title: "Collateral" },
  { id: "mint", icon: CurrencyDollarIcon, title: "Mint" },
  { id: "stake", icon: LockClosedIcon, title: "Stake" },
];

const HOVER_DELAY = 100;

const SideButton: React.FC<{
  config: ButtonConfig;
  isHovered: boolean;
  onHover: (id: ButtonType) => void;
  onLeave: () => void;
}> = React.memo(({ config, isHovered, onHover, onLeave }) => {
  const Icon = config.icon;
  return (
    <button
      className={`btn btn-circle btn-primary transition-transform duration-300 hover:scale-110 ${isHovered ? "ring-2 ring-primary" : ""}`}
      onMouseEnter={() => onHover(config.id)}
      onMouseLeave={onLeave}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
});

const SideButtons: React.FC = () => {
  const { address } = useAccount();
  const transferModalId = `${tokenName}-transfer-modal`;
  const swapModalId = `${tokenName}-swap-modal`;
  const [hoveredButton, setHoveredButton] = useState<ButtonType | null>(null);
  const [isHoveringModal, setIsHoveringModal] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const { data: stablecoinBalance } = useScaffoldReadContract({
    contractName: "MyUSD",
    functionName: "balanceOf",
    args: [address],
  });

  const { data: ethPrice } = useScaffoldReadContract({
    contractName: "Oracle",
    functionName: "getPrice",
  });

  const myUSDPrice = useMemo(() => 1 / (Number(formatEther(ethPrice || 0n)) / 1800), [ethPrice]);

  const tokenBalance = useMemo(
    () => `${Math.floor(Number(formatEther(stablecoinBalance || 0n)) * 100) / 100}`,
    [stablecoinBalance],
  );

  const handleButtonHover = useCallback((buttonId: ButtonType) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredButton(buttonId);
  }, []);

  const handleButtonLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      if (!isHoveringModal) {
        setHoveredButton(null);
      }
    }, HOVER_DELAY);
  }, [isHoveringModal]);

  const handleModalHover = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsHoveringModal(true);
  }, []);

  const handleModalLeave = useCallback(() => {
    setIsHoveringModal(false);
    timeoutRef.current = setTimeout(() => {
      setHoveredButton(null);
    }, HOVER_DELAY);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const modalPosition = useMemo(() => {
    if (!hoveredButton) return "0";
    const buttonIndex = BUTTONS.findIndex(btn => btn.id === hoveredButton);
    return `${buttonIndex * 56 + 20}px`;
  }, [hoveredButton]);

  const renderModalContent = useCallback(() => {
    if (!hoveredButton) return null;

    switch (hoveredButton) {
      case "collateral":
        return <CollateralOperations />;
      case "mint":
        return <MintOperations />;
      case "stake":
        // TODO: Add stake operations
        return <StakeOperations />;
      default:
        return null;
    }
  }, [hoveredButton, tokenBalance, address, ethPrice, myUSDPrice, transferModalId, swapModalId]);

  return (
    <div className="absolute top-[120px] right-0 bg-base-100 w-fit border-base-300 border shadow-md rounded-xl z-5">
      <div className="relative">
        <div className="p-4 flex flex-col items-center gap-2">
          {BUTTONS.map(config => (
            <SideButton
              key={config.id}
              config={config}
              isHovered={hoveredButton === config.id}
              onHover={handleButtonHover}
              onLeave={handleButtonLeave}
            />
          ))}
        </div>

        {/* Hover Windows */}
        <div
          className={`absolute top-0 right-full mr-4 transition-all duration-300 z-10 ease-in-out ${hoveredButton ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"}`}
          onMouseEnter={handleModalHover}
          onMouseLeave={handleModalLeave}
          style={{ top: modalPosition }}
        >
          {renderModalContent()}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SideButtons);
