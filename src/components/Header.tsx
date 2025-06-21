import { ROUTES } from "@/constants/route";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import WalletConnector from "./WalletConnector";
import { useRoninWallet } from "../services/wallet/RoninWalletProvider";

export default function Header({
  scrolled,
  isMenuOpen,
  setIsMenuOpen,
}: {
  scrolled: boolean;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}) {
  const location = useLocation();
  const isHomePage = location.pathname === ROUTES.HOME;
  
  // Get wallet connection state from RoninWallet provider
  const { isConnected } = useRoninWallet();

  // Handle wallet connection - passes to WalletConnector component
  const handleWalletConnect = async (_address: string, _chainId: number) => {
    // Connection is handled by RoninWalletProvider
    console.log('Wallet connected:', _address, 'Chain ID:', _chainId);
  };

  // Handle wallet disconnection
  const handleWalletDisconnect = () => {
    console.log('Wallet disconnected');
  };

  // Links shown when wallet is not connected (home page links)
  const homeLinks = [
    { id: "about", label: "About", href: `${ROUTES.HOME}#about` },
    { id: "features", label: "Features", href: `${ROUTES.HOME}#features` },
    { id: "nfts", label: "NFTs", href: `${ROUTES.HOME}#nfts` },
    { id: "team", label: "Team", href: `${ROUTES.HOME}#team` },
    { id: "partners", label: "Partners", href: `${ROUTES.HOME}#partners` },
  ];

  // Links shown when wallet is connected (game page links)
  const gameLinks = [
    { id: "bank", label: "Bank", to: ROUTES.BANK },
    { id: "mine", label: "Mine", to: ROUTES.MINE },
    { id: "shop", label: "Shop", to: ROUTES.SHOP },
    { id: "staking", label: "Staking", to: ROUTES.STAKING },
    { id: "leaderboard", label: "Leaderboard", to: ROUTES.LEADERBOARD },
  ];

  // No need to fetch GEMS balance here anymore as it's handled in WalletConnector
  
  useEffect(() => {
    // Handle smooth scrolling when clicking on anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.hash && isHomePage) {
        e.preventDefault();
        const targetElement = document.querySelector(anchor.hash);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
          });
          // Close mobile menu if open
          setIsMenuOpen(false);
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [isHomePage, setIsMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#1a0d00]/95 backdrop-blur-md py-3 shadow-lg"
          : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to={ROUTES.HOME} className="flex items-center">
          <img
            src="/images/mining-masters-logo.png"
            alt="Mining Masters"
            className="h-10"
          />
        </Link>

        <nav className="hidden md:flex space-x-6 items-center">
          {isConnected ? (
            // Show game links when wallet is connected
            gameLinks.map(({ id, label, to }) => (
              <Link
                key={id}
                to={to}
                className="text-amber-400 hover:text-amber-300 text-lg font-medium font-winky transition"
              >
                {label}
              </Link>
            ))
          ) : (
            // Show home links when wallet is not connected
            homeLinks.map(({ id, label, href }) => (
              <a
                key={id}
                href={href}
                className="text-amber-400 hover:text-amber-300 text-lg font-medium font-winky transition"
              >
                {label}
              </a>
            ))
          )}

          {/* Wallet connect button */}
          <WalletConnector 
            onConnect={handleWalletConnect} 
            onDisconnect={handleWalletDisconnect} 
          />
        </nav>

        <div className="md:hidden flex items-center gap-2">
          {/* Mobile wallet connect button */}
          <WalletConnector
            onConnect={handleWalletConnect} 
            onDisconnect={handleWalletDisconnect} 
            className="scale-90"
          />
          
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-amber-400 hover:text-amber-300"
          >
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden mt-6 pb-4 animate-fadeIn">
          <nav className="flex flex-col space-y-5 bg-[#2a1a0c] p-6 rounded-xl shadow-lg">
            {isConnected ? (
              // Show game links when wallet is connected (mobile)
              gameLinks.map(({ id, label, to }) => (
                <Link
                  key={id}
                  to={to}
                  className="text-amber-400 hover:text-amber-300 font-winky text-xl"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {label}
                </Link>
              ))
            ) : (
              // Show home links when wallet is not connected (mobile)
              homeLinks.map(({ id, label, href }) => (
                <a
                  key={id}
                  href={href}
                  className="text-amber-400 hover:text-amber-300 font-winky text-xl"
                >
                  {label}
                </a>
              ))
            )}

            {/* Mobile wallet connector */}
            <div className="mt-2">
              <WalletConnector 
                onConnect={handleWalletConnect} 
                onDisconnect={handleWalletDisconnect} 
                className="self-start"
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
