"use client";

import { useEffect, useRef, useState } from "react";

// Turntable video of Manuel's head wearing the glasses, floating (transparent)
// over the iridescent hero. It's the 2D-render alternative to the R3F 3D head.
//
// Cross-browser transparency without losing quality:
//  - Chrome / Edge / Firefox / Android → a VP9-alpha .webm in a plain <video>
//    (native, crisp, cheap).
//  - Safari / iOS / iPadOS → Safari can't decode VP9 alpha, so we fall back to a
//    <canvas> compositor: one H.264 .mp4 stacks the colour frame on top and a
//    white-on-black matte on the bottom; each frame we copy the matte's luma into
//    the colour's alpha channel and paint the result. Same picture, works on iPhone.
// The visual output is identical in both paths; only the plumbing differs.

const WEBM = "/video/manuel-cabeza.webm";
const IOS_MP4 = "/video/manuel-cabeza-ios.mp4";
const POSTER = "/video/manuel-cabeza-poster.png";
const SHADOW = "drop-shadow(0 16px 30px rgba(35,25,15,0.28))";

// Route Safari/WebKit (all Apple browsers) and anything that can't play VP9 webm
// to the canvas path. Everyone else gets the native webm.
function pickMode(): "webm" | "canvas" {
  if (typeof navigator === "undefined") return "webm";
  const ua = navigator.userAgent;
  const isApple =
    /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)) || // iPadOS
    (/Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|Edg/.test(ua));
  const canWebm = !!document
    .createElement("video")
    .canPlayType('video/webm; codecs="vp9"');
  return isApple || !canWebm ? "canvas" : "webm";
}

export function HeroVideo() {
  // ssr:false (see hero-video-lazy) means this initializer runs on the client,
  // so navigator is available and there is no server/client flash.
  const [mode] = useState<"webm" | "canvas">(pickMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (mode !== "canvas") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tmp: HTMLCanvasElement | null = null;
    let tctx: CanvasRenderingContext2D | null = null;
    let raf = 0;
    let stopped = false;

    const setup = () => {
      const w = video.videoWidth;
      const h = video.videoHeight / 2; // top half = colour, bottom half = matte
      if (!w || !h) return false;
      canvas.width = w;
      canvas.height = h;
      tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = video.videoHeight;
      tctx = tmp.getContext("2d", { willReadFrequently: true });
      return !!tctx;
    };

    const draw = () => {
      if (stopped || !tctx) return;
      const w = canvas.width;
      const h = canvas.height;
      if (video.readyState >= 2) {
        tctx.drawImage(video, 0, 0);
        const colour = tctx.getImageData(0, 0, w, h);
        const matte = tctx.getImageData(0, h, w, h);
        const cd = colour.data;
        const md = matte.data;
        for (let i = 0; i < cd.length; i += 4) cd[i + 3] = md[i]; // luma → alpha
        ctx.putImageData(colour, 0, 0);
      }
      schedule();
    };

    const schedule = () => {
      if ("requestVideoFrameCallback" in video) {
        // Only recomposite when a genuinely new video frame is ready.
        (video as HTMLVideoElement).requestVideoFrameCallback(draw);
      } else {
        raf = requestAnimationFrame(draw);
      }
    };

    const start = () => {
      if (setup()) {
        video.play().catch(() => {});
        schedule();
      }
    };

    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      video.removeEventListener("loadeddata", start);
    };
  }, [mode]);

  return (
    <div className="relative h-full w-full">
      <span aria-hidden="true" className="hero-freq-glow" />
      {mode === "webm" ? (
        <video
          className="h-full w-full object-contain"
          style={{ filter: SHADOW }}
          src={WEBM}
          poster={POSTER}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="h-full w-full object-contain"
            style={{ filter: SHADOW }}
            aria-hidden="true"
          />
          {/* Kept in-layout but invisible: iOS refuses to decode display:none
              videos, so we hide it with opacity/size instead. */}
          <video
            ref={videoRef}
            src={IOS_MP4}
            poster={POSTER}
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
}
