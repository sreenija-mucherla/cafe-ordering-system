require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
console.log("Supabase client created:", !!supabase);
console.log("URL loaded:", !!process.env.SUPABASE_URL);
console.log("KEY loaded:", !!process.env.SUPABASE_SERVICE_KEY);


// GET /menu
app.get('/menu', async (req, res) => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, price, category, stock_count, is_available')
    .order('category');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /order
app.post('/order', async (req, res) => {
  const { table_id, items } = req.body;

  if (!table_id || !items?.length) {
    return res.status(400).json({ error: 'table_id and items required' });
  }

  // Check that all requested items have enough stock
  for (const item of items) {
    const { data: menuItem, error } = await supabase
      .from('menu_items')
      .select('id, price, stock_count')
      .eq('id', item.menu_item_id)
      .single();

    if (error || !menuItem) {
      return res.status(404).json({
        error: 'MENU_ITEM_NOT_FOUND',
        item_id: item.menu_item_id
      });
    }

    if (menuItem.stock_count < item.quantity) {
      return res.status(409).json({
        error: 'ITEM_OUT_OF_STOCK',
        item_id: item.menu_item_id
      });
    }
  }

  // Create the order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      table_id,
      status: 'placed'
    })
    .select()
    .single();

  if (orderErr) {
    return res.status(500).json({ error: orderErr.message });
  }

  // Reduce stock and create order items
  for (const item of items) {

    const { data: ok, error: stockErr } = await supabase
      .rpc('place_order_item', {
        p_menu_item_id: item.menu_item_id,
        p_qty: item.quantity
      });

    if (stockErr || !ok) {
      return res.status(409).json({
        error: 'ITEM_OUT_OF_STOCK',
        item_id: item.menu_item_id
      });
    }

    const { data: menuItem, error: menuErr } = await supabase
      .from('menu_items')
      .select('price')
      .eq('id', item.menu_item_id)
      .single();

    if (menuErr) {
      return res.status(500).json({ error: menuErr.message });
    }

    const { error: itemErr } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price_at_order: menuItem.price
      });

    if (itemErr) {
      return res.status(500).json({ error: itemErr.message });
    }
  }

  res.status(201).json({
    order_id: order.id,
    status: 'placed'
  });
});

app.get('/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      created_at,
      table_id,
      tables (
        table_number
      ),
      order_items (
        quantity,
        menu_items (
          name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});
// GET /order/:table_id — latest active order for that table
app.get('/order/:table_id', async (req, res) => {
  const { table_id } = req.params;

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .eq('table_id', table_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return res.status(404).json({ error: 'No active order found' });

  const { data: items } = await supabase
    .from('order_items')
    .select('menu_item_id, quantity, price_at_order, menu_items(name)')
    .eq('order_id', order.id);

  const { data: alert } = await supabase
    .from('delay_alerts')
    .select('id')
    .eq('order_id', order.id)
    .eq('resolved', false)
    .limit(1);

  res.json({
    order_id: order.id,
    status: order.status,
    items,
    created_at: order.created_at,
    delay_alert: !!(alert && alert.length)
  });
});

// PATCH /order/:id/status
 app.patch('/order/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    'placed',
    'preparing',
    'served',
    'paid',
    'cancelled'
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status'
    });
  }

  // Special handling for cancellation
  if (status === 'cancelled') {
    const { data, error } = await supabase.rpc(
      'cancel_order_restore_stock',
      {
        p_order_id: id
      }
    );

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    if (!data) {
      return res.status(400).json({
        error: 'Order cannot be cancelled'
      });
    }

    return res.json({
      message: 'Order cancelled and stock restored',
      status: 'cancelled'
    });
  }

  // Normal status change
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});

// GET /bill/:order_id
app.get('/bill/:order_id', async (req, res) => {
  const { order_id } = req.params;
  const { data, error } = await supabase
    .from('bills')
    .select('subtotal, service_charge, tax, total, paid, pdf_url')
    .eq('order_id', order_id)
    .single();

  if (error || !data) {
    // Bill not generated yet — calculate on the fly
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, price_at_order')
      .eq('order_id', order_id);

    if (!items?.length) return res.status(404).json({ error: 'Order not found' });

    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price_at_order, 0);
    const service_charge = +(subtotal * 0.05).toFixed(2);
    const tax = +(subtotal * 0.05).toFixed(2); // adjust GST rate as needed
    const total = +(subtotal + service_charge + tax).toFixed(2);

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .insert({ order_id, subtotal, service_charge, tax, total, paid: false })
      .select()
      .single();
    if (billErr) return res.status(500).json({ error: billErr.message });

    return res.json(bill);
  }

  res.json(data);
});

// POST /bill/:order_id/pay
app.post('/bill/:order_id/pay', async (req, res) => {
  const { order_id } = req.params;
  const { error } = await supabase
    .from('bills')
    .update({ paid: true })
    .eq('order_id', order_id);
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('orders').update({ status: 'paid' }).eq('id', order_id);
  res.json({ paid: true });
});

// GET /alerts
app.get('/alerts', async (req, res) => {
  const { data, error } = await supabase
    .from('delay_alerts')
    .select('order_id, flagged_at, orders(table_id, tables(table_number))')
    .eq('resolved', false);
  if (error) return res.status(500).json({ error: error.message });

  const result = data.map(a => ({
    order_id: a.order_id,
    table_number: a.orders?.tables?.table_number,
    flagged_at: a.flagged_at,
    minutes_delayed: Math.floor((Date.now() - new Date(a.flagged_at)) / 60000)
  }));
  res.json(result);
});
// PATCH /alerts/:id/resolve
app.patch('/alerts/:id/resolve', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('delay_alerts')
    .update({ resolved: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    message: 'Alert resolved',
    alert: data
  });
});

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));