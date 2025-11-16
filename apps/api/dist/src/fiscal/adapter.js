"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoneAdapter = void 0;
exports.getFiscalAdapter = getFiscalAdapter;
class NoneAdapter {
    async emitir(sale) {
        return { chave: `NONE-${sale.id}` };
    }
    async cancelar(chave, motivo) {
        void chave;
        void motivo;
    }
}
exports.NoneAdapter = NoneAdapter;
const sharedNoneAdapter = new NoneAdapter();
function getFiscalAdapter(mode) {
    const normalized = mode?.toLowerCase();
    switch (normalized) {
        case "sat":
        case "nfce":
        case "nfe":
        case "none":
        default:
            return sharedNoneAdapter;
    }
}
//# sourceMappingURL=adapter.js.map