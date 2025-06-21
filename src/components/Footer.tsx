export default function Footer() {
    return (
      <footer className="bg-[#1a0d00] text-amber-200 py-12 relative z-10 border-t border-amber-900/30">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <img src="/images/mining-masters-logo.png" alt="Mining Masters" className="h-16 mb-4" />
              <p className="text-amber-300/80 font-body">
                The premier mining adventure on the Ronin Network. Build your mining empire and discover legendary treasures.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-amber-400 font-winky">Quick Links</h3>
              <ul className="space-y-2 font-body">
              {["about", "slogan", "nfts", "team", "whitepaper"].map((id) => (
                <li key={id}>
                  {id === "whitepaper" ? (
                    <a
                      href="https://mining-masters.gitbook.io/whitepaper"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300/80 hover:text-amber-300 transition-colors capitalize"
                    >
                      Whitepaper
                    </a>
                  ) : (
                    <a
                      href={`#${id}`}
                      className="text-amber-300/80 hover:text-amber-300 transition-colors capitalize"
                    >
                      {id}
                    </a>
                  )}
                </li>
              ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-amber-400 font-winky">Connect With Us</h3>
              <div className="flex space-x-4 mb-4">
                <a href="https://discord.gg/H5afqjMykf" className="text-amber-400 hover:text-amber-300" target="_blank" rel="noreferrer">
                  <img src="/icons/discord.svg" alt="Discord" className="w-6 h-6" />
                </a>
                <a href="https://x.com/Mining_Masters" className="text-amber-400 hover:text-amber-300" target="_blank" rel="noreferrer">
                  <img src="/icons/x.svg" alt="X" className="w-6 h-6" />
                </a>
              </div>
              {/* <p className="font-body">
                Email:{" "}
                <a href="mailto:info@miningmasters.io" className="text-amber-400 hover:text-amber-300">
                  info@miningmasters.io
                </a>
              </p> */}
            </div>
          </div>
          <div className="pt-8 border-t border-amber-900/30 text-center">
            <p>© {new Date().getFullYear()} Mining Masters. All rights reserved.</p>
          </div>
        </div>
      </footer>
    )
}
  