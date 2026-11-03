"use client";

import { useRef, useState } from "react";

import { Button, Notice } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { uploadMedia, validateMediaFile, type MediaKind } from "@/lib/uploads/cloudinary-upload";
import { authorizedRequest } from "@/lib/session/session";
import type { AdminProduct } from "./types";
import { videoPoster } from "./types";

/** Photos and the optional product video. Files upload straight to Cloudinary; this panel then records them. */
export function ProductMedia({
  product,
  onChange,
}: {
  product: AdminProduct;
  onChange: (next: AdminProduct) => void;
}) {
  const [progress, setProgress] = useState<{ kind: MediaKind; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const addImage = (file: File) =>
    run(async () => {
      const problem = validateMediaFile(file, "image");
      if (problem) throw new Error(problem);
      setProgress({ kind: "image", percent: 0 });
      const uploaded = await uploadMedia(file, "image", (percent) => {
        setProgress({ kind: "image", percent });
      });
      const next = await authorizedRequest<AdminProduct>(`/admin/products/${product.id}/images`, {
        method: "POST",
        body: {
          url: uploaded.url,
          publicId: uploaded.publicId,
          isPrimary: product.images.length === 0,
        },
      });
      onChange(next);
    });

  const addVideo = (file: File) =>
    run(async () => {
      const problem = validateMediaFile(file, "video");
      if (problem) throw new Error(problem);
      setProgress({ kind: "video", percent: 0 });
      const uploaded = await uploadMedia(file, "video", (percent) => {
        setProgress({ kind: "video", percent });
      });
      const next = await authorizedRequest<AdminProduct>(`/admin/products/${product.id}/video`, {
        method: "PUT",
        body: { url: uploaded.url, publicId: uploaded.publicId },
      });
      onChange(next);
    });

  const setPrimary = (imageId: string) =>
    run(async () => {
      const next = await authorizedRequest<AdminProduct>(
        `/admin/products/${product.id}/images/${imageId}`,
        {
          method: "PATCH",
          body: { isPrimary: true },
        },
      );
      onChange(next);
    });

  const removeImage = (imageId: string) =>
    run(async () => {
      if (!window.confirm("Remove this photo from the product?")) return;
      await authorizedRequest(`/admin/products/${product.id}/images/${imageId}`, {
        method: "DELETE",
      });
      onChange(await authorizedRequest<AdminProduct>(`/admin/products/${product.id}`));
    });

  const removeVideo = () =>
    run(async () => {
      if (!window.confirm("Remove the video from this product?")) return;
      await authorizedRequest(`/admin/products/${product.id}/video`, { method: "DELETE" });
      onChange(await authorizedRequest<AdminProduct>(`/admin/products/${product.id}`));
    });

  const poster = product.videoUrl ? videoPoster(product.videoUrl) : null;

  return (
    <section
      aria-labelledby="media-heading"
      className="grid gap-6 rounded-md border border-line bg-white p-6"
    >
      <h2 id="media-heading" className="font-serif text-xl text-brown">
        Photos and video
      </h2>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {progress ? (
        <div role="status" className="grid gap-2">
          <div className="flex justify-between text-xs text-brown-soft">
            <span>Uploading {progress.kind === "video" ? "video" : "photo"}…</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-cream-deep">
            <div
              className="h-full bg-brown transition-[width]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-brown">Photos ({product.images.length})</h3>
          <Button variant="secondary" disabled={busy} onClick={() => imageInput.current?.click()}>
            Upload photo
          </Button>
          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void addImage(file);
            }}
          />
        </div>
        {product.images.length === 0 ? (
          <p className="text-sm text-muted">
            No photos yet. The first photo you add becomes the main image.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {product.images.map((image) => (
              <li key={image.id} className="grid gap-2">
                <div className="relative aspect-square overflow-hidden rounded bg-sand">
                  <img
                    src={image.url}
                    alt={image.altText ?? product.name}
                    className="size-full object-cover"
                  />
                  {image.isPrimary ? (
                    <span className="absolute left-2 top-2 rounded bg-brown px-2 py-0.5 text-[11px] text-cream">
                      Main
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-3 text-xs">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      className="text-brown underline-offset-4 hover:underline"
                      onClick={() => void setPrimary(image.id)}
                      disabled={busy}
                    >
                      Make main
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-[#a33b32] underline-offset-4 hover:underline"
                    onClick={() => void removeImage(image.id)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-brown">Product video</h3>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => videoInput.current?.click()}>
              {product.videoUrl ? "Replace video" : "Upload video"}
            </Button>
            {product.videoUrl ? (
              <Button variant="danger" disabled={busy} onClick={() => void removeVideo()}>
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void addVideo(file);
            }}
          />
        </div>
        {product.videoUrl ? (
          <video
            controls
            preload="metadata"
            poster={poster ?? undefined}
            src={product.videoUrl}
            className="aspect-video w-full max-w-md rounded bg-sand"
          />
        ) : (
          <p className="text-sm text-muted">
            Optional. MP4, MOV or WebM up to 100 MB. Shoppers see it on the product page.
          </p>
        )}
      </div>
    </section>
  );
}
