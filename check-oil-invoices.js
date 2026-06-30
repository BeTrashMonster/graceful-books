// Quick script to check Oil component invoices
import Dexie from 'dexie';

const db = new Dexie('TreasureChest');
db.version(1).stores({
  cpgInvoices: 'id, company_id, vendor_name, invoice_date, invoice_number',
});

async function checkOilInvoices() {
  try {
    // Get all invoices
    const allInvoices = await db.cpgInvoices.toArray();
    console.log('Total invoices:', allInvoices.length);
    
    // Filter invoices that have "Oil" in line items
    const oilInvoices = allInvoices.filter(invoice => {
      return invoice.line_items?.some(item => 
        item.component_name?.toLowerCase().includes('oil')
      );
    });
    
    console.log('\n=== OIL INVOICES ===');
    console.log('Count:', oilInvoices.length);
    
    oilInvoices.forEach(invoice => {
      console.log('\nInvoice:', invoice.invoice_number);
      console.log('Date:', new Date(invoice.invoice_date).toLocaleDateString());
      console.log('Vendor:', invoice.vendor_name);
      
      const oilItems = invoice.line_items.filter(item => 
        item.component_name?.toLowerCase().includes('oil')
      );
      
      oilItems.forEach(item => {
        console.log('  Component:', item.component_name);
        console.log('  Quantity:', item.quantity);
        console.log('  Total:', item.total_cost);
        console.log('  Price per unit:', parseFloat(item.total_cost) / parseFloat(item.quantity));
      });
    });
    
    // Calculate average
    let totalPrice = 0;
    let count = 0;
    
    oilInvoices.forEach(invoice => {
      invoice.line_items?.forEach(item => {
        if (item.component_name?.toLowerCase().includes('oil')) {
          const pricePerUnit = parseFloat(item.total_cost) / parseFloat(item.quantity);
          totalPrice += pricePerUnit;
          count++;
        }
      });
    });
    
    console.log('\n=== CALCULATION ===');
    console.log('Total price sum:', totalPrice);
    console.log('Number of invoices:', count);
    console.log('Average:', totalPrice / count);
    console.log('Most recent price:', oilInvoices.length > 0 ? 'See above' : 'N/A');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOilInvoices();
