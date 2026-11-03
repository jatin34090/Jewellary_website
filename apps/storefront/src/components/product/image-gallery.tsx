"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";

interface GalleryImage {
  url: string;
  altText: string | null;
}

/** Main image with hover zoom on desktop and tap-to-zoom on touch screens, plus a thumbnail strip. */
export function ImageGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-sand font-serif text-muted">
        {name}
      </div>
    );
  }

  const current = images[index] ?? images[0];
  if (!current) return null;

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-md bg-sand"
        onMouseEnter={() => {
          setZoomed(true);
        }}
        onMouseLeave={() => {
          setZoomed(false);
        }}
        onMouseMove={handleMove}
        onClick={() => {
          setZoomed((value) => !value);
        }}
      >
        <Image
          src={current.url}
          alt={current.altText ?? name}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-200 ease-out"
          style={{
            transform: zoomed ? "scale(2)" : "scale(1)",
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                }}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={`relative size-16 overflow-hidden rounded border-2 sm:size-20 ${
                  i === index ? "border-gold" : "border-transparent"
                }`}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
