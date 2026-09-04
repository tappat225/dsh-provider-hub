declare module '@deepseek-ai/dsh-client-runtime/client' {
  export function defineStore<T extends { init: () => object; actions: Record<string, (draft: any, ...args: any[]) => void> }>(definition: T): {
    useStore: (selector: (state: ReturnType<T['init']>) => unknown) => any;
    actions: Record<keyof T['actions'], (...args: any[]) => void>;
  };
}
