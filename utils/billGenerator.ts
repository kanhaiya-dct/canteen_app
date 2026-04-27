import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

export const generateProfessionalBill = async (order: any, items: any[]) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; margin: 0; padding: 40px; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #FF9800; padding-bottom: 20px; }
          .logo { color: #FF9800; font-size: 28px; font-weight: bold; margin: 0; }
          .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
          
          .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info-box h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #999; }
          .info-box p { margin: 2px 0; font-size: 15px; font-weight: 500; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #F9F9F9; text-align: left; padding: 12px; font-size: 13px; color: #666; border-bottom: 1px solid #EEE; }
          td { padding: 12px; font-size: 15px; border-bottom: 1px solid #F0F0F0; }
          
          .total-section { margin-top: 30px; text-align: right; }
          .total-row { display: flex; justify-content: flex-end; align-items: center; }
          .total-label { font-size: 18px; margin-right: 15px; color: #666; }
          .total-value { font-size: 24px; font-weight: bold; color: #FF9800; }
          
          .footer { margin-top: 60px; text-align: center; border-top: 1px dashed #CCC; padding-top: 20px; font-size: 12px; color: #999; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .status-paid { background-color: #E8F5E9; color: #2E7D32; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="logo">SD Institute of Management & Tech</p>
          <p class="subtitle">Official Canteen Receipt - NH-24, Delhi-Hapur Road, Ghaziabad</p>
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>Bill To:</h3>
            <p><strong>${order.studentName}</strong></p>
            <p>Class: ${order.studentClass}</p>
            <p>Ph: ${order.studentMobile}</p>
          </div>
          <div class="info-box" style="text-align: right;">
            <h3>Order Info:</h3>
            <p>Order ID: <strong>#${order.id}</strong></p>
            <p>Date: ${format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
            <span class="badge status-paid">Payment: Verified</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">₹${item.price}</td>
                <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Grand Total:</span>
            <span class="total-value">₹${order.totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated receipt. No signature required.</p>
          <p>Please show this bill at the counter to collect your order.</p>
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html: htmlContent });
  await Sharing.shareAsync(uri);
};
