class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return key in this.store ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const getSafeStorage = (type: 'localStorage' | 'sessionStorage'): Storage => {
  try {
    const storage = window[type];
    if (!storage) {
      throw new Error(`${type} is not defined on window`);
    }
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return storage;
  } catch (e) {
    console.warn(`[SafeStorage] ${type} is not available, using in-memory fallback.`, e);
    return new MemoryStorage();
  }
};

export const safeLocalStorage = getSafeStorage('localStorage');
export const safeSessionStorage = getSafeStorage('sessionStorage');
