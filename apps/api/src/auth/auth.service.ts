// apps/api/src/auth/auth.service.ts
// Serviço central de autenticação: valida logins, emite tokens JWT e persiste sessões de refresh.
import argon2 from "argon2"; // biblioteca de hashing utilizada para verificar e criar hashes inquebráveis
import { basePrisma, prisma } from "../prisma/client"; // cliente Prisma que aplica o escopo multi-tenant automaticamente
import { signAccess, signRefresh } from "./jwt"; // funções de suporte que assinam tokens de acesso e refresh

/**
 * Faz a autenticação básica de um usuário a partir do e-mail e da senha.
 * 
 * 
 *
 * @param email - Credencial usada para localizar o usuário no banco.
 * @param password - Senha em texto plano digitada no formulário de login.
 * @returns Instância do usuário quando a senha confere e o usuário está ativo; caso contrário null.
 */


export async function validateUser(email: string, password: string) {
    // procura um usuario globalmente pelo e-mail (antes de sabermos o tenant)
    const user = await basePrisma.user.findFirst({ where: { email } });
    // impede login de contas inexistentes ou desativadas
    if (!user || !user.isActive) return null;

    // argon2.verify compara a senha enviada com o hash armazenado no banco
    const ok = await argon2.verify(user.passwordHash, password);
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
export async function issueTokens(
    user: { id: string; tenantId: string; role: string },
    userAgent?: string,
    ip?: string,
    refreshTtlMs = 1000 * 60 * 60 * 24 * 7 // 7 dias default
) {
    // payload comum a ambos os tokens: id do usuário, tenant corrente e papel (role)
    const payload = { sub: user.id, tid: user.tenantId, role: user.role };

    // token de acesso de curta duração usado nas rotas autenticadas
    const access = signAccess(payload);
    // token de refresh que permite renovar o token de acesso quando ele expira
    const refresh = signRefresh(payload);

    // apenas o hash do refresh é guardado para reduzir risco caso o banco seja comprometido
    const refreshHash = await argon2.hash(refresh);

    await prisma.session.create({
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
export async function revokeAllUserSessions(userId: string) {
    // remove todas as sessões vinculadas ao usuário, evitando uso posterior de refresh tokens antigos
    await prisma.session.deleteMany({ where: { userId } });
}



