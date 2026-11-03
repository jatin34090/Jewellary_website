"use client";

import Image from "next/image";
import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, TextArea, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";
import { uploadMedia } from "@/lib/uploads/cloudinary-upload";

type SectionId = "hero" | "categories" | "featured" | "newArrivals" | "bestSellers" | "why";

interface StoreSettings {
  brand: {
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    email: string;
    phone: string | null;
    address: string | null;
    socialLinks: { label: string; url: string }[];
  };
  theme: { brown: string; cream: string; gold: string };
  homeSections: { id: SectionId; enabled: boolean }[];
}

const SECTION_LABELS: Record<SectionId, string> = {
  hero: "Hero banner",
  categories: "Shop by category",
  featured: "Featured pieces",
  newArrivals: "New arrivals",
  bestSellers: "Best sellers",
  why: "Why VRINOOR",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Brand, contact, theme and homepage layout. Everything shown on the storefront comes from here. */
export default function StoreSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  useEffect(() => {
    authorizedRequest<StoreSettings>("/admin/settings/store")
      .then(setSettings)
      .catch((err: unknown) => {
        setNotice({
          tone: "error",
          text: err instanceof ApiError ? err.message : "Could not load settings.",
        });
      });
  }, []);

  if (!settings)
    return notice ? (
      <Notice tone="error">{notice.text}</Notice>
    ) : (
      <p className="text-sm text-muted">Loading settings…</p>
    );

  const setBrand = <K extends keyof StoreSettings["brand"]>(
    key: K,
    value: StoreSettings["brand"][K],
  ) => {
    setSettings((current) =>
      current ? { ...current, brand: { ...current.brand, [key]: value } } : current,
    );
  };

  const uploadImage = async (kind: "logo" | "favicon", file: File) => {
    setUploading(kind);
    setNotice(null);
    try {
      const uploaded = await uploadMedia(file, "image", () => undefined);
      setBrand(kind === "logo" ? "logoUrl" : "faviconUrl", uploaded.url);
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "The image could not be uploaded.",
      });
    } finally {
      setUploading(null);
    }
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setSettings((current) => {
      if (!current) return current;
      const next = [...current.homeSections];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [
        next[target] as (typeof next)[number],
        next[index] as (typeof next)[number],
      ];
      return { ...current, homeSections: next };
    });
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (settings.brand.name.trim().length < 1) next["name"] = "Enter the brand name";
    if (!/^\S+@\S+\.\S+$/.test(settings.brand.email.trim()))
      next["email"] = "Enter a valid contact email";
    for (const key of ["brown", "cream", "gold"] as const) {
      if (!HEX.test(settings.theme[key])) next[key] = "Use a six-digit colour such as #38251d";
    }
    settings.brand.socialLinks.forEach((link, index) => {
      if (!/^https:\/\/.+/.test(link.url))
        next[`social-${index}`] = "Links must start with https://";
    });
    return next;
  };

  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const saved = await authorizedRequest<StoreSettings>("/admin/settings/store", {
        method: "PUT",
        body: {
          brand: {
            ...settings.brand,
            name: settings.brand.name.trim(),
            tagline: settings.brand.tagline.trim(),
            description: settings.brand.description.trim(),
            phone: settings.brand.phone?.trim() || null,
            address: settings.brand.address?.trim() || null,
          },
          theme: settings.theme,
          homeSections: settings.homeSections,
        },
      });
      setSettings(saved);
      setNotice({
        tone: "success",
        text: "Store settings saved. The storefront updates within a minute.",
      });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "The settings could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Settings</p>
        <h1 className="mt-2 font-serif text-3xl text-brown">Store settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Brand, contact details, colours and the homepage layout.
        </p>
      </header>

      {notice ? (
        <Notice tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Notice>
      ) : null}

      <form onSubmit={(event) => void save(event)} noValidate className="grid gap-8">
        <section className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-2">
          <h2 className="font-serif text-xl text-brown sm:col-span-2">Brand</h2>
          <Field label="Brand name" htmlFor="st-name" error={errors["name"]}>
            <TextInput
              id="st-name"
              value={settings.brand.name}
              onChange={(e) => {
                setBrand("name", e.target.value);
              }}
              maxLength={80}
            />
          </Field>
          <Field label="Tagline" htmlFor="st-tag">
            <TextInput
              id="st-tag"
              value={settings.brand.tagline}
              onChange={(e) => {
                setBrand("tagline", e.target.value);
              }}
              maxLength={160}
            />
          </Field>
          <Field
            label="Short description"
            htmlFor="st-desc"
            className="sm:col-span-2"
            hint="Shown in the footer and search results."
          >
            <TextArea
              id="st-desc"
              value={settings.brand.description}
              onChange={(e) => {
                setBrand("description", e.target.value);
              }}
              maxLength={300}
              rows={3}
            />
          </Field>

          <ImageField
            label="Logo"
            url={settings.brand.logoUrl}
            busy={uploading === "logo"}
            hint="Shown in the header. Transparent PNG or SVG-style artwork works best."
            onFile={(file) => void uploadImage("logo", file)}
            onClear={() => {
              setBrand("logoUrl", null);
            }}
          />
          <ImageField
            label="Favicon"
            url={settings.brand.faviconUrl}
            busy={uploading === "favicon"}
            hint="Square image, at least 64 × 64 pixels, shown in the browser tab."
            onFile={(file) => void uploadImage("favicon", file)}
            onClear={() => {
              setBrand("faviconUrl", null);
            }}
          />
        </section>

        <section className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-2">
          <h2 className="font-serif text-xl text-brown sm:col-span-2">Contact</h2>
          <Field label="Enquiry email" htmlFor="st-email" error={errors["email"]}>
            <TextInput
              id="st-email"
              type="email"
              value={settings.brand.email}
              onChange={(e) => {
                setBrand("email", e.target.value);
              }}
            />
          </Field>
          <Field label="Phone (optional)" htmlFor="st-phone">
            <TextInput
              id="st-phone"
              value={settings.brand.phone ?? ""}
              onChange={(e) => {
                setBrand("phone", e.target.value || null);
              }}
            />
          </Field>
          <Field label="Address (optional)" htmlFor="st-address" className="sm:col-span-2">
            <TextInput
              id="st-address"
              value={settings.brand.address ?? ""}
              onChange={(e) => {
                setBrand("address", e.target.value || null);
              }}
              maxLength={300}
            />
          </Field>

          <div className="grid gap-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-brown">Social links</h3>
              <Button
                variant="secondary"
                disabled={settings.brand.socialLinks.length >= 10}
                onClick={() => {
                  setBrand("socialLinks", [
                    ...settings.brand.socialLinks,
                    { label: "", url: "https://" },
                  ]);
                }}
              >
                Add link
              </Button>
            </div>
            {settings.brand.socialLinks.length === 0 ? (
              <p className="text-sm text-muted">
                No social links. Add your Instagram, Facebook or other profiles.
              </p>
            ) : null}
            {settings.brand.socialLinks.map((link, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-start">
                <TextInput
                  aria-label={`Social link ${index + 1} name`}
                  value={link.label}
                  placeholder="Instagram"
                  onChange={(e) => {
                    setBrand(
                      "socialLinks",
                      settings.brand.socialLinks.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    );
                  }}
                />
                <div>
                  <TextInput
                    aria-label={`Social link ${index + 1} address`}
                    value={link.url}
                    placeholder="https://instagram.com/yourbrand"
                    onChange={(e) => {
                      setBrand(
                        "socialLinks",
                        settings.brand.socialLinks.map((item, i) =>
                          i === index ? { ...item, url: e.target.value } : item,
                        ),
                      );
                    }}
                  />
                  {errors[`social-${index}`] ? (
                    <p className="mt-1 text-xs text-gold-deep">{errors[`social-${index}`]}</p>
                  ) : null}
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    setBrand(
                      "socialLinks",
                      settings.brand.socialLinks.filter((_, i) => i !== index),
                    );
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-3">
          <h2 className="font-serif text-xl text-brown sm:col-span-3">Colours</h2>
          {(["brown", "cream", "gold"] as const).map((key) => (
            <Field
              key={key}
              label={
                key === "brown"
                  ? "Main (brown)"
                  : key === "cream"
                    ? "Background (cream)"
                    : "Accent (gold)"
              }
              htmlFor={`st-${key}`}
              error={errors[key]}
            >
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label={`${key} colour picker`}
                  value={settings.theme[key]}
                  onChange={(e) => {
                    setSettings((c) =>
                      c ? { ...c, theme: { ...c.theme, [key]: e.target.value } } : c,
                    );
                  }}
                  className="h-11 w-14 cursor-pointer rounded border border-line bg-white p-1"
                />
                <TextInput
                  id={`st-${key}`}
                  value={settings.theme[key]}
                  onChange={(e) => {
                    setSettings((c) =>
                      c ? { ...c, theme: { ...c.theme, [key]: e.target.value } } : c,
                    );
                  }}
                  maxLength={7}
                />
              </div>
            </Field>
          ))}
        </section>

        <section className="grid gap-4 rounded-md border border-line bg-white p-6">
          <h2 className="font-serif text-xl text-brown">Homepage sections</h2>
          <p className="text-sm text-muted">
            Turn sections on or off, and move them up or down. The homepage shows them in this
            order.
          </p>
          <ol className="grid gap-2">
            {settings.homeSections.map((section, index) => (
              <li
                key={section.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-line px-4 py-3"
              >
                <label className="flex items-center gap-3 text-sm text-brown">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) => {
                      setSettings((c) =>
                        c
                          ? {
                              ...c,
                              homeSections: c.homeSections.map((s, i) =>
                                i === index ? { ...s, enabled: e.target.checked } : s,
                              ),
                            }
                          : c,
                      );
                    }}
                    className="size-4 accent-brown"
                  />
                  {SECTION_LABELS[section.id]}
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={index === 0}
                    onClick={() => {
                      moveSection(index, -1);
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={index === settings.homeSections.length - 1}
                    onClick={() => {
                      moveSection(index, 1);
                    }}
                  >
                    Down
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save store settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ImageField({
  label,
  url,
  busy,
  hint,
  onFile,
  onClear,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  hint: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-xs tracking-wide text-brown-soft uppercase">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative size-20 overflow-hidden rounded border border-line bg-cream-deep">
          {url ? (
            <Image
              src={url}
              alt={`${label} preview`}
              fill
              sizes="80px"
              className="object-contain"
            />
          ) : null}
        </div>
        <div className="grid gap-2 text-sm">
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
          {url ? (
            <button
              type="button"
              onClick={onClear}
              className="text-left text-[#a33b32] underline-offset-4 hover:underline"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
