import { definePlugin } from '../types.js';
import type { FoundationPlugin, FoundationPluginInstance, PluginContext } from '../types.js';

export type RevealOptions = {
  modal?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  returnFocus?: boolean;
  initialFocus?: string;
};

export type RevealOpenedDetail = {
  id: string;
  opener: HTMLElement | null;
  element: Element;
};

export type RevealClosedDetail = {
  id: string;
  opener: HTMLElement | null;
  element: Element;
};

export type RevealInstance = FoundationPluginInstance & {
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(opener?: HTMLElement | null): void;
};

let scrollLockCount = 0;
let previousRootOverflow: string | null = null;
let previousRootPaddingRight: string | null = null;

function lockScroll(): void {
  scrollLockCount += 1;
  if (scrollLockCount !== 1) return;

  const root = document.documentElement;
  previousRootOverflow = root.style.overflow;
  previousRootPaddingRight = root.style.paddingRight;

  const scrollbarWidth = window.innerWidth - root.clientWidth;
  if (scrollbarWidth > 0) {
    root.style.paddingRight = `${scrollbarWidth}px`;
  }
  root.style.overflow = 'hidden';
}

function unlockScroll(): void {
  if (scrollLockCount === 0) return;
  scrollLockCount -= 1;
  if (scrollLockCount !== 0) return;

  const root = document.documentElement;
  if (previousRootOverflow !== null) root.style.overflow = previousRootOverflow;
  if (previousRootPaddingRight !== null) root.style.paddingRight = previousRootPaddingRight;

  previousRootOverflow = null;
  previousRootPaddingRight = null;
}

function ensureId(element: Element, prefix: string): string {
  if (element.id) return element.id;

  const fallback = () =>
    `${prefix}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  const id = 'randomUUID' in crypto ? `${prefix}-${crypto.randomUUID()}` : fallback();
  element.id = id;
  return id;
}

function parseBooleanAttribute(element: Element, attr: string, defaultValue: boolean): boolean {
  if (!element.hasAttribute(attr)) return defaultValue;
  const raw = element.getAttribute(attr);
  if (raw === null || raw === '') return true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return true;
}

function getStringAttribute(element: Element, attr: string): string | undefined {
  const value = element.getAttribute(attr);
  return value && value.trim().length ? value.trim() : undefined;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function focusFirstMatch(root: Element, selector: string): boolean {
  const el = root.querySelector(selector);
  if (!isHtmlElement(el)) return false;
  el.focus();
  return true;
}

function focusFirstFocusable(root: Element): void {
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  if (focusFirstMatch(root, selector)) return;
  if (root instanceof HTMLElement) root.focus();
}

function getEventTargetElement(event: Event): Element | null {
  const target = event.target;
  return target instanceof Element ? target : null;
}

export function reveal(defaultOptions: RevealOptions = {}): FoundationPlugin {
  return definePlugin({
    name: 'reveal',
    selector: '[data-reveal]',
    mount(element: Element, context: PluginContext): RevealInstance {
      const id = ensureId(element, 'f7-reveal');

      const options: Required<RevealOptions> = {
        modal: parseBooleanAttribute(element, 'data-reveal-modal', defaultOptions.modal ?? true),
        closeOnBackdrop: parseBooleanAttribute(
          element,
          'data-reveal-close-on-backdrop',
          defaultOptions.closeOnBackdrop ?? true
        ),
        closeOnEsc: parseBooleanAttribute(element, 'data-reveal-close-on-esc', defaultOptions.closeOnEsc ?? true),
        lockScroll: parseBooleanAttribute(element, 'data-reveal-lock-scroll', defaultOptions.lockScroll ?? true),
        returnFocus: parseBooleanAttribute(element, 'data-reveal-return-focus', defaultOptions.returnFocus ?? true),
        initialFocus: getStringAttribute(element, 'data-reveal-initial-focus') ?? (defaultOptions.initialFocus ?? ''),
      };

      const dialog = element instanceof HTMLDialogElement ? element : null;

      let opener: HTMLElement | null = null;
      let isOpen = dialog ? dialog.open : element.hasAttribute('data-reveal-open');
      let backdrop: HTMLElement | null = null;

      if (isOpen && options.lockScroll && options.modal) {
        lockScroll();
      }

      if (dialog) {
        dialog.setAttribute('aria-modal', 'true');
      } else {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');
        element.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      }

      const emitOpened = () => {
        context.emit(element, 'foundation:reveal:opened', { id, opener, element } satisfies RevealOpenedDetail);
      };

      const emitClosed = () => {
        context.emit(element, 'foundation:reveal:closed', { id, opener, element } satisfies RevealClosedDetail);
      };

      const finalizeClose = () => {
        if (!isOpen) return;
        isOpen = false;

        if (backdrop) {
          backdrop.remove();
          backdrop = null;
        }

        if (!dialog) {
          element.removeAttribute('data-reveal-open');
          element.setAttribute('aria-hidden', 'true');
          if (element instanceof HTMLElement) element.style.display = 'none';
        }

        if (options.lockScroll && options.modal) {
          unlockScroll();
        }

        const focusTarget = opener;
        opener = null;

        if (options.returnFocus && focusTarget?.isConnected) {
          try {
            focusTarget.focus();
          } catch {
            // ignore
          }
        }

        emitClosed();
      };

      const open = (nextOpener: HTMLElement | null = null) => {
        if (isOpen) return;

        opener = nextOpener ?? (isHtmlElement(document.activeElement) ? document.activeElement : null);

        let didOpen = false;
        if (dialog) {
          try {
            if (options.modal) dialog.showModal();
            else dialog.show();
            didOpen = true;
          } catch {
            try {
              dialog.show();
              didOpen = true;
            } catch {
              // ignore
            }
          }
        } else {
          element.setAttribute('data-reveal-open', '');
          element.setAttribute('aria-hidden', 'false');
          if (element instanceof HTMLElement) element.style.display = '';

          backdrop = document.createElement('div');
          backdrop.setAttribute('data-reveal-backdrop-for', id);
          backdrop.style.position = 'fixed';
          backdrop.style.inset = '0';
          backdrop.style.background = 'rgba(0,0,0,0.5)';
          backdrop.style.zIndex = '1000';
          document.body.append(backdrop);
          backdrop.addEventListener('click', () => close());

          if (element instanceof HTMLElement) {
            element.style.position = element.style.position || 'fixed';
            element.style.zIndex = '1001';
            element.style.left = element.style.left || '50%';
            element.style.top = element.style.top || '50%';
            element.style.transform = element.style.transform || 'translate(-50%, -50%)';
          }

          didOpen = true;
        }

        if (!didOpen) {
          opener = null;
          return;
        }

        isOpen = true;
        if (options.lockScroll && options.modal) {
          lockScroll();
        }

        queueMicrotask(() => {
          if (options.initialFocus && focusFirstMatch(element, options.initialFocus)) return;
          focusFirstFocusable(element);
        });

        emitOpened();
      };

      const close = () => {
        if (!isOpen) return;

        if (dialog && dialog.open) {
          try {
            dialog.close();
          } catch {
            // ignore
          }
        }

        finalizeClose();
      };

      const toggle = (nextOpener: HTMLElement | null = null) => {
        if (isOpen) close();
        else open(nextOpener);
      };

      context.on(element, 'foundation:reveal:open', (e) => {
        const target = getEventTargetElement(e);
        if (target !== element) return;
        open(isHtmlElement(document.activeElement) ? document.activeElement : null);
      });
      context.on(element, 'foundation:reveal:close', (e) => {
        const target = getEventTargetElement(e);
        if (target !== element) return;
        close();
      });
      context.on(element, 'foundation:reveal:toggle', (e) => {
        const target = getEventTargetElement(e);
        if (target !== element) return;
        toggle(isHtmlElement(document.activeElement) ? document.activeElement : null);
      });

      context.on(document, 'click', (event) => {
        const target = getEventTargetElement(event);
        if (!target) return;

        const openTrigger = target.closest('[data-reveal-open]');
        if (openTrigger) {
          const openId = openTrigger.getAttribute('data-reveal-open');
          if (openId === id) {
            event.preventDefault();
            open(isHtmlElement(openTrigger) ? openTrigger : null);
          }
          return;
        }

        const toggleTrigger = target.closest('[data-reveal-toggle]');
        if (toggleTrigger) {
          const toggleId = toggleTrigger.getAttribute('data-reveal-toggle');
          if (toggleId === id) {
            event.preventDefault();
            toggle(isHtmlElement(toggleTrigger) ? toggleTrigger : null);
          }
          return;
        }

        const closeTrigger = target.closest('[data-reveal-close]');
        if (!closeTrigger) return;

        const closeId = closeTrigger.getAttribute('data-reveal-close');
        const isInside = element.contains(closeTrigger);
        const matches = closeId === null || closeId === '' || closeId === id;
        if (isInside || matches) {
          event.preventDefault();
          close();
        }
      });

      context.on(document, 'keydown', (event) => {
        if (!isOpen) return;
        if (dialog) return;
        if (!options.closeOnEsc) return;

        const e = event as KeyboardEvent;
        if (e.key !== 'Escape') return;
        e.preventDefault();
        close();
      });

      if (dialog) {
        context.on(dialog, 'cancel', (event) => {
          if (options.closeOnEsc) return;
          event.preventDefault();
        });

        context.on(dialog, 'close', () => {
          finalizeClose();
        });

        context.on(dialog, 'click', (event) => {
          if (!options.closeOnBackdrop) return;
          if (!dialog.open) return;
          if (event.target !== dialog) return;

          const e = event as MouseEvent;
          const rect = dialog.getBoundingClientRect();
          const clickedOutside =
            e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
          if (clickedOutside) close();
        });
      } else {
        context.on(element, 'click', (event) => {
          if (!options.closeOnBackdrop) return;
          if (!isOpen) return;
          if (event.target !== element) return;
          close();
        });
      }

      return {
        open,
        close,
        toggle,
        destroy() {
          close();
        },
      };
    },
  });
}
