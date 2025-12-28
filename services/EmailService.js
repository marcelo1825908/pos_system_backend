const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Mailtrap configuration
    this.transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "d7286e1afd11a3",
        pass: "1a31de5ffc70a6"
      }
    });
  }

  /**
   * Send receipt email (supports both payment and POS receipts)
   */
  async sendReceiptEmail(receiptData) {
    try {
      const { email, type = 'payment' } = receiptData;

      if (!email) {
        throw new Error('Email address is required');
      }

      let htmlContent, subject;

      if (type === 'pos') {
        // POS Receipt
        const result = this.generatePOSReceiptHTML(receiptData);
        htmlContent = result.html;
        subject = result.subject;
      } else {
        // Payment Receipt (existing functionality)
        const result = this.generatePaymentReceiptHTML(receiptData);
        htmlContent = result.html;
        subject = result.subject;
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: '"Retail Store" <noreply@retailstore.com>',
        to: email,
        subject,
        html: htmlContent
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email send error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Generate HTML for payment receipt
   */
  generatePaymentReceiptHTML(receiptData) {
    const {
      transaction_id,
      payment_method,
      amount,
      member_name,
      payment_type,
      details,
      timestamp
    } = receiptData;

    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
          }
          .receipt-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #ddd;
          }
          .receipt-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
          .value {
            color: #333;
          }
          .total {
            font-size: 1.3em;
            font-weight: bold;
            color: #27ae60;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #27ae60;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #777;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment Receipt</h1>
          <p>Thank you for your payment</p>
        </div>
        
        <div class="content">
          <div class="receipt-row">
            <span class="label">Transaction ID:</span>
            <span class="value">${transaction_id}</span>
          </div>
          
          <div class="receipt-row">
            <span class="label">Date:</span>
            <span class="value">${formattedDate}</span>
          </div>
          
          <div class="receipt-row">
            <span class="label">Time:</span>
            <span class="value">${formattedTime}</span>
          </div>
          
          <div class="receipt-row">
            <span class="label">Member:</span>
            <span class="value">${member_name}</span>
          </div>
          
          <div class="receipt-row">
            <span class="label">Payment Type:</span>
            <span class="value">${payment_type}</span>
          </div>
          
          ${details ? `
          <div class="receipt-row">
            <span class="label">Details:</span>
            <span class="value">${details}</span>
          </div>
          ` : ''}
          
          <div class="receipt-row">
            <span class="label">Payment Method:</span>
            <span class="value">${payment_method}</span>
          </div>
          
          <div class="total">
            <div class="receipt-row">
              <span class="label">Total Amount:</span>
              <span class="value">€ ${amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated receipt. Please keep it for your records.</p>
          <p>If you have any questions, please contact us.</p>
        </div>
      </body>
      </html>
    `;

    return {
      html,
      subject: `Payment Receipt - ${transaction_id}`
    };
  }

  /**
   * Generate HTML for POS receipt
   */
  generatePOSReceiptHTML(receiptData) {
    const {
      orderNumber,
      date,
      time,
      cart = [],
      subTotal = 0,
      tax = 0,
      discount = 0,
      total = 0
    } = receiptData;

    const itemsHTML = cart.map(item => {
      const itemPrice = typeof item.price === 'number' ? item.price : 0;
      const itemQty = typeof item.quantity === 'number' ? item.quantity : 0;
      const itemTotal = itemPrice * itemQty;
      const hasSubProducts = Array.isArray(item.subProducts) && item.subProducts.length > 0;

      // Sub-products HTML
      let subProductsHTML = '';
      if (hasSubProducts) {
        subProductsHTML = item.subProducts.map(subItem => {
          const subPrice = typeof subItem.price === 'number' ? subItem.price : 0;
          const subQty = typeof subItem.quantity === 'number' ? subItem.quantity : 0;
          const subTotal = subPrice * subQty;
          
          return `
            <tr>
              <td style="padding: 4px 0 4px 20px; border-bottom: 1px solid #f5f5f5;">
                <span style="color: #666; font-size: 0.85em;">+ ${subItem.name || 'Unknown Sub-Item'}</span><br>
                <span style="color: #999; font-size: 0.8em;">${subQty} x €${subPrice.toFixed(2)}</span>
              </td>
              <td style="padding: 4px 0; border-bottom: 1px solid #f5f5f5; text-align: right; color: #666; font-size: 0.9em;">
                €${subTotal.toFixed(2)}
              </td>
            </tr>
          `;
        }).join('');
      }

      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <strong>${item.name || 'Unknown Item'}</strong><br>
            <span style="color: #666; font-size: 0.9em;">${itemQty} x €${itemPrice.toFixed(2)}</span>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
            €${itemTotal.toFixed(2)}
          </td>
        </tr>
        ${subProductsHTML}
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .receipt-container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background-color: #2c3e50;
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          .header p {
            margin: 3px 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 30px;
          }
          .info-section {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 14px;
          }
          .info-label {
            color: #666;
          }
          .info-value {
            font-weight: bold;
            color: #333;
          }
          .items-table {
            width: 100%;
            margin: 20px 0;
            border-collapse: collapse;
          }
          .summary-section {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }
          .summary-total {
            display: flex;
            justify-content: space-between;
            padding: 15px 0;
            margin-top: 10px;
            border-top: 2px solid #27ae60;
            font-size: 18px;
            font-weight: bold;
            color: #27ae60;
          }
          .footer {
            text-align: center;
            padding: 20px;
            background-color: #f9f9f9;
            color: #666;
            font-size: 14px;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <h1>RETAIL STORE</h1>
            <p>123 Main Street</p>
            <p>City, State 12345</p>
            <p>Tel: (555) 123-4567</p>
          </div>
          
          <div class="content">
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Order #:</span>
                <span class="info-value">${orderNumber}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${date}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Time:</span>
                <span class="info-value">${time}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Cashier:</span>
                <span class="info-value">001</span>
              </div>
            </div>

            <h3 style="margin: 20px 0 10px 0; color: #2c3e50;">Items</h3>
            <table class="items-table">
              ${itemsHTML}
            </table>

            <div class="summary-section">
              <div class="summary-row">
                <span>Subtotal:</span>
                <span>€${subTotal.toFixed(2)}</span>
              </div>
              ${tax > 0 ? `
              <div class="summary-row">
                <span>Tax (12%):</span>
                <span>€${tax.toFixed(2)}</span>
              </div>
              ` : ''}
              ${discount > 0 ? `
              <div class="summary-row">
                <span>Discount:</span>
                <span>-€${discount.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="summary-total">
                <span>TOTAL:</span>
                <span>€${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for your purchase!</strong></p>
            <p>Please keep this receipt for your records</p>
            <p>Visit us again soon!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      html,
      subject: `Receipt - Order #${orderNumber}`
    };
  }
}

module.exports = new EmailService();
