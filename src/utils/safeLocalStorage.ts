import {
  safeStorage as safeLocalStorage,
  safeLocalStorageGetItem as getLS,
  safeLocalStorageSetItem as setLS,
  safeLocalStorageRemoveItem as delLS,
  safeLocalStorageClear as clearLS,
} from "./safeStorage";

export { safeLocalStorage, getLS, setLS, delLS, clearLS };

export default safeLocalStorage;
