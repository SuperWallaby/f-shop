export const SALES_POPUP_STORAGE_KEY = "salesPopupLastShownd";
export const SALES_POPUP_FORCE_OPEN_EVENT = "sales-popup:open";

export function requestSalesPopupOpen() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SALES_POPUP_STORAGE_KEY);
  window.dispatchEvent(new Event(SALES_POPUP_FORCE_OPEN_EVENT));
}
