import Nav from "@/components/Nav";
import ClipWindow from "@/components/landing/ClipWindow";
import { Cta, Features, Footer, Formats, Hero, Steps } from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ClipWindow />
        <Steps />
        <Features />
        <Formats />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
