import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Comanda,
  ComandaCustomerStatus,
  ComandaStatus,
  createComanda,
  createCustomer,
  Customer,
  searchCustomers,
  updateCustomer,
} from "../../services/api";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

type FetchState = "idle" | "loading" | "success" | "error";

const onlyDigits = (value: string) => value.replace(/\D+/g, "");

export function ComandasStartPage() {
  const [documentValue, setDocumentValue] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comandaNumber, setComandaNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [isCheckingDoc, setIsCheckingDoc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const documentDigits = useMemo(() => onlyDigits(documentValue), [documentValue]);
  const comandaDigits = useMemo(() => onlyDigits(comandaNumber), [comandaNumber]);

  useEffect(() => {
    if (!documentDigits) {
      setFoundCustomer(null);
    }
  }, [documentDigits]);

  const handleCheckDocument = async () => {
    if (!documentDigits) return;
    setIsCheckingDoc(true);
    setFeedback(null);

    try {
      const candidates = await searchCustomers({ q: documentDigits, active: true });
      const match =
        candidates.find(
          (c) => onlyDigits(c.document ?? "") === documentDigits,
        ) ?? null;

      if (match) {
        setFoundCustomer(match);
        setName(match.name ?? "");
        setPhone(match.phone ?? "");
      } else {
        setFoundCustomer(null);
      }
    } catch (err) {
      setFeedback({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : "Falha ao buscar cliente por documento.",
      });
      setFoundCustomer(null);
    } finally {
      setIsCheckingDoc(false);
    }
  };

  const resetForm = () => {
    setDocumentValue("");
    setName("");
    setPhone("");
    setComandaNumber("");
    setNotes("");
    setFoundCustomer(null);
    setFeedback(null);
  };

  const handleSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    if (!comandaDigits) {
      setFeedback({ kind: "error", message: "Informe o numero da comanda (somente numeros)." });
      return;
    }
    if (!trimmedName) {
      setFeedback({ kind: "error", message: "Informe o nome do cliente." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (foundCustomer) {
        const needsUpdate =
          trimmedName !== (foundCustomer.name ?? "") ||
          (phone.trim() || "") !== (foundCustomer.phone ?? "");
        if (needsUpdate) {
          const updated = await updateCustomer(foundCustomer.id, {
            name: trimmedName,
            phone: phone.trim() || undefined,
            document: documentDigits || undefined,
          });
          setFoundCustomer(updated);
        }
      } else {
        const created = await createCustomer({
          name: trimmedName,
          document: documentDigits || undefined,
          phone: phone.trim() || undefined,
          isActive: true,
          allowCredit: false,
        });
        setFoundCustomer(created);
      }

      const payload: {
        number: string;
        customerName: string;
        customerPhone?: string;
        customerCpf?: string;
        status: ComandaStatus;
        customerStatus: ComandaCustomerStatus;
        notes?: string;
      } = {
        number: comandaDigits,
        customerName: trimmedName,
        customerPhone: phone.trim() || undefined,
        customerCpf: documentDigits || undefined,
        status: "ABERTO",
        customerStatus: "ATIVO",
        notes: notes.trim() || undefined,
      };

      const createdComanda: Comanda = await createComanda(payload);

      setFeedback({
        kind: "success",
        message: `Comanda ${createdComanda.number} criada e vinculada ao cliente.`,
      });
      setComandaNumber("");
      setNotes("");
    } catch (err) {
      setFeedback({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Falha ao criar a comanda.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="axis-panels-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="axis-panel">
        <div className="axis-panel-header">
          <div>
            <div className="axis-panel-title">Iniciar comanda</div>
            <div className="axis-panel-subtitle">
              Busque pelo documento para reutilizar dados ou cadastre um cliente novo.
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className="axis-alert"
            style={{
              background: feedback.kind === "success" ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
              border: "1px solid rgba(148,163,184,0.3)",
              padding: "0.65rem 0.75rem",
              borderRadius: "0.75rem",
              color: "inherit",
              marginBottom: "0.35rem",
            }}
          >
            {feedback.message}
          </div>
        )}

        {foundCustomer && (
          <div
            style={{
              padding: "0.65rem 0.75rem",
              borderRadius: "0.75rem",
              background: "rgba(94, 234, 212, 0.12)",
              border: "1px solid rgba(94, 234, 212, 0.35)",
              marginBottom: "0.35rem",
            }}
          >
            Cliente localizado: <strong>{foundCustomer.name}</strong>{" "}
            {foundCustomer.document ? `• CPF: ${foundCustomer.document}` : ""}{" "}
            {foundCustomer.phone ? `• Tel: ${foundCustomer.phone}` : ""}
          </div>
        )}

        <form onSubmit={handleSubmit} className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.8rem" }}>
          <label className="axis-label">
            Documento (CPF)
            <input
              className="axis-input"
              placeholder="Digite o CPF e saia do campo para buscar"
              value={documentValue}
              onChange={(e) => setDocumentValue(e.target.value)}
              onBlur={handleCheckDocument}
              disabled={isSubmitting}
              inputMode="numeric"
            />
            {isCheckingDoc && <small>Buscando cliente...</small>}
          </label>

          <label className="axis-label">
            Nome
            <input
              className="axis-input"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="axis-label">
            Celular
            <input
              className="axis-input"
              placeholder="(99) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="axis-label">
            Numero da comanda
            <input
              className="axis-input"
              placeholder="Somente numeros"
              value={comandaDigits}
              onChange={(e) => setComandaNumber(e.target.value)}
              disabled={isSubmitting}
              inputMode="numeric"
            />
          </label>

          <label className="axis-label" style={{ gridColumn: "1 / -1" }}>
            Observacoes (opcional)
            <textarea
              className="axis-input"
              rows={2}
              placeholder="Alguma nota rapida sobre a comanda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <div className="axis-form-actions" style={{ gridColumn: "1 / -1", gap: "0.5rem" }}>
            <button
              type="button"
              className="axis-button-secondary"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="axis-admin-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Criando..." : "Criar comanda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComandasStartPage;
