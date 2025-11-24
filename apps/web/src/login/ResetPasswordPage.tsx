import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./axis-login.css";
import { resetPassword } from "../services/api";

type Theme = "light" | "dark";

type Feedback = { kind: "error" | "success"; message: string } | null;

export function ResetPasswordPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  useEffect(() => {
    const defaultToken = searchParams.get("token") ?? "";
    setToken(defaultToken);
    const timer = setTimeout(() => setShowForm(true), 600);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const isDark = theme === "dark";
  const buttonLabel = isSubmitting ? "Salvando..." : "Atualizar senha";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setFeedback({
        kind: "error",
        message: "Informe o token recebido por e-mail.",
      });
      return;
    }
    if (!password || password.length < 8) {
      setFeedback({
        kind: "error",
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({
        kind: "error",
        message: "As senhas não conferem.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await resetPassword(token, password);
      setFeedback({
        kind: "success",
        message: "Senha redefinida com sucesso. Você já pode fazer login.",
      });
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setFeedback({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível redefinir a senha.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`axis-login-root axis-${theme}`}>
      <header className="axis-login-topbar">
        <button
          className="axis-login-toggle"
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? "☀️ Claro" : "🌙 Escuro"}
        </button>
      </header>

      <main className="axis-center">
        <div className="axis-reset-card">
          <div className="axis-logo-wrapper" style={{ marginBottom: "0.25rem" }}>
            <img
              src="/axis-logo.png"
              alt="Axis Softwares"
              className="axis-logo-img"
            />
          </div>

          <h1 className="axis-reset-title">Redefinir senha</h1>
          <p className="axis-reset-description">
            Cole o token recebido por e-mail e defina uma nova senha forte.
          </p>

          <form
            className={`axis-reset-form ${showForm ? "axis-form-visible" : ""}`}
            onSubmit={handleSubmit}
          >
            <label className="axis-label">
              Token
              <input
                className="axis-input"
                type="text"
                placeholder="abcdef123..."
                value={token}
                onChange={(event) => setToken(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label className="axis-label">
              Nova senha
              <input
                className="axis-input"
                type="password"
                placeholder="Nova senha segura"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label className="axis-label">
              Confirme a senha
              <input
                className="axis-input"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <button
              type="submit"
              className="axis-button-primary"
              disabled={isSubmitting}
            >
              {buttonLabel}
            </button>
          </form>

          {feedback && (
            <p
              className={`axis-feedback ${
                feedback.kind === "error" ? "axis-error" : "axis-success"
              }`}
            >
              {feedback.message}
            </p>
          )}

          <p className="axis-reset-hint">
            Não recebeu o token? <Link to="/login">Solicite novamente</Link>.
          </p>

          <hr className="axis-reset-divider" />

          <p className="axis-reset-description">
            Retornar ao login? <Link to="/login">Clique aqui</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default ResetPasswordPage;
