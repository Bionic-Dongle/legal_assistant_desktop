export {};

declare global {
  interface Window {
    electronAPI: {
      getSetting: (key: string) => Promise<any>;
      setSetting: (key: string, value: any) => Promise<boolean>;
      getAppPath: () => Promise<string>;
      saveChat: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>;
      getSavedChats: () => Promise<Array<{ name: string; path: string }>>;
      loadChat: (filename: string) => Promise<any>;
      archiveChat: (filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}