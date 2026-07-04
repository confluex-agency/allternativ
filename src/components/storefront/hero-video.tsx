"use client";

// Turntable video of Manuel's head wearing the glasses, floating over the
// iridescent hero. This is the 2D-render alternative to the R3F 3D head
// (hero-head.tsx): a VP9-alpha webm (transparent, ping-pong loop, ~2MB) that
// matches the 2D concept's quality but can't be re-lit or swapped like real 3D.
//
// Cross-browser note: VP9 alpha plays transparent in Chrome/Firefox/Edge and
// Android. Safari/iOS don't decode VP9 alpha, so they fall back to the
// transparent poster PNG (a still front frame). A universal moving version for
// iOS would need HEVC-alpha or a color+matte canvas compositor — deferred until
// we decide this direction beats the 3D head.
export function HeroVideo() {
  return (
    <div className="relative h-full w-full">
      <span aria-hidden="true" className="hero-freq-glow" />
      <video
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 16px 30px rgba(35,25,15,0.28))" }}
        src="/video/manuel-cabeza.webm"
        poster="/video/manuel-cabeza-poster.png"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    </div>
  );
}
