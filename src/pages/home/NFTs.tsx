const nftItems = [
  {
    title: "Miner",
    image: "/images/Miner.png",
    text: "Miners are the game's main asset. Send them on expeditions to earn $Ronin Gems."
  },
  {
    title: "Pass",
    image: "/images/guild_pass.png",
    text: "Guild Founder Passes let you create your own guild and unlock access to an exclusive mining zone—where other players without a Miner NFT can mine on your behalf."
  },
  {
    title: "Boost",
    image: "/images/Boost.png",
    text: "Boost NFTs grant bonus rewards upon returning from expeditions."
  }
]

export default function NFTs() {
  return (
    <section id="nfts" className="py-24 bg-gradient-to-b from-[#3a2410] to-[#2a1a0c] scroll-mt-24 relative z-10">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold mb-12 text-center text-amber-400 font-winky">NFTs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {nftItems.map((nft, index) => (
            <div
              key={index}
              className="bg-[#2a1a0c] p-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-[1.02] flex flex-col items-center transition"
            >
              <h3 className="text-2xl font-bold mb-6 text-amber-400 font-winky">{nft.title}</h3>
              <div className="w-60 h-60 mb-6">
                <img
                  src={nft.image}
                  alt={nft.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <p className="text-amber-200 text-center font-body">{nft.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
