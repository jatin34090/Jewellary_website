"use client";

import { bagStore, mergeBagLines, type BagLine } from "@/lib/bag/bag";
import { authorizedRequest, getSessionSnapshot, subscribeSession } from "@/lib/session/session";
import { mergeWishlists, wishlistStore } from "@/lib/wishlist/wishlist";

const PUSH_DELAY_MS = 600;

/**
 * Keeps a signed-in customer's bag and wishlist on the server as well as in this browser.
 * At sign-in the two copies are merged and both sides end up with the result. After that,
 * changes are sent to the server a moment after they happen. Signing out clears this browser's copy,
 * so the next person on a shared computer does not see the previous customer's items.
 */
export function startSavedItemsSync(): () => void {
  let activeUserId: string | null = null;
  let applyingServerState = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPushed = { bag: "", wishlist: "" };

  const pushNow = async (): Promise<void> => {
    if (!activeUserId) return;
    const bag = bagStore.getSnapshot();
    const wishlist = wishlistStore.getSnapshot();
    const bagJson = JSON.stringify(bag);
    const wishlistJson = JSON.stringify(wishlist);
    try {
      if (bagJson !== lastPushed.bag) {
        await authorizedRequest("/account/bag", {
          method: "PUT",
          body: { lines: bag.map(toSavedLine) },
        });
        lastPushed = { ...lastPushed, bag: bagJson };
      }
      if (wishlistJson !== lastPushed.wishlist) {
        await authorizedRequest("/account/wishlist", {
          method: "PUT",
          body: { slugs: wishlist },
        });
        lastPushed = { ...lastPushed, wishlist: wishlistJson };
      }
    } catch {
      // Offline or the server is busy: this browser keeps the change and the next one retries.
    }
  };

  const pushLater = (): void => {
    if (applyingServerState || !activeUserId) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushNow();
    }, PUSH_DELAY_MS);
  };

  const reconcile = async (userId: string): Promise<void> => {
    try {
      const [remoteBag, remoteWishlist] = await Promise.all([
        authorizedRequest<BagLine[]>("/account/bag"),
        authorizedRequest<string[]>("/account/wishlist"),
      ]);
      if (activeUserId !== userId) return;

      const bag = mergeBagLines(bagStore.getSnapshot(), remoteBag);
      const wishlist = mergeWishlists(wishlistStore.getSnapshot(), remoteWishlist);

      applyingServerState = true;
      bagStore.update(() => bag);
      wishlistStore.update(() => wishlist);
      applyingServerState = false;

      lastPushed = { bag: "", wishlist: "" };
      await pushNow();
    } catch {
      // Keep the browser's copy. The next change will try to sync again.
    }
  };

  const onSession = (): void => {
    const { status, user } = getSessionSnapshot();
    if (status === "authenticated" && user && user.id !== activeUserId) {
      activeUserId = user.id;
      void reconcile(user.id);
    } else if (status === "anonymous" && activeUserId) {
      activeUserId = null;
      clearTimeout(pushTimer);
      applyingServerState = true;
      bagStore.update(() => []);
      wishlistStore.update(() => []);
      applyingServerState = false;
    }
  };

  const unsubscribeBag = bagStore.subscribe(pushLater);
  const unsubscribeWishlist = wishlistStore.subscribe(pushLater);
  const unsubscribeSession = subscribeSession(onSession);
  onSession();

  return () => {
    clearTimeout(pushTimer);
    unsubscribeBag();
    unsubscribeWishlist();
    unsubscribeSession();
  };
}

function toSavedLine(line: BagLine): { slug: string; quantity: number } {
  return { slug: line.slug, quantity: line.quantity };
}
