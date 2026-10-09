import type { Order } from "./artifacts/cafe-dashboard/src/types";

export type BillingBill = {
  subtotal: number | null;
  serviceCharge: number | null;
  tax: number | null;
  total: number | null;
  isPaid: boolean | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function parseBill(payload: unknown): BillingBill {
  const response = asRecord(payload);
  const record = asRecord(response?.bill) ?? asRecord(response?.data) ?? response;
  if (!record) throw new Error("The billing API returned an invalid bill.");

  const rawStatus = record.status ?? record.payment_status;
  const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";
  const rawPaid = record.is_paid ?? record.paid;
  const isPaid =
    typeof rawPaid === "boolean"
      ? rawPaid
      : status === "paid"
        ? true
        : status === "unpaid" || status === "pending"
          ? false
          : null;

  return {
    subtotal: firstNumber(record, "subtotal"),
    serviceCharge: firstNumber(record, "service_charge", "service", "serviceCharge"),
    tax: firstNumber(record, "tax", "tax_amount", "gst"),
    total: firstNumber(record, "total"),
    isPaid,
  };
}

function formatAmount(amount: number | null) {
  return amount === null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

export default function BillingView({
  orders,
  selectedOrderId,
  bill,
  isLoading,
  isPaying,
  error,
  onSelectOrder,
  onPay,
}: {
  orders: Order[];
  selectedOrderId: string;
  bill: BillingBill | null;
  isLoading: boolean;
  isPaying: boolean;
  error: string | null;
  onSelectOrder: (orderId: string) => void;
  onPay: () => void;
}) {
  const isPaid = bill?.isPaid === true;

  return (
    <section className="orders-view">
      <div className="orders-view-heading">
        <div>
          <div className="eyebrow">Payments</div>
          <h2 className="headline">Billing, at a glance.</h2>
          <p className="subtitle">Review bills, payment status, and order totals.</p>
        </div>
        <div className="orders-total">
          <span>{orders.length.toString().padStart(2, "0")}</span> orders available
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="section-title">Order bill</h3>
            <p className="section-subtitle">Select an order to retrieve or pay its bill.</p>
          </div>
        </div>

        <div style={{ padding: "18px" }}>
          <label htmlFor="billing-order" className="section-subtitle">Select order</label>
          <select
            id="billing-order"
            className="status-select"
            value={selectedOrderId}
            onChange={(event) => onSelectOrder(event.currentTarget.value)}
            disabled={orders.length === 0}
            data-testid="select-billing-order"
          >
            {orders.length === 0 ? (
              <option value="">No orders available</option>
            ) : (
              orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} · Table {order.tables.table_number}
                </option>
              ))
            )}
          </select>
        </div>

        {error && <p role="alert" style={{ padding: "0 18px 14px" }}>{error}</p>}
        {isLoading ? (
          <p role="status" style={{ padding: "0 18px 18px" }}>Loading bill…</p>
        ) : bill ? (
          <>
            <div className="table-wrap">
              <table className="orders-table">
                <tbody>
                  <tr><th scope="row">Subtotal</th><td>{formatAmount(bill.subtotal)}</td></tr>
                  <tr><th scope="row">Service charge</th><td>{formatAmount(bill.serviceCharge)}</td></tr>
                  <tr><th scope="row">Tax</th><td>{formatAmount(bill.tax)}</td></tr>
                  <tr><th scope="row">Total</th><td><strong>{formatAmount(bill.total)}</strong></td></tr>
                  <tr>
                    <th scope="row">Payment status</th>
                    <td>
                      <span className={`status-pill ${isPaid ? "status-served" : "status-preparing"}`}>
                        {bill.isPaid === null ? "Unknown" : isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!isPaid && (
              <div className="detail-actions" style={{ padding: "16px 18px 18px" }}>
                <button
                  className="order-action advance-action"
                  type="button"
                  onClick={onPay}
                  disabled={isPaying || isLoading}
                  data-testid="action-pay-bill"
                >
                  {isPaying ? "Processing payment…" : "Mark as paid"}
                </button>
              </div>
            )}
          </>
        ) : !error && !selectedOrderId ? (
          <div className="orders-view-empty">
            <strong>No orders available</strong>
            <p>Orders will appear here when they are available.</p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
