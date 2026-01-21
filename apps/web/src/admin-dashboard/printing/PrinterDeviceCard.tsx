import type { PrinterDevice, PrinterLocation } from "../../services/api";

type PrinterDeviceCardProps = {
  device: PrinterDevice;
  location: PrinterLocation | null;
  onTest: (deviceId: string) => void;
  onMarkReceipt?: (locationId: string) => void;
  showReceiptButton?: boolean;
};

function LabelValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="printing-label-value">
      <span className="printing-label-value__label">{label}:</span>
      <span className="printing-label-value__value">{value ?? "-"}</span>
    </div>
  );
}

export function PrinterDeviceCard({ device, location, onTest, onMarkReceipt, showReceiptButton }: PrinterDeviceCardProps) {
  const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("pt-BR") : "-";
  const canMarkReceipt = Boolean(showReceiptButton && location && !location.isReceiptDefault && onMarkReceipt);

  return (
    <div className="printer-card">
      <div className="printer-card-header">
        <div className="printer-card-title">
          <div className="printer-card-name-row">
            <span className="printer-card-name">{device.name}</span>
            {!device.isActive && <span className="axis-tag">Inativa</span>}
          </div>
          <div className="printer-card-location">
            <span className="printer-card-location-dot" />
            <span className="printer-card-location-name">{location?.name ?? "Sem praca"}</span>
            {location?.isReceiptDefault && <span className="axis-tag axis-tag-primary">Recibo</span>}
          </div>
        </div>
        {canMarkReceipt && location && (
          <button
            type="button"
            className="axis-button axis-button-secondary printer-card-receipt-btn"
            onClick={() => onMarkReceipt(location.id)}
          >
            Marcar praca como recibo
          </button>
        )}
      </div>

      <div className="printer-card-meta">
        <LabelValue label="Tipo" value={`${device.type} / ${device.interface}`} />
        <LabelValue label="Host" value={device.host ?? "-"} />
        <LabelValue label="Porta" value={device.port ?? "-"} />
        <LabelValue label="Estacao" value={device.workstationId ?? "-"} />
        <LabelValue label="Ultimo contato" value={lastSeen} />
      </div>

      <div className="printer-card-actions">
        <button
          type="button"
          className="axis-button axis-button-secondary"
          onClick={() => onTest(device.id)}
        >
          Imprimir teste
        </button>
      </div>
    </div>
  );
}

export default PrinterDeviceCard;
