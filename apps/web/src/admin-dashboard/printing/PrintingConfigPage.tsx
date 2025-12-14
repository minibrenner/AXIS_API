import { useEffect, useMemo, useState } from "react";
import {
  PrinterDevice,
  PrinterDeviceType,
  PrinterInterface,
  PrinterLocation,
  createPrinterDevice,
  createPrinterLocation,
  listPrinterDevices,
  listPrinterLocations,
  testPrinterDevice,
  updatePrinterLocation,
} from "../../services/api";

const deviceTypes: { id: PrinterDeviceType; label: string }[] = [
  { id: "NETWORK", label: "Rede" },
  { id: "USB", label: "USB" },
  { id: "WINDOWS", label: "Windows" },
];

const interfaces: { id: PrinterInterface; label: string }[] = [
  { id: "TCP", label: "TCP" },
  { id: "USB", label: "USB" },
  { id: "WINDOWS_DRIVER", label: "Windows driver" },
];

function LabelValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.9rem" }}>
      <span style={{ opacity: 0.75 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value ?? "-"}</span>
    </div>
  );
}

export function PrintingConfigPage() {
  const [locations, setLocations] = useState<PrinterLocation[]>([]);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [locName, setLocName] = useState("");
  const [locReceipt, setLocReceipt] = useState(false);
  const [devName, setDevName] = useState("");
  const [devType, setDevType] = useState<PrinterDeviceType>("NETWORK");
  const [devInterface, setDevInterface] = useState<PrinterInterface>("TCP");
  const [devHost, setDevHost] = useState("");
  const [devPort, setDevPort] = useState<number | "">(9100);
  const [devWorkstation, setDevWorkstation] = useState("");
  const [devActive, setDevActive] = useState(true);

  const locationsWithDevices = useMemo(() => {
    return locations.map((loc) => ({
      ...loc,
      devices: devices.filter((d) => d.locationId === loc.id),
    }));
  }, [locations, devices]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locs, devs] = await Promise.all([listPrinterLocations(), listPrinterDevices()]);
      setLocations(locs);
      setDevices(devs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar impressoras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetModal = () => {
    setLocName("");
    setLocReceipt(false);
    setDevName("");
    setDevType("NETWORK");
    setDevInterface("TCP");
    setDevHost("");
    setDevPort(9100);
    setDevWorkstation("");
    setDevActive(true);
  };

  const handleCreate = async () => {
    if (!locName.trim() || !devName.trim()) {
      setError("Preencha nome da praca e da impressora.");
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const location = await createPrinterLocation({ name: locName.trim(), isReceiptDefault: locReceipt });
      await createPrinterDevice({
        name: devName.trim(),
        type: devType,
        interface: devInterface,
        host: devHost.trim() || null,
        port: devPort === "" ? null : Number(devPort),
        locationId: location.id,
        isActive: devActive,
        workstationId: devWorkstation.trim() || null,
      });
      setFeedback("Praca e impressora cadastradas com sucesso.");
      setModalOpen(false);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetReceiptDefault = async (id: string) => {
    try {
      await updatePrinterLocation(id, { isReceiptDefault: true });
      setFeedback("Praca marcada como padrao de recibo.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao marcar padrao.");
    }
  };

  const handleTest = async (deviceId: string) => {
    try {
      await testPrinterDevice(deviceId);
      setFeedback("Job de teste enviado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar teste.");
    }
  };

  return (
    <div className="axis-panels-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="axis-panel">
        <div className="axis-panel-header" style={{ alignItems: "center" }}>
          <div>
            <div className="axis-panel-title">Configurar pracas e impressoras</div>
            <div className="axis-panel-subtitle">
              Cadastre pracas (bar, cozinha, caixa) e vincule impressoras. Marque a praca que imprime recibos/pagamentos.
            </div>
          </div>
          <button type="button" className="axis-admin-button-primary" onClick={() => setModalOpen(true)}>
            Nova praca + impressora
          </button>
        </div>

        {(error || feedback) && (
          <div
            className="axis-alert"
            style={{
              background: error ? "rgba(248,113,113,0.12)" : "rgba(34,197,94,0.12)",
              border: "1px solid rgba(148,163,184,0.35)",
              padding: "0.65rem 0.8rem",
              borderRadius: "0.75rem",
              marginBottom: "0.6rem",
            }}
          >
            {error || feedback}
          </div>
        )}

        {loading ? (
          <div style={{ opacity: 0.8 }}>Carregando...</div>
        ) : (
          <div className="axis-list" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {locationsWithDevices.map((loc) => (
              <div
                key={loc.id}
                className="axis-list-item"
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", border: "1px solid rgba(148,163,184,0.35)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{loc.name}</span>
                    {loc.isReceiptDefault && (
                      <span className="axis-tag axis-tag-primary">Recibo</span>
                    )}
                  </div>
                  {!loc.isReceiptDefault && (
                    <button
                      type="button"
                      className="axis-button axis-button-secondary"
                      onClick={() => void handleSetReceiptDefault(loc.id)}
                    >
                      Marcar como recibo
                    </button>
                  )}
                </div>

                {loc.devices.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>Nenhuma impressora vinculada.</div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "0.75rem",
                    }}
                  >
                    {loc.devices.map((dev) => (
                      <div
                        key={dev.id}
                        style={{
                          border: "1px solid rgba(148,163,184,0.3)",
                          borderRadius: 10,
                          padding: "0.6rem 0.8rem",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <strong>{dev.name}</strong>
                            {!dev.isActive && <span className="axis-tag">Inativa</span>}
                          </div>
                          <LabelValue label="Tipo" value={`${dev.type} / ${dev.interface}`} />
                          <LabelValue label="Host" value={dev.host ?? "-"} />
                          <LabelValue label="Porta" value={dev.port ?? "-"} />
                          <LabelValue label="Estacao" value={dev.workstationId ?? "-"} />
                          <LabelValue label="Ultimo contato" value={dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleString("pt-BR") : "-"} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            className="axis-button axis-button-secondary"
                            onClick={() => void handleTest(dev.id)}
                          >
                            Imprimir teste
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {locationsWithDevices.length === 0 && <div style={{ opacity: 0.8 }}>Nenhuma praca cadastrada.</div>}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="axis-modal-backdrop">
          <div className="axis-modal axis-modal-sm">
            <header className="axis-modal-header">
              <div className="axis-modal-title-group">
                <h1 className="axis-modal-title">Nova praca e impressora</h1>
                <p className="axis-modal-subtitle">Cadastre a praca e vincule a impressora.</p>
              </div>
            </header>
            <section className="axis-modal-body">
              <div className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <label className="axis-label">
                  Nome da praca
                  <input className="axis-input" value={locName} onChange={(e) => setLocName(e.target.value)} />
                </label>
                <label className="axis-checkbox">
                  <input
                    type="checkbox"
                    checked={locReceipt}
                    onChange={(e) => setLocReceipt(e.target.checked)}
                  />
                  <span>Usar esta praca para recibos/pagamentos</span>
                </label>
              </div>

              <hr style={{ opacity: 0.25, margin: "0.8rem 0" }} />
              <div className="axis-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label className="axis-label">
                  Nome da impressora
                  <input className="axis-input" value={devName} onChange={(e) => setDevName(e.target.value)} />
                </label>
                <label className="axis-label">
                  Tipo
                  <select className="axis-input" value={devType} onChange={(e) => setDevType(e.target.value as PrinterDeviceType)}>
                    {deviceTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="axis-label">
                  Interface
                  <select
                    className="axis-input"
                    value={devInterface}
                    onChange={(e) => setDevInterface(e.target.value as PrinterInterface)}
                  >
                    {interfaces.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="axis-label">
                  Host/IP
                  <input className="axis-input" value={devHost} onChange={(e) => setDevHost(e.target.value)} placeholder="192.168.0.50" />
                </label>
                <label className="axis-label">
                  Porta
                  <input
                    className="axis-input"
                    type="number"
                    inputMode="numeric"
                    value={devPort}
                    onChange={(e) => setDevPort(Number(e.target.value) || "")}
                    placeholder="9100"
                  />
                </label>
                <label className="axis-label">
                  Estacao/caixa (opcional)
                  <input
                    className="axis-input"
                    value={devWorkstation}
                    onChange={(e) => setDevWorkstation(e.target.value)}
                    placeholder="caixa1-asus"
                  />
                </label>
                <label className="axis-checkbox" style={{ marginTop: "0.2rem" }}>
                  <input
                    type="checkbox"
                    checked={devActive}
                    onChange={(e) => setDevActive(e.target.checked)}
                  />
                  <span>Impressora ativa</span>
                </label>
              </div>
            </section>
            <footer className="axis-modal-footer">
              <button
                type="button"
                className="axis-button axis-button-secondary"
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="axis-button axis-button-primary"
                onClick={() => void handleCreate()}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrintingConfigPage;
