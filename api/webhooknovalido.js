 module.exports = async (req, res) => {
   if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
   console.log('Webhook received:', req.body);
   res.json({ received: true });
 };
 // 1) Importar dependencias
 const mysql = require('mysql2/promise');
 const axios = require('axios');
 
 // 2) Crear pool de conexiones MySQL
 const pool = mysql.createPool({
   host:     process.env.DB_HOST,
   user:     process.env.DB_USER,
   password: process.env.DB_PASS,
   database: process.env.DB_NAME,
   waitForConnections: true,
   connectionLimit: 5
 });
 
 module.exports = async (req, res) => {
   // 3) Solo POST
   if (req.method !== 'POST') {
     return res.status(405).end('Method Not Allowed');
   }
 
   // 4) Extraer payment_id del payload de MP
   const paymentId = req.body?.data?.id;
   if (!paymentId) {
     return res.status(400).json({ error: 'missing_payment_id' });
   }
 
   try {
     // 5) Consultar detalle de pago en Mercado Pago
     const mpDetail = await axios.get(
       `https://api.mercadopago.com/v1/payments/${paymentId}`,
       { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
     );
     const pay = mpDetail.data;
 
     // 6) Extraer campos clave
     const extRef = pay.external_reference;               // tu referencia interna
     const status = pay.status;                           // approved, pending, etc.
     const total  = pay.transaction_amount;               // monto total pagado
     const email  = pay.payer?.email || null;             // email del cliente
     const phone  = pay.payer?.phone?.number || null;     // teléfono si existe
     const items  = pay.additional_info?.items || [];     // detalle de ítems
 
     // 7) Guardar/actualizar en MySQL
     const conn = await pool.getConnection();
     await conn.beginTransaction();
 
     // 7.1) ¿Ya existe un pedido con esta external_reference?
     const [rows] = await conn.query(
       'SELECT id FROM orders WHERE external_reference = ?',
       [extRef]
     );
 
     let orderId;
     if (rows.length) {
       // 7.2) Actualizar estado y datos de contacto
       orderId = rows[0].id;
       await conn.query(
         `UPDATE orders
            SET status = ?, email = ?, phone = ?, total_amount = ?
          WHERE id = ?`,
         [status, email, phone, total, orderId]
       );
     } else {
       // 7.3) Insertar un nuevo pedido
       const [result] = await conn.query(
         `INSERT INTO orders
            (external_reference, status, email, phone, total_amount)
          VALUES (?,?,?,?,?)`,
         [extRef, status, email, phone, total]
       );
       orderId = result.insertId;
     }
 
     // 8) Reemplazar detalle de ítems (limpiar e insertar)
     if (items.length) {
       await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
       for (const it of items) {
         await conn.query(
           `INSERT INTO order_items
              (order_id, title, quantity, unit_price)
            VALUES (?,?,?,?)`,
           [orderId, it.title, it.quantity, it.unit_price]
         );
       }
     }
 
     // 9) Commit y respuesta
     await conn.commit();
     conn.release();
     return res.status(200).json({ received: true });
   } catch (error) {
     console.error('Webhook error:', error);
     if (conn) await conn.rollback();
     return res.status(500).json({ error: 'internal_error' });
   }
 };
