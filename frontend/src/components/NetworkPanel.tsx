import { useContext } from "react";
import type { NetworkSection } from "../api";
import { I18nContext, tr } from "../i18n";
import { fmtBytes, fmtRate } from "../format";

export function NetworkPanel({ network }: { network: NetworkSection }) {
  const { t } = useContext(I18nContext);
  if (network.error) {
    return (
      <p className="unavailable-note">
        {tr(t.network.unavailable, { error: network.error })}
      </p>
    );
  }
  if (network.interfaces.length === 0) {
    return <p className="muted">{t.network.noInterfaces}</p>;
  }
  return (
    <div>
      <div className="net-total">
        <span>
          <span className="net-arrow">↓</span> {fmtRate(network.rx_rate_bps)}
        </span>
        <span>
          <span className="net-arrow">↑</span> {fmtRate(network.tx_rate_bps)}
        </span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>{t.network.colInterface}</th>
            <th className="num">{t.network.colRx}</th>
            <th className="num">{t.network.colTx}</th>
            <th className="num">{t.network.colRxTotal}</th>
            <th className="num">{t.network.colTxTotal}</th>
          </tr>
        </thead>
        <tbody>
          {network.interfaces.map((iface) => (
            <tr key={iface.name}>
              <td className="truncate" title={iface.name}>
                {iface.name}
              </td>
              <td className="num">{fmtRate(iface.rx_rate_bps)}</td>
              <td className="num">{fmtRate(iface.tx_rate_bps)}</td>
              <td className="num muted">{fmtBytes(iface.rx_bytes)}</td>
              <td className="num muted">{fmtBytes(iface.tx_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
