"use client";

export type ScrollContainer = HTMLElement | Window;

export function isScrollableElement(element: HTMLElement) {
  const { overflowY } = getComputedStyle(element);
  const allowsScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  return allowsScroll && element.scrollHeight > element.clientHeight + 1;
}

export function getPreferredScrollContainer(selector: string): ScrollContainer {
  const element = document.querySelector<HTMLElement>(selector);
  return element && isScrollableElement(element) ? element : window;
}

export function getScrollElement() {
  return document.scrollingElement ?? document.documentElement;
}

export function getScrollTop(container: ScrollContainer) {
  return container instanceof Window ? window.scrollY : container.scrollTop;
}

export function getScrollHeight(container: ScrollContainer) {
  return container instanceof Window ? getScrollElement().scrollHeight : container.scrollHeight;
}

export function getClientHeight(container: ScrollContainer) {
  return container instanceof Window ? window.innerHeight : container.clientHeight;
}

export function getMaxScrollTop(container: ScrollContainer) {
  return Math.max(0, getScrollHeight(container) - getClientHeight(container));
}

export function clampScrollTop(value: number, container: ScrollContainer) {
  return Math.min(Math.max(0, value), getMaxScrollTop(container));
}

export function getScrollProgress(container: ScrollContainer) {
  const max = getMaxScrollTop(container);
  return max <= 0 ? 0 : getScrollTop(container) / max;
}

export function scrollContainerTo(
  container: ScrollContainer,
  top: number,
  behavior: ScrollBehavior = "auto",
) {
  const nextTop = clampScrollTop(top, container);

  if (container instanceof Window) {
    window.scrollTo({ top: nextTop, behavior });
  } else {
    container.scrollTo({ top: nextTop, behavior });
  }
}

export function addScrollListener(
  container: ScrollContainer,
  listener: EventListener,
  options?: AddEventListenerOptions,
) {
  container.addEventListener("scroll", listener, options);
  return () => container.removeEventListener("scroll", listener);
}

export function getContainerViewportTop(container: ScrollContainer) {
  return container instanceof Window ? 0 : container.getBoundingClientRect().top;
}

export function getElementScrollTop(element: Element, container: ScrollContainer) {
  const rect = element.getBoundingClientRect();

  if (container instanceof Window) {
    return rect.top + window.scrollY;
  }

  return rect.top - container.getBoundingClientRect().top + container.scrollTop;
}
