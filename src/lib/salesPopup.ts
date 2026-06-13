<<<<<<< HEAD
export const SALES_POPUP_STORAGE_KEY = "salesPopupLastShownd";
export const SALES_POPUP_FORCE_OPEN_EVENT = "sales-popup:open";
=======
export const SALES_POPUP_STORAGE_KEY = "salesPopupLastShown";
export const SALES_POPUP_FORCE_OPEN_EVENT = "sales-popup:open";
export const SALES_POPUP_IMAGE = "/pop-up.webp";
export const SALES_POPUP_IMAGE_WIDTH = 1080;
export const SALES_POPUP_IMAGE_HEIGHT = 1440;
export const SALES_POPUP_LINK = "https://shop.fasea.studio";
export const SALES_POPUP_SNOOZE_MS = 24 * 60 * 60 * 1000;
>>>>>>> main

export function requestSalesPopupOpen() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SALES_POPUP_STORAGE_KEY);
  window.dispatchEvent(new Event(SALES_POPUP_FORCE_OPEN_EVENT));
}
