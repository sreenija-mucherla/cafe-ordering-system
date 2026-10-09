export default function CafeAssistantView() {
  return (
    <section className="orders-view">
      <div className="orders-view-heading">
        <div>
          <div className="eyebrow">Brewly AI</div>
          <h2 className="headline">Café Assistant</h2>
          <p className="subtitle">
            Ask questions about the menu, policies, and café operations.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="section-title">Ask the Assistant</h3>
            <p className="section-subtitle">
              Answers will be grounded in Brewly's café knowledge.
            </p>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <p>Try asking:</p>

          <div style={{ display: "grid", gap: "8px" }}>
            <div className="orders-filter">
              What ingredients are in the Chicken Nachos?
            </div>

            <div className="orders-filter">
              Which items are vegetarian?
            </div>

            <div className="orders-filter">
              What is the café delay policy?
            </div>

            <div className="orders-filter">
              Recommend something under ₹300.
            </div>
          </div>

          <div className="clear-state" style={{ marginTop: "20px" }}>
            <strong>AI response will appear here</strong>
            <p>
              RAG will connect the assistant to Brewly's menu,
              ingredients, policies, and café knowledge.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}