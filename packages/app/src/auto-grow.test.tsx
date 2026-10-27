// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderUI } from "./dom-test-utils";
import { useAutoGrow } from "./auto-grow";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("refits an unchanged draft after its width or font metrics change, without losing selection", () => {
  let resize: ResizeObserverCallback | undefined;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {} disconnect() {}
  });
  const fonts = new EventTarget();
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
  let height = 100;
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(() => height);
  vi.spyOn(HTMLTextAreaElement.prototype, "clientHeight", "get").mockReturnValue(40);
  function Draft() { const ref = useAutoGrow("unchanged draft"); return <textarea ref={ref} defaultValue="unchanged draft" />; }
  const ui = renderUI(<Draft />);
  const field = ui.host.querySelector("textarea")!;
  field.focus(); field.setSelectionRange(3, 7);
  height = 180;
  act(() => resize?.([], {} as ResizeObserver));
  expect(parseFloat(field.style.height)).toBeGreaterThanOrEqual(180);
  height = 240;
  act(() => fonts.dispatchEvent(new Event("loadingdone")));
  expect(parseFloat(field.style.height)).toBeGreaterThanOrEqual(240);
  expect(field.value).toBe("unchanged draft");
  expect([field.selectionStart, field.selectionEnd]).toEqual([3, 7]);
  expect(document.activeElement).toBe(field);
  ui.unmount();
});
