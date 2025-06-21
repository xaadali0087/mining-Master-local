import { useState } from "react";
import Hero from "./Hero";
import About from "./About";
import Features from "./Features";
import Modal from "./Modal";
import NFTs from "./NFTs";
import Team from "./Team";
import Partner from "./Partner";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleModal = (open: boolean) => {
    setIsModalOpen(open);
    document.body.style.overflow = open ? "hidden" : "auto";
  };

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const section = document.getElementById(id);
    if (section) {
      const offset = document.querySelector("header")?.offsetHeight || 0;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <>
      {isModalOpen && <Modal onClose={() => toggleModal(false)} />}
      <Hero onScrollTo={scrollToSection} />
      <About />
      <Features />
      <NFTs />
      <Team />
      <Partner />
    </>
  );
}
