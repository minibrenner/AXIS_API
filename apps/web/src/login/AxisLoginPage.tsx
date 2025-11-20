import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./axis-login.css";
import {
  fetchCurrentUser,
  login,
  requestPasswordReset,
} from "../services/api";
import {
  storeTokens,
  storeCurrentUser,
  clearSession,
  hasAdminAccess,
} from "../auth/session";
import type { AxisCurrentUser } from "../auth/session";

type Theme = "light" | "dark";

const EMAIL_KEY = "axis.auth.lastEmail";

type Feedback = { kind: "error" | "success"; message: string } | null;

export function AxisLoginPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [resetFeedback, setResetFeedback] = useState<Feedback>(null);
  const [resetting, setResetting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") ?? "/";
  }, [location.search]);

  useEffect(() => {
    const timer = setTimeout(() => setShowForm(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const isDark = theme === "dark";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setFeedback({
        kind: "error",
        message: "Informe login e senha para continuar.",
      });
      return;
    }
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const tokens = await login(email, password);
      storeTokens(tokens);
      const user = (await fetchCurrentUser(tokens.access)) as AxisCurrentUser;
      storeCurrentUser(user);
      localStorage.setItem(EMAIL_KEY, email);
      setFeedback({ kind: "success", message: "Login efetuado com sucesso." });
      const fallbackRoute = hasAdminAccess(user) ? "/admin/dashboard" : "/";
      const destination =
        redirectTo && redirectTo !== "/" ? redirectTo : fallbackRoute;
      setTimeout(() => navigate(destination, { replace: true }), 600);
    } catch (err) {
      clearSession();
      setFeedback({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Falha ao autenticar no Axis.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setResetFeedback({
        kind: "error",
        message: "Informe seu e-mail para enviarmos as instruções.",
      });
      return;
    }
    setResetFeedback(null);
    setResetting(true);
    try {
      await requestPasswordReset(email);
      setResetFeedback({
        kind: "success",
        message:
          "Se o e-mail existir, enviaremos o link de redefinição em instantes.",
      });
    } catch (err) {
      setResetFeedback({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o processo de redefinição.",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={`axis-root axis-${theme}`}>
      <header className="axis-topbar">
        <button
          className="axis-toggle"
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? "☀️ Claro" : "🌙 Escuro"}
        </button>
      </header>

      <main className="axis-center">
        <div className="axis-card">
          <div className="axis-logo-wrapper">
            <img
              src="/axis-logo.png"
              alt="Axis Softwares"
              className="axis-logo-img"
            />
          </div>

          <form
            className={`axis-form ${showForm ? "axis-form-visible" : ""}`}
            onSubmit={handleSubmit}
          >
            <h1 className="axis-title">Entrar no AXIS</h1>
            <p className="axis-subtitle">
              Faça login para acessar o painel e o PDV
            </p>

            <label className="axis-label">
              Login
              <input
                className="axis-input"
                type="email"
                placeholder="seu@email.com"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label className="axis-label">
              Senha
              <input
                className="axis-input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <div className="axis-actions">
              <button
                type="submit"
                className="axis-button-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </button>

              <button
                type="button"
                className="axis-link"
                onClick={handleForgotPassword}
                disabled={resetting}
              >
                {resetting ? "Enviando..." : "Esqueci minha senha"}
              </button>
            </div>

            {feedback && (
              <p
                className={`axis-feedback ${
                  feedback.kind === "error" ? "axis-error" : "axis-success"
                }`}
              >
                {feedback.message}
              </p>
            )}

            {resetFeedback && (
              <p
                className={`axis-feedback ${
                  resetFeedback.kind === "error"
                    ? "axis-error"
                    : "axis-success"
                }`}
              >
                {resetFeedback.message}
              </p>
            )}

          

            <p className="axis-footer">
              AXIS Softwares • Since 2024 • Todos os direitos reservados
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AxisLoginPage;
