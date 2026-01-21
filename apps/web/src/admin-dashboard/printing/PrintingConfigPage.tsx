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
import { PrinterDeviceCard } from "./PrinterDeviceCard";
import "./printing-config-page.css";

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

  const devicesWithLocation = useMemo(() => {
    const locMap = new Map(locations.map((loc) => [loc.id, loc]));
    const seenLocation = new Set<string>();

    return devices.map((device) => {
      const location = locMap.get(device.locationId) ?? null;
      const showReceiptButton = location ? !seenLocation.has(location.id) : false;

      if (location) {
        seenLocation.add(location.id);
      }

      return {
        device,
        location,
        showReceiptButton,
      };
    });
  }, [devices, locations]);

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
    <div className="axis-panels-grid printing-config-grid">
      <div className="axis-panel">
        <div className="axis-panel-header">
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
          <div className={`axis-alert printing-alert ${error ? "printing-alert-error" : "printing-alert-success"}`}>
            {error || feedback}
          </div>
        )}

        {loading ? (
          <div className="printing-loading">Carregando...</div>
        ) : (
          <>
            {devicesWithLocation.length === 0 ? (
              <div className="printing-empty-state">
                {locations.length === 0 ? "Nenhuma praca cadastrada." : "Nenhuma impressora cadastrada."}
              </div>
            ) : (
              <div className="printing-cards-grid">
                {devicesWithLocation.map(({ device, location, showReceiptButton }) => (
                  <PrinterDeviceCard
                    key={device.id}
                    device={device}
                    location={location}
                    onTest={(id) => void handleTest(id)}
                    onMarkReceipt={location && !location.isReceiptDefault ? (locId) => void handleSetReceiptDefault(locId) : undefined}
                    showReceiptButton={showReceiptButton}
                  />
                ))}
              </div>
            )}
          </>
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
              <div className="axis-form-grid printing-location-grid">
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

              <hr className="printing-modal-separator" />
              <div className="axis-form-grid printing-device-grid">
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
                <label className="axis-checkbox printing-checkbox-spaced">
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
