"use client";

import { useEffect, useRef, useState } from "react";

// Turntable video of Manuel's head wearing the glasses, floating (transparent)
// over the iridescent hero.
//
//  - Chrome / Edge / Firefox / Android → a VP9-alpha .webm in a plain <video>
//    (native, crisp, cheap).
//  - Safari / iOS / iPadOS → Safari can't decode VP9 alpha, so we composite a
//    stacked H.264 .mp4 (colour on top, white-on-black matte below) into a
//    <canvas>. A static poster sits BEHIND the canvas: if the canvas never
//    paints (stricter iOS autoplay/decoding), the poster shows instead of a
//    blank box. Best case the head rotates; worst case a clean still.

const WEBM = "/video/manuel-cabeza.webm";
const IOS_MP4 = "/video/manuel-cabeza-ios.mp4";
const POSTER = "/video/manuel-cabeza-poster.png";
const SHADOW = "drop-shadow(0 16px 30px rgba(35,25,15,0.28))";

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

export function HeroVideo({ fit = "contain" }: { fit?: "contain" | "cover" }) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  const [mode] = useState<"webm" | "canvas">(pickMode);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (mode !== "canvas") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tctx: CanvasRenderingContext2D | null = null;
    let raf = 0;
    let stopped = false;
    let painted = false;

    const setup = () => {
      const w = video.videoWidth;
      const h = video.videoHeight / 2; // top half = colour, bottom half = matte
      if (!w || !h) return false;
      canvas.width = w;
      canvas.height = h;
      const tmp = document.createElement("canvas");
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
        if (!painted) {
          painted = true;
          // Canvas is now driving the picture — fade the fallback poster out.
          if (posterRef.current) posterRef.current.style.opacity = "0";
        }
      }
      schedule();
    };

    const schedule = () => {
      if ("requestVideoFrameCallback" in video) {
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
          className={`h-full w-full ${fitClass}`}
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
          {/* Fallback still — shown until (and unless) the canvas paints. */}
          <img
            ref={posterRef}
            src={POSTER}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 h-full w-full fluid-transition ${fitClass}`}
            style={{ filter: SHADOW }}
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full ${fitClass}`}
            style={{ filter: SHADOW }}
          />
          {/* Source kept full-size + autoPlay (iOS won't decode a 1px or
              display:none video); opacity-0 keeps the stacked frames invisible. */}
          <video
            ref={videoRef}
            src={IOS_MP4}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0"
          />
        </>
      )}
    </div>
  );
}
