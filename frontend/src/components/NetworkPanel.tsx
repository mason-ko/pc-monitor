import type { NetworkSection } from "../api";
import { fmtBytes, fmtRate } from "../format";

export function NetworkPanel({ network }: { network: NetworkSection }) {
  if (network.error) {
    return <p className="unavailable-note">Network data unavailable: {network.error}</p>;
  }
  if (network.interfaces.length === 0) {
    return <p className="muted">No network interfaces found.</p>;
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
            <th>Interface</th>
            <th className="num">RX</th>
            <th className="num">TX</th>
            <th className="num">RX total</th>
            <th className="num">TX total</th>
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
