const features = [
  {
    title: "Mine",
    image: "/images/Mine.png",
    text: "Turn your collection of miners into a powerhouse and earn $Ronin Gems.",
  },
  {
    title: "Staking",
    image: "/images/Staking.png",
    text: "Stake your $Ronin Gem to earn GEMx and unlock exclusive royalty rewards",
  },
  {
    title: "Royalties",
    image: "/images/Royalties.png",
    text: "Earn 30% of secondary sales by participating in the royalty program.",
  },
  {
    title: "DAO",
    image: "/images/Dao.png",
    text: "Use $GEMx to vote on game changing decisions.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="py-24 bg-gradient-to-b from-[#2a1a0c] to-[#3a2410] scroll-mt-24 relative z-10"
    >
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold mb-12 text-center text-amber-400 font-winky">
          More Than Just a Mining Game
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-[#2a1a0c] p-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-[1.02] flex flex-col items-center transition"
            >
              <h3 className="text-2xl font-bold mb-6 text-amber-400 font-winky">
                {f.title}
              </h3>
              <div className="w-48 h-48 mb-6">
                <img
                  src={f.image}
                  alt={f.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <p className="text-amber-200 text-center font-body">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
