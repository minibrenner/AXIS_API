import { FormEvent, useState } from "react";
import "./super-admin-dashboard.css";
import { CreateTenantUserBody, createTenantUserAsSuperAdmin } from "../services/api";

type Role = "OWNER" | "ADMIN" | "ATTENDANT";

export function TenantUserCreateSection() {
  const [form, setForm] = useState<CreateTenantUserBody>({
    tenantIdentifier: "",
    email: "",
    password: "",
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [pinSupervisor, setPinSupervisor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canSubmit =
    form.tenantIdentifier.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.trim().length >= 4;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!canSubmit) {
      setFeedback("Preencha tenant identifier, email e senha (mínimo 4 caracteres).");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("axis.superadmin.token");
      if (!token) {
        setFeedback("Token de super admin ausente. Faça login novamente.");
        return;
      }

      const payload: CreateTenantUserBody = {
        tenantIdentifier: form.tenantIdentifier.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        name: name.trim() || undefined,
        role: role || undefined,
        pinSupervisor: pinSupervisor.trim() || undefined,
      };

      await createTenantUserAsSuperAdmin(token, payload);
      setFeedback("Usuário criado com sucesso.");
      setForm((prev) => ({ ...prev, email: "", password: "" }));
      setName("");
      setRole("");
      setPinSupervisor("");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro inesperado ao criar usuário.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="tenant-user-form-wrapper">
      <form className="tenant-user-form-card" onSubmit={handleSubmit}>
        <h2 className="tenant-user-form-title">Dados do usuário</h2>
        <p className="tenant-user-form-subtitle">
          Informe o <strong>identificador do tenant</strong>, as credenciais do usuário e,
          se desejar, o papel e o PIN de supervisor.
        </p>

        <div className="tenant-user-form-grid">
          <label className="tenant-user-field" style={{ gridColumn: "1 / -1" }}>
            <span>Tenant identifier *</span>
            <input
              className="tenant-user-input"
              placeholder="ID, CNPJ, email ou outro identificador aceito pelo backend"
              value={form.tenantIdentifier}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tenantIdentifier: e.target.value }))
              }
              disabled={isSubmitting}
            />
            <small>
              Esse valor será enviado como <code>tenantIdentifier</code>.
            </small>
          </label>

          <label className="tenant-user-field">
            <span>Email do usuário *</span>
            <input
              id="user-email"
              className="tenant-user-input"
              placeholder="usuario@loja.com.br"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              disabled={isSubmitting}
            />
          </label>

          <label className="tenant-user-field">
            <span>Senha *</span>
            <input
              id="user-password"
              type="password"
              className="tenant-user-input"
              placeholder="Defina a senha inicial de acesso"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              disabled={isSubmitting}
            />
          </label>

          <label className="tenant-user-field">
            <span>Nome (opcional)</span>
            <input
              className="tenant-user-input"
              placeholder="Nome que aparecerá no PDV"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="tenant-user-field">
            <span>Papel / Role</span>
            <select
              className="tenant-user-select"
              value={role}
              onChange={(e) => setRole(e.target.value as Role | "")}
              disabled={isSubmitting}
            >
              <option value="">Selecione...</option>
              <option value="OWNER">OWNER (dono da loja)</option>
              <option value="ADMIN">ADMIN (gestão)</option>
              <option value="ATTENDANT">ATTENDANT (atendente)</option>
            </select>
            <small>Se vazio, o backend pode aplicar ATTENDANT.</small>
          </label>

          <label className="tenant-user-field">
            <span>PIN de supervisor (opcional)</span>
            <input
              className="tenant-user-input"
              placeholder="Ex.: 1234"
              value={pinSupervisor}
              onChange={(e) => setPinSupervisor(e.target.value)}
              disabled={isSubmitting}
            />
            <small>
              Usado para autorizar ações sensíveis. Enviado como{" "}
              <code>pinSupervisor</code>.
            </small>
          </label>
        </div>

        {feedback && (
          <p
            className="tenant-user-feedback"
            style={{ color: feedback.toLowerCase().includes("sucesso") ? "#bbf7d0" : "#fecaca" }}
          >
            {feedback}
          </p>
        )}

        <div className="tenant-user-form-footer">
          <button
            type="button"
            className="tenant-user-button-secondary"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="tenant-user-button-primary"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? "Criando..." : "Criar usuário"}
          </button>
        </div>

        <div className="tenant-user-helper-row">
          <strong>Importante:</strong> verifique se o <code>tenantIdentifier</code> está correto.
        </div>
      </form>
    </section>
  );
}

export default TenantUserCreateSection;
