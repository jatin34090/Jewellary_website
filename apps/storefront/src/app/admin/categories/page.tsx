"use client";

import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { browserGet } from "@/lib/api/browser-client";
import type { CategoryNode } from "@/lib/api/types";
import { authorizedRequest } from "@/lib/session/session";

/** Category management. The tree is shown as the shopper sees it. Deleting is blocked while subcategories exist. */
export default function CategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    browserGet<CategoryNode[]>("/categories")
      .then(setTree)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load categories.");
      });

  useEffect(() => {
    void load();
  }, []);

  const flat = tree ? tree.flatMap((node) => [node, ...node.children]) : [];

  const create = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (name.trim().length < 1) {
      setError("Enter a category name.");
      return;
    }
    try {
      await authorizedRequest("/admin/categories", {
        method: "POST",
        body: { name: name.trim(), parentId: parentId || undefined },
      });
      setName("");
      setParentId("");
      setMessage("Category added.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The category could not be added.");
    }
  };

  const remove = async (node: CategoryNode) => {
    if (
      !window.confirm(`Delete "${node.name}"? Products stay in the store but lose this category.`)
    )
      return;
    setError(null);
    setMessage(null);
    try {
      await authorizedRequest(`/admin/categories/${node.id}`, { method: "DELETE" });
      setMessage(`"${node.name}" deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The category could not be deleted.");
    }
  };

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Catalogue</p>
        <h1 className="mt-2 font-serif text-3xl text-brown">Categories</h1>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <form
        onSubmit={(event) => void create(event)}
        noValidate
        className="grid gap-4 rounded-md border border-line bg-white p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label="Category name" htmlFor="cat-name">
          <TextInput
            id="cat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            maxLength={120}
            placeholder="For example: Gold Rings"
          />
        </Field>
        <Field label="Inside (optional)" htmlFor="cat-parent">
          <SelectInput
            id="cat-parent"
            value={parentId}
            onChange={(e) => {
              setParentId(e.target.value);
            }}
          >
            <option value="">Top level</option>
            {flat.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Button type="submit">Add category</Button>
      </form>

      <section className="rounded-md border border-line bg-white p-6">
        {tree === null ? (
          <p className="text-sm text-muted">Loading categories…</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted">No categories yet.</p>
        ) : (
          <ul className="grid gap-4">
            {tree.map((node) => (
              <CategoryBranch
                key={node.id}
                node={node}
                onDelete={(node) => {
                  void remove(node);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CategoryBranch({
  node,
  onDelete,
  depth = 0,
}: {
  node: CategoryNode;
  onDelete: (node: CategoryNode) => void;
  depth?: number;
}) {
  return (
    <li style={{ marginLeft: depth * 20 }}>
      <div className="flex items-center justify-between gap-4 rounded border border-line px-4 py-3">
        <div>
          <p className="font-medium text-brown">{node.name}</p>
          <p className="text-xs text-muted">/{node.slug}</p>
        </div>
        <Button
          variant="danger"
          className="px-3 py-1.5 text-xs"
          onClick={() => {
            onDelete(node);
          }}
        >
          Delete
        </Button>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-3 grid gap-3">
          {node.children.map((child) => (
            <CategoryBranch key={child.id} node={child} onDelete={onDelete} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
