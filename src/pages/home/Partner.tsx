const partners = [
  {
    image: "/images/partners/hustle.webp",
    href: "https://the-hustle.io/",
    alt: "Hustle Logo",
  },
];

export default function Partner() {
  return (
    <section
      id="partners"
      className="py-24 bg-gradient-to-b from-[#1a0d00] to-[#2a1a0c] relative z-10"
    >
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold mb-12 text-center text-amber-400 font-winky">
          Our Partners
        </h2>

        <div className="flex justify-center">
          {partners.map((partner) => (
            <a
              key={partner.alt}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block p-4"
            >
              <img
                src={partner.image}
                alt={partner.alt}
                className="h-20 w-auto object-contain"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
