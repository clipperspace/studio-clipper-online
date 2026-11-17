import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Studio from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio · Studio Clipper",
};

export default function StudioPage() {
  return (
    <>
      <Nav studio />
      <Suspense>
        <Studio />
      </Suspense>
    </>
  );
}
