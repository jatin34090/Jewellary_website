"use client";

import Image from "next/image";
import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/orders/labels";
import { authorizedRequest } from "@/lib/session/session";
import { uploadMedia } from "@/lib/uploads/cloudinary-upload";

interface Banner {
  id: string;
  placement: "HOME_HERO" | "HOME_PROMO";
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface FormState {
  placement: Banner["placement"];
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  sortOrder: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const EMPTY: FormState = {
  placement: "HOME_HERO",
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  linkUrl: "",
  sortOrder: "0",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

/** Hero and promotional banners. Only banners that are active and inside their dates appear on the storefront. */
export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = () =>
    authorizedRequest<Banner[]>("/admin/banners")
      .then(setBanners)
      .catch((err: unknown) => {
        setNotice({
          tone: "error",
          text: err instanceof ApiError ? err.message : "Could not load banners.",
        });
      });

  useEffect(() => {
    void load();
  }, []);

  const remove = async (banner: Banner) => {
    if (!window.confirm(`Delete the banner "${banner.title}"?`)) return;
    try {
      await authorizedRequest(`/admin/banners/${banner.id}`, { method: "DELETE" });
      setNotice({ tone: "success", text: "Banner deleted." });
      await load();
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "The banner could not be deleted.",
      });
    }
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Storefront</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Banners</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The hero banner appears at the top of the homepage. Paused or out-of-date banners are
            hidden.
          </p>
        </div>
        {editing === null ? (
          <Button
            onClick={() => {
              setEditing("new");
            }}
          >
            New banner
          </Button>
        ) : null}
      </header>

      {notice ? (
        <Notice tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Notice>
      ) : null}

      {editing !== null ? (
        <BannerForm
          banner={editing === "new" ? null : editing}
          onCancel={() => {
            setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            setNotice({ tone: "success", text: "Banner saved." });
            void load();
          }}
        />
      ) : null}

      {banners === null ? (
        <p className="text-sm text-muted">Loading banners…</p>
      ) : banners.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          No banners yet. Add a hero banner to show it on the homepage.
        </p>
      ) : (
        <ul className="grid gap-4">
          {banners.map((banner) => (
            <li
              key={banner.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-line bg-white p-4"
            >
              <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded bg-sand">
                <Image src={banner.imageUrl} alt="" fill sizes="144px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brown">{banner.title}</p>
                <p className="text-xs text-muted">
                  {banner.placement === "HOME_HERO" ? "Hero" : "Promotion"} · order{" "}
                  {banner.sortOrder}
                  {banner.startsAt ? ` · from ${formatDate(banner.startsAt)}` : ""}
                  {banner.endsAt ? ` · until ${formatDate(banner.endsAt)}` : ""}
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs ${banner.isActive ? "bg-brown text-cream" : "bg-cream-deep text-brown-soft"}`}
              >
                {banner.isActive ? "Active" : "Paused"}
              </span>
              <div className="flex gap-4 text-sm">
                <button
                  type="button"
                  className="text-brown underline-offset-4 hover:underline"
                  onClick={() => {
                    setEditing(banner);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-[#a33b32] underline-offset-4 hover:underline"
                  onClick={() => void remove(banner)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BannerForm({
  banner,
  onCancel,
  onSaved,
}: {
  banner: Banner | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormState>(() =>
    banner
      ? {
          placement: banner.placement,
          title: banner.title,
          subtitle: banner.subtitle ?? "",
          imageUrl: banner.imageUrl,
          mobileImageUrl: banner.mobileImageUrl ?? "",
          linkUrl: banner.linkUrl ?? "",
          sortOrder: String(banner.sortOrder),
          isActive: banner.isActive,
          startsAt: banner.startsAt ? banner.startsAt.slice(0, 16) : "",
          endsAt: banner.endsAt ? banner.endsAt.slice(0, 16) : "",
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const upload = async (key: "imageUrl" | "mobileImageUrl", file: File) => {
    setBusy(key);
    setError(null);
    try {
      const uploaded = await uploadMedia(file, "image", () => undefined);
      set(key, uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image could not be uploaded.");
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.title.trim().length < 1) next["title"] = "Enter a title";
    if (!values.imageUrl) next["imageUrl"] = "Upload the banner image";
    if (values.startsAt && values.endsAt && new Date(values.endsAt) <= new Date(values.startsAt))
      next["endsAt"] = "The end must be after the start";
    if (values.linkUrl.trim() && !/^(\/\S*|https:\/\/\S+)$/.test(values.linkUrl.trim()))
      next["linkUrl"] = "Use a store path such as /shop, or a https:// link";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy("save");
    setError(null);
    const body = {
      placement: values.placement,
      title: values.title.trim(),
      subtitle: values.subtitle.trim() || undefined,
      imageUrl: values.imageUrl,
      mobileImageUrl: values.mobileImageUrl || undefined,
      linkUrl: values.linkUrl.trim() || undefined,
      sortOrder: Number(values.sortOrder) || 0,
      isActive: values.isActive,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
    };
    try {
      if (banner) {
        await authorizedRequest(`/admin/banners/${banner.id}`, { method: "PATCH", body });
      } else {
        await authorizedRequest("/admin/banners", { method: "POST", body });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The banner could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-2"
    >
      <h2 className="font-serif text-xl text-brown sm:col-span-2">
        {banner ? "Edit banner" : "New banner"}
      </h2>
      {error ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <Field label="Where it appears" htmlFor="bn-place">
        <SelectInput
          id="bn-place"
          value={values.placement}
          onChange={(e) => {
            set("placement", e.target.value as Banner["placement"]);
          }}
        >
          <option value="HOME_HERO">Homepage hero</option>
          <option value="HOME_PROMO">Homepage promotion</option>
        </SelectInput>
      </Field>
      <Field label="Title" htmlFor="bn-title" error={errors["title"]}>
        <TextInput
          id="bn-title"
          value={values.title}
          onChange={(e) => {
            set("title", e.target.value);
          }}
          maxLength={150}
        />
      </Field>
      <Field label="Subtitle (optional)" htmlFor="bn-sub" className="sm:col-span-2">
        <TextInput
          id="bn-sub"
          value={values.subtitle}
          onChange={(e) => {
            set("subtitle", e.target.value);
          }}
          maxLength={255}
        />
      </Field>

      <UploadBox
        label="Desktop image"
        url={values.imageUrl}
        busy={busy === "imageUrl"}
        error={errors["imageUrl"]}
        onFile={(f) => void upload("imageUrl", f)}
      />
      <UploadBox
        label="Phone image (optional)"
        url={values.mobileImageUrl || null}
        busy={busy === "mobileImageUrl"}
        onFile={(f) => void upload("mobileImageUrl", f)}
        onClear={() => {
          set("mobileImageUrl", "");
        }}
      />

      <Field
        label="Link (optional)"
        htmlFor="bn-link"
        error={errors["linkUrl"]}
        hint="For example /shop?category=rings"
      >
        <TextInput
          id="bn-link"
          value={values.linkUrl}
          onChange={(e) => {
            set("linkUrl", e.target.value);
          }}
          maxLength={500}
        />
      </Field>
      <Field label="Order" htmlFor="bn-order" hint="Lower numbers show first">
        <TextInput
          id="bn-order"
          value={values.sortOrder}
          onChange={(e) => {
            set("sortOrder", e.target.value);
          }}
          inputMode="numeric"
        />
      </Field>
      <Field label="Starts (optional)" htmlFor="bn-start">
        <TextInput
          id="bn-start"
          type="datetime-local"
          value={values.startsAt}
          onChange={(e) => {
            set("startsAt", e.target.value);
          }}
        />
      </Field>
      <Field label="Ends (optional)" htmlFor="bn-end" error={errors["endsAt"]}>
        <TextInput
          id="bn-end"
          type="datetime-local"
          value={values.endsAt}
          onChange={(e) => {
            set("endsAt", e.target.value);
          }}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-brown sm:col-span-2">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => {
            set("isActive", e.target.checked);
          }}
          className="size-4 accent-brown"
        />
        Show on the storefront
      </label>

      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save banner"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function UploadBox({
  label,
  url,
  busy,
  error,
  onFile,
  onClear,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  error?: string | undefined;
  onFile: (file: File) => void;
  onClear?: () => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs tracking-wide text-brown-soft uppercase">{label}</p>
      <div className="relative aspect-[16/7] overflow-hidden rounded border border-line bg-cream-deep">
        {url ? <Image src={url} alt={label} fill sizes="400px" className="object-cover" /> : null}
      </div>
      <div className="flex gap-4 text-sm">
        <label className="cursor-pointer text-brown underline-offset-4 hover:underline">
          {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
        {url && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[#a33b32] underline-offset-4 hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-gold-deep">{error}</p> : null}
    </div>
  );
}
