type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_count: number;
  is_available: boolean;
};

export default function InventoryView({
  items,
  isLoading,
  error,
}: {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <main className="orders-view">
      <div className="orders-view-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 className="headline">Menu Stock</h1>
          <p className="subtitle">
            Monitor current availability across the café menu.
          </p>
        </div>

        <div className="orders-total">
          <span>{items.length.toString().padStart(2, "0")}</span>
          Menu Items
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="section-title">Current Stock</h2>
            <p className="section-subtitle">Live menu and availability from the backend.</p>
          </div>
        </div>

        {error && <p role="alert" style={{ padding: "0 18px 14px" }}>{error}</p>}
        {isLoading ? (
          <p role="status" style={{ padding: "0 18px 18px" }}>Loading menu…</p>
        ) : error ? null : items.length === 0 ? (
          <div className="orders-view-empty">
            <strong>No menu items available</strong>
            <p>The backend returned an empty menu.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>₹{item.price.toFixed(2)}</td>
                    <td>{item.stock_count}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.is_available ? "status-served" : "status-cancelled"
                        }`}
                      >
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
