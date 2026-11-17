import Nav from "@/components/Nav";
import Hero from "@/components/landing/Hero";
import { Bento, Cta, Faq, Footer, Statement, Stats, Steps } from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Steps />
        <Statement />
        <Bento />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
