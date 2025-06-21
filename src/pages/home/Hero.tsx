import { ROUTES } from "@/constants/route";
import { Link } from "react-router-dom";

export default function Hero({
  onScrollTo,
}: {
  onScrollTo: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/ronin_background.png')] bg-cover bg-center opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#3a2410]/30 to-transparent"></div>
      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center max-w-5xl">
        <div className="mb-12 w-full max-w-md animate-fadeInDown">
          <img
            src="/images/mining-masters-logo.png"
            alt="Mining Masters Logo"
            className="w-full h-auto drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-6 mb-16 animate-fadeInUp">
          <Link
            to={ROUTES.MINE}
            className="group flex items-center relative bg-gradient-to-r from-amber-500 to-amber-600 text-[#1a0d00] py-4 px-8 rounded-lg font-winky text-lg shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.5)] transform hover:-translate-y-1"
          >
            Start Mining
          </Link>
          <a
            href="https://mining-masters.gitbook.io/whitepaper"
            target="_blank"
            className="group relative border-2 border-amber-500 text-amber-400 hover:text-amber-300 py-4 px-8 rounded-lg font-winky text-lg transition-all"
          >
            Learn More
          </a>
        </div>
        <div className="mt-8 animate-bounce">
          <a href="#about" onClick={(e) => onScrollTo(e, "about")}>
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
