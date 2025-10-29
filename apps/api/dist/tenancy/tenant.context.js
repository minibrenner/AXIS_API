"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContext = exports.tenantStorage = void 0;
const async_hooks_1 = require("async_hooks");
/**
 * Armazena o tenant atual por requisicao usando AsyncLocalStorage.
 * Essa estrutura e semelhante a uma variavel global, mas isolada por
 * contexto assincrono, garantindo que cada request mantenha seu valor.
 */
exports.tenantStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * API simples usada pelo middleware do Prisma e por quem precisar ler
 * o tenant atual fora da camada HTTP.
 */
exports.TenantContext = {
    /**
     * Define o tenant ativo para o escopo de execucao do callback `cb`.
     * Todos os acessos subsequentes a `TenantContext.get()` dentro desse
     * escopo retornarao o mesmo `tenantId`.
     */
    run(tenantId, cb) {
        return exports.tenantStorage.run(tenantId, cb);
    },
    /**
     * Recupera o tenant associado ao contexto atual (ou undefined caso
     * nao tenha sido configurado pelo middleware).
     */
    get() {
        return exports.tenantStorage.getStore();
    },
};
//# sourceMappingURL=tenant.context.js.map