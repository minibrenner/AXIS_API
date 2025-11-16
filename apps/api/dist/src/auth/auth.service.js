"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUser = validateUser;
exports.issueTokens = issueTokens;
exports.revokeAllUserSessions = revokeAllUserSessions;
// apps/api/src/auth/auth.service.ts
// Serviço central de autenticação: valida logins, emite tokens JWT e persiste sessões de refresh.
const argon2_1 = __importDefault(require("argon2")); // biblioteca de hashing utilizada para verificar e criar hashes inquebráveis
const client_1 = require("../prisma/client"); // cliente Prisma que aplica o escopo multi-tenant automaticamente
const jwt_1 = require("./jwt"); // funções de suporte que assinam tokens de acesso e refresh
/**
 * Faz a autenticação básica de um usuário a partir do e-mail e da senha.
 *
 *
 *
 * @param email - Credencial usada para localizar o usuário no banco.
 * @param password - Senha em texto plano digitada no formulário de login.
 * @returns Instância do usuário quando a senha confere e o usuário está ativo; caso contrário null.
 */
async function validateUser(email, password) {
    // procura um usuario globalmente pelo e-mail (antes de sabermos o tenant)
    const user = await client_1.basePrisma.user.findFirst({ where: { email } });
    // impede login de contas inexistentes ou desativadas
    if (!user || !user.isActive)
        return null;
    // argon2.verify compara a senha enviada com o hash armazenado no banco
    const ok = await argon2_1.default.verify(user.passwordHash, password);
    return ok ? user : null;
}
/**
 * Emite um par de tokens (acesso + refresh) e registra a sessão de refresh no banco.
 *
 * @param user - Dados mínimos do usuário necessários para preencher as claims do JWT.
 * @param userAgent - Agente de usuário extraído do cabeçalho da requisição (opcional).
 * @param ip - Endereço IP do cliente atual (opcional).
 * @param refreshTtlMs - Tempo de vida do token de refresh em milissegundos (default: 7 dias).
 * @returns Objeto com os tokens `access` e `refresh` recém emitidos.
 */
async function issueTokens(user, userAgent, ip, refreshTtlMs = 1000 * 60 * 60 * 24 * 7 // 7 dias default
) {
    // payload comum a ambos os tokens: id do usuário, tenant corrente e papel (role)
    const payload = { sub: user.id, tid: user.tenantId, role: user.role };
    // token de acesso de curta duração usado nas rotas autenticadas
    const access = (0, jwt_1.signAccess)(payload);
    // token de refresh que permite renovar o token de acesso quando ele expira
    const refresh = (0, jwt_1.signRefresh)(payload);
    // apenas o hash do refresh é guardado para reduzir risco caso o banco seja comprometido
    const refreshHash = await argon2_1.default.hash(refresh);
    await client_1.prisma.session.create({
        data: {
            tenantId: user.tenantId, // referencia o tenant responsável pela sessão
            userId: user.id,
            refreshHash,
            userAgent,
            ip,
            expiresAt: new Date(Date.now() + refreshTtlMs), // data de expiração calculada com base na TTL
        },
    });
    return { access, refresh };
}
/**
 * Revoga todas as sessões (tokens de refresh persistidos) de um usuário específico.
 *
 * @param userId - Identificador do usuário cujo acesso será invalidado.
 */
async function revokeAllUserSessions(userId) {
    // remove todas as sessões vinculadas ao usuário, evitando uso posterior de refresh tokens antigos
    await client_1.prisma.session.deleteMany({ where: { userId } });
}
//# sourceMappingURL=auth.service.js.map