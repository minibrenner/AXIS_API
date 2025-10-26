import { AsyncLocalStorage } from "async_hooks";

/**
 * Armazena o tenant atual por requisicao usando AsyncLocalStorage.
 * Essa estrutura e semelhante a uma variavel global, mas isolada por
 * contexto assincrono, garantindo que cada request mantenha seu valor.
 */
export const tenantStorage = new AsyncLocalStorage<string>();

/**
 * API simples usada pelo middleware do Prisma e por quem precisar ler
 * o tenant atual fora da camada HTTP.
 */
export const TenantContext = {
  /**
   * Define o tenant ativo para o escopo de execucao do callback `cb`.
   * Todos os acessos subsequentes a `TenantContext.get()` dentro desse
   * escopo retornarao o mesmo `tenantId`.
   */
  run<T>(tenantId: string, cb: () => T) {
    return tenantStorage.run(tenantId, cb);
  },
  /**
   * Recupera o tenant associado ao contexto atual (ou undefined caso
   * nao tenha sido configurado pelo middleware).
   */
  get() {
    return tenantStorage.getStore();
  },
};
