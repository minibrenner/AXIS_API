"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOverview = getOverview;
const client_1 = require("../../prisma/client");
async function getOverview(_req, res) {
    const [totalLojasAtivas, totalLojasDesativadas, totalUsuariosAtivos, totalUsuariosDesativados] = await Promise.all([
        client_1.basePrisma.tenant.count({ where: { isActive: true } }),
        client_1.basePrisma.tenant.count({ where: { isActive: false } }),
        client_1.basePrisma.user.count({ where: { isActive: true } }),
        client_1.basePrisma.user.count({ where: { isActive: false } }),
    ]);
    return res.json({
        totalLojasAtivas,
        totalUsuariosAtivos,
        totalLojasDesativadas,
        totalUsuariosDesativados,
    });
}
//# sourceMappingURL=overview.controller.js.map