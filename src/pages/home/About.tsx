export default function About() {
    return (
      <section id="about" className="py-24 relative bg-cover bg-center scroll-mt-24" style={{ backgroundImage: "url('/images/Cave_Gems.png')" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0d00]/30 to-[#1a0d00]/30 z-0"></div>
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-4xl font-bold mb-12 text-center text-amber-400 font-winky">About</h2>
          <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#3a2410] to-[#2a1a0c] p-8 md:p-10 rounded-xl shadow-2xl border border-amber-900/50">
            <p className="text-lg text-amber-200 leading-relaxed font-body">
            In the heart of the Ronin Network lies a land rich with forgotten treasures. The home of the legendary
            mines of $Ronin Gems. Within these ancient depths, a brotherhood of brave adventurers known as Miners
            tirelessly unearth the precious Gems, forging their legacy one expedition at a time. As a Ronin Mining
            Master, you will put together a guild of brave miners, step into a world where every adventure is unique
            and claims your place among the legends.
            </p>
          </div>
        </div>
      </section>
    )
}
  