import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { type EmblaCarouselType } from "embla-carousel";
import { useCallback, useEffect, useRef, useState } from "react";

const teamMembers = [
  {
    name: "TOPSHOTTA",
    role: "Founder",
    image: "/images/Founder.png",
    bio: "Gamer & crypto enthusiast",
  },
  {
    name: "DORODUNK",
    role: "Developer",
    image: "/images/Dev.png",
    bio: "Blockchain enthusiast and game developer with 5+ years experience",
  },
  {
    name: "The Dragon",
    role: "Lead Game Designer",
    image: "/images/dragon.png",
    bio: "Creative visionary with passion for immersive gameplay",
  },
  {
    name: "AfroSamurai",
    role: "Project Manager",
    image: "/images/project_manager.png",
    bio: "Experienced coordinator bringing projects to life on time",
  },
  {
    name: "AlexanderWoolf",
    role: "Backend Developer",
    image: "/images/developer.png",
    bio: "Skilled backend developer with focus on system architecture and database optimization",
  },
];

const TWEEN_FACTOR = 0.52;

const numberWithinRange = (number: number, min: number, max: number): number =>
  Math.min(Math.max(number, min), max);

export default function Team() {
  const [api, setApi] = useState<EmblaCarouselType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tweenFactor = useRef(0);
  const tweenNodes = useRef<HTMLElement[]>([]);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const setTweenNodes = useCallback((emblaApi: EmblaCarouselType): void => {
    tweenNodes.current = emblaApi.slideNodes().map((_, index: number) => {
      return cardsRef.current[index] as HTMLElement;
    });
  }, []);

  const setTweenFactor = useCallback((emblaApi: EmblaCarouselType) => {
    tweenFactor.current = TWEEN_FACTOR * emblaApi.scrollSnapList().length;
  }, []);

  const tweenScale = useCallback((emblaApi: EmblaCarouselType) => {
    const engine = emblaApi.internalEngine();
    const scrollProgress = emblaApi.scrollProgress();
    const slidesInView = emblaApi.slidesInView();

    emblaApi
      .scrollSnapList()
      .forEach((scrollSnap: number, snapIndex: number) => {
        let diffToTarget = scrollSnap - scrollProgress;
        const slidesInSnap = engine.slideRegistry[snapIndex];

        slidesInSnap.forEach((slideIndex: number) => {
          if (!slidesInView.includes(slideIndex)) return;

          if (engine.options.loop) {
            engine.slideLooper.loopPoints.forEach((loopItem: any) => {
              const target = loopItem.target();

              if (slideIndex === loopItem.index && target !== 0) {
                const sign = Math.sign(target);

                if (sign === -1) {
                  diffToTarget = scrollSnap - (1 + scrollProgress);
                }
                if (sign === 1) {
                  diffToTarget = scrollSnap + (1 - scrollProgress);
                }
              }
            });
          }

          const tweenValue = 1 - Math.abs(diffToTarget * tweenFactor.current);
          const scale = numberWithinRange(tweenValue, 0.75, 1).toString();
          const tweenNode = tweenNodes.current[slideIndex];
          if (tweenNode) {
            tweenNode.style.transform = `scale(${scale})`;
          }
        });
      });

    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;

    setTweenNodes(api);
    setTweenFactor(api);
    tweenScale(api);

    api
      .on("reInit", setTweenNodes)
      .on("reInit", setTweenFactor)
      .on("reInit", tweenScale)
      .on("scroll", tweenScale)
      .on("select", tweenScale);

    api.scrollTo(0);

    return () => {
      api
        .off("reInit", setTweenNodes)
        .off("reInit", setTweenFactor)
        .off("reInit", tweenScale)
        .off("scroll", tweenScale)
        .off("select", tweenScale);
    };
  }, [api, setTweenNodes, setTweenFactor, tweenScale]);

  const handleSetApi = useCallback((newApi: EmblaCarouselType | undefined) => {
    if (newApi) setApi(newApi);
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      if (api) api.scrollTo(index);
    },
    [api]
  );

  return (
    <section
      id="team"
      className="py-12 sm:py-16 md:py-24 bg-gradient-to-b from-[#2a1a0c] to-[#1a0d00] scroll-mt-16 sm:scroll-mt-20 md:scroll-mt-24 relative z-10"
    >
      <div className="container mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold mb-8 sm:mb-12 text-center text-amber-400 font-winky">
          The Team
        </h2>

        <Carousel
          setApi={handleSetApi}
          className="max-w-xs sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto"
          opts={{
            align: "center",
            loop: true,
            slidesToScroll: 1,
          }}
        >
          <CarouselContent className="-ml-2 sm:-ml-4 items-center">
            {teamMembers.map((member, idx) => (
              <CarouselItem
                key={idx}
                className="pl-2 sm:pl-4 basis-full sm:basis-1/2 md:basis-1/3"
              >
                <div
                  ref={(el) => {
                    cardsRef.current[idx] = el;
                    return undefined;
                  }}
                  className="bg-[#2a1a0c] p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-2xl flex flex-col justify-center items-center h-full"
                  style={{ transformOrigin: "center center" }}
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 border-2 sm:border-4 border-amber-500 rounded-full overflow-hidden mb-4 sm:mb-6">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-amber-400 font-winky mb-1">
                    {member.name}
                  </h3>
                  <p className="text-sm sm:text-base text-amber-300 font-body mb-2 sm:mb-4">
                    {member.role}
                  </p>
                  <p className="text-xs sm:text-sm md:text-base text-amber-200 text-center font-body">
                    {member.bio}
                  </p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden sm:block">
            <CarouselPrevious className="text-amber-400 border-amber-400 hover:bg-amber-900/20 -left-4 sm:-left-6" />
            <CarouselNext className="text-amber-400 border-amber-400 hover:bg-amber-900/20 -right-4 sm:-right-6" />
          </div>
        </Carousel>

        <div className="flex justify-center mt-6 gap-2">
          {teamMembers.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${
                selectedIndex === idx
                  ? "bg-amber-400"
                  : "bg-amber-700 hover:bg-amber-600"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
