export type Cleanup = () => void

export interface FoundationPluginInstance {
    destroy?(): void
}

export type PluginSelector = string | readonly string[]

export interface PluginContext {
    readonly signal: AbortSignal
    addCleanup(cleanup: Cleanup): void
    on(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean,
    ): void
    emit(
        target: EventTarget,
        type: string,
        detail?: unknown,
        init?: Omit<CustomEventInit, 'detail'>,
    ): boolean
}

export interface FoundationPlugin {
    name: string
    selector: PluginSelector
    mount(element: Element, context: PluginContext): void | FoundationPluginInstance
}

export interface FoundationApp {
    init(root?: ParentNode | Document): void
    destroy(root?: ParentNode | Document): void
    use(...plugins: FoundationPlugin[]): FoundationApp
    readonly plugins: readonly FoundationPlugin[]
}

export function definePlugin<T extends FoundationPlugin>(plugin: T): T {
    return plugin
}