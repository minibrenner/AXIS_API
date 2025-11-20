import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./super-admin-login.css";
import { loginSuperAdmin } from "../services/api";

export function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setFeedback({ kind: "error", message: "Informe email e senha para continuar." });
      return;
    }
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const payload = await loginSuperAdmin(email, password);
      localStorage.setItem("axis.superadmin.token", payload.token);
      setFeedback({
        kind: "success",
        message: "Autenticado como super admin.",
      });
      navigate("/super-admin/dashboard");
    } catch (err) {
      setFeedback({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível autenticar o super admin.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="superadmin-root">
      <main className="superadmin-card">
        <p className="superadmin-badge">SUPER ADMIN</p>
        <h1>Entrar no painel administrativo</h1>
        <p className="superadmin-subtitle">
          Use o login exclusivo para acessar a criação de lojas e configurações globais.
        </p>

        <form className="superadmin-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              placeholder="superadmin@axis.com"
              autoComplete="email"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              placeholder="********"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Validando..." : "Entrar como Super Admin"}
          </button>
        </form>

        {feedback && (
          <p className={`superadmin-feedback ${feedback.kind === "error" ? "error" : "success"}`}>
            {feedback.message}
          </p>
        )}

      </main>
    </div>
  );
}

export default SuperAdminLoginPage;
