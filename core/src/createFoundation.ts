import type { FoundationApp, FoundationPlugin, PluginContext } from './types.js';

type MountedInstance = {
  pluginName: string;
  element: Element;
  destroy(): void;
};

export type CreateFoundationOptions = {
  plugins?: readonly FoundationPlugin[];
};

function normalizeSelectors(selector: FoundationPlugin['selector']): readonly string[] {
  return typeof selector === 'string' ? [selector] : selector;
}

function hasDestroyMethod(value: unknown): value is { destroy(): void } {
  if (value === null || typeof value !== 'object') return false;
  return 'destroy' in value && typeof (value as { destroy?: unknown }).destroy === 'function';
}

export function createFoundation(options: CreateFoundationOptions = {}): FoundationApp {
  const plugins: FoundationPlugin[] = [...(options.plugins ?? [])];

  const instancesByElement = new WeakMap<Element, Map<string, MountedInstance>>();
  const instances = new Set<MountedInstance>();

  const mount = (plugin: FoundationPlugin, element: Element): void => {
    let byPlugin = instancesByElement.get(element);
    if (!byPlugin) {
      byPlugin = new Map();
      instancesByElement.set(element, byPlugin);
    }

    if (byPlugin.has(plugin.name)) return;

    const controller = new AbortController();
    const cleanups: Array<() => void> = [];

    const context: PluginContext = {
      signal: controller.signal,
      addCleanup(cleanup) {
        cleanups.push(cleanup);
      },
      on(target, type, listener, options) {
        const resolvedOptions =
          typeof options === 'object' && options
            ? { ...options, signal: controller.signal }
            : typeof options === 'boolean'
              ? options
              : { signal: controller.signal };

        target.addEventListener(type, listener, resolvedOptions);

        const capture =
          typeof options === 'boolean' ? options : typeof options === 'object' && options ? Boolean(options.capture) : false;
        cleanups.push(() => target.removeEventListener(type, listener, capture));
      },
      emit(target, type, detail, init) {
        const event = new CustomEvent(type, {
          bubbles: true,
          cancelable: false,
          ...init,
          detail,
        });
        return target.dispatchEvent(event);
      },
    };

    const pluginInstance = plugin.mount(element, context);

    const mounted: MountedInstance = {
      pluginName: plugin.name,
      element,
      destroy() {
        controller.abort();

        try {
          if (hasDestroyMethod(pluginInstance)) {
            pluginInstance.destroy();
          }
        } finally {
          for (const cleanup of cleanups.splice(0)) {
            try {
              cleanup();
            } catch {
              // best-effort cleanup
            }
          }
        }
      },
    };

    byPlugin.set(plugin.name, mounted);
    instances.add(mounted);
  };

  const init = (root: ParentNode | Document = document): void => {
    for (const plugin of plugins) {
      for (const selector of normalizeSelectors(plugin.selector)) {
        if (root instanceof Element && root.matches(selector)) {
          mount(plugin, root);
        }
        root.querySelectorAll(selector).forEach((el) => mount(plugin, el));
      }
    }
  };

  const destroy = (root?: ParentNode | Document): void => {
    if (!root) {
      for (const instance of Array.from(instances)) {
        instance.destroy();
        instances.delete(instance);

        const byPlugin = instancesByElement.get(instance.element);
        byPlugin?.delete(instance.pluginName);
      }
      return;
    }

    for (const instance of Array.from(instances)) {
      if (instance.element === root || (root instanceof Node && root.contains(instance.element))) {
        instance.destroy();
        instances.delete(instance);

        const byPlugin = instancesByElement.get(instance.element);
        byPlugin?.delete(instance.pluginName);
      }
    }
  };

  const app: FoundationApp = {
    init,
    destroy,
    use(...nextPlugins) {
      plugins.push(...nextPlugins);
      return app;
    },
    get plugins() {
      return [...plugins];
    },
  };

  return app;
}

