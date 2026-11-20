import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Editor from "@/components/editor/Editor";

export const metadata: Metadata = {
  title: "Editor · Studio Clipper",
};

export default function EditorPage() {
  return (
    <>
      <Nav studio />
      <Suspense>
        <Editor />
      </Suspense>
    </>
  );
}
