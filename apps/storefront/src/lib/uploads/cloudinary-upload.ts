"use client";

import { ApiError } from "../api/errors";
import { authorizedRequest } from "../session/session";

export type MediaKind = "image" | "video";

export interface UploadedMedia {
  url: string;
  publicId: string;
}

interface UploadSignature {
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string;
  signature: string;
  uploadUrl: string;
}

const LIMITS: Record<MediaKind, { maxBytes: number; label: string }> = {
  image: { maxBytes: 10 * 1024 * 1024, label: "10 MB" },
  video: { maxBytes: 100 * 1024 * 1024, label: "100 MB" },
};

/** Checks type and size in the browser for a quick answer. Cloudinary also enforces the signed formats. */
export function validateMediaFile(file: File, kind: MediaKind): string | null {
  const expected = kind === "image" ? "image/" : "video/";
  if (!file.type.startsWith(expected)) {
    return kind === "image"
      ? "Choose an image file (JPG, PNG, WebP or AVIF)."
      : "Choose a video file (MP4, MOV or WebM).";
  }
  if (file.size > LIMITS[kind].maxBytes) {
    return `This file is larger than ${LIMITS[kind].label}. Please choose a smaller file.`;
  }
  return null;
}

/**
 * Uploads a file straight to Cloudinary using a signature from the API. The API secret never reaches
 * the browser. Progress is reported through onProgress (0 to 100).
 */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  onProgress: (percent: number) => void,
): Promise<UploadedMedia> {
  const problem = validateMediaFile(file, kind);
  if (problem) throw new Error(problem);

  const signed = await authorizedRequest<UploadSignature>("/admin/uploads/signature", {
    method: "POST",
    body: { kind },
  });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("folder", signed.folder);
  form.append("allowed_formats", signed.allowedFormats);
  form.append("signature", signed.signature);

  return new Promise<UploadedMedia>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: { secure_url?: string; public_id?: string; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // Fall through to the generic error below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url && body.public_id) {
        onProgress(100);
        resolve({ url: body.secure_url, publicId: body.public_id });
      } else {
        reject(
          new ApiError(
            xhr.status,
            "UPLOAD_FAILED",
            body.error?.message ?? "The upload did not complete. Please try again.",
          ),
        );
      }
    };
    xhr.onerror = () => {
      reject(
        new ApiError(
          0,
          "NETWORK",
          "The upload was interrupted. Check your connection and try again.",
        ),
      );
    };
    xhr.send(form);
  });
}
