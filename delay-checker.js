require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const THRESHOLD_MINUTES = 20;

async function checkDelays() {
  console.log("Checking for delayed orders...");

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, created_at, status')
    .in('status', ['placed', 'preparing']);

  if (error) {
    console.log("Error getting orders:", error.message);
    return;
  }

  for (const order of orders) {
    const minutesElapsed =
      (Date.now() - new Date(order.created_at)) / 60000;

    console.log(
      `Order ${order.id}: ${minutesElapsed.toFixed(1)} minutes`
    );

    if (minutesElapsed > THRESHOLD_MINUTES) {

      const { data: existing, error: alertError } = await supabase
        .from('delay_alerts')
        .select('id')
        .eq('order_id', order.id)
        .eq('resolved', false);

      if (alertError) {
        console.log("Error checking alert:", alertError.message);
        continue;
      }

      if (!existing.length) {
        const { error: insertError } = await supabase
          .from('delay_alerts')
          .insert({
            order_id: order.id
          });

        if (insertError) {
          console.log("Error creating alert:", insertError.message);
        } else {
          console.log(`🚨 Delay alert created for order ${order.id}`);
        }
      }
    }
  }
}

// Run once immediately
checkDelays();

// Then run every 5 minutes
cron.schedule('*/5 * * * *', () => {
  checkDelays();
});