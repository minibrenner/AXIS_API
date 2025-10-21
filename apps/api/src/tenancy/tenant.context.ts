// apps/api/src/tenancy/tenant.context.ts
import { AsyncLocalStorage } from "async_hooks";

export const tenantStorage = new AsyncLocalStorage<string>();

export const TenantContext = {
  run<T>(tenantId: string, cb: () => T) {
    return tenantStorage.run(tenantId, cb);
  },
  get() {
    return tenantStorage.getStore(); // string | undefined
  },
};
