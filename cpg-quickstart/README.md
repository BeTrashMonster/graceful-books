# CPG Quick Start Worksheet

A standalone web application that helps CPG (Consumer Packaged Goods) business owners set up their entire cost tracking system in one focused session.

## Overview

This worksheet collects:
- **Ingredient Categories** (with variants)
- **Finished Products** (name, MSRP, SKU)
- **Product Recipes** (what goes into each product)
- **Purchase Invoices** (optional)

Users fill out the worksheet between March 5 - April 1, 2026, then import their data into the full software on April 1.

## Features

- ✅ Multi-step wizard with 6 steps
- ✅ Auto-save to localStorage (no data loss)
- ✅ Persistent summary panel showing progress
- ✅ Click any section to edit
- ✅ Visual connections between steps
- ✅ JSON export for April 1 import
- ✅ Mobile responsive
- ✅ Keyboard accessible

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Runs on http://localhost:3001

### Build for Production

```bash
npm run build
```

Output goes to `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Option 1: Deploy to audacious.money

1. Build the app:
   ```bash
   npm run build
   ```

2. Upload the contents of the `dist/` folder to your web server at audacious.money

3. Configure your web server to:
   - Serve `index.html` for all routes (SPA routing)
   - Set proper MIME types
   - Enable gzip compression

### Option 2: Netlify/Vercel (Recommended)

1. Push this folder to a GitHub repository

2. Connect to Netlify or Vercel:
   - Build command: `npm run build`
   - Publish directory: `dist`

3. Deploy automatically on push

### Option 3: Static File Host

Simply upload the `dist/` folder to any static file host (AWS S3, GitHub Pages, etc.)

## Data Format

The worksheet exports a JSON file matching this structure:

```json
{
  "version": "1.0.0",
  "created_at": "2026-03-05T12:00:00.000Z",
  "categories": [
    {
      "id": "temp-123",
      "name": "Bottles",
      "variants": ["4 oz", "8 oz", "16 oz"],
      "sort_order": 0
    }
  ],
  "finished_products": [
    {
      "id": "temp-456",
      "name": "Lavender Body Lotion",
      "msrp": "24.99",
      "sku": "LBL-8OZ",
      "category_id": "temp-789",
      "variant": "8 oz"
    }
  ],
  "recipes": [
    {
      "product_id": "temp-456",
      "items": [
        {
          "category_id": "temp-123",
          "variant": "8 oz",
          "quantity": "1",
          "unit": "bottle"
        }
      ]
    }
  ],
  "invoices": [
    {
      "id": "temp-789",
      "vendor_name": "Bulk Apothecary",
      "invoice_date": "2026-02-15",
      "invoice_number": "INV-12345",
      "items": [
        {
          "category_id": "temp-123",
          "variant": "8 oz",
          "quantity": "24",
          "unit": "bottles",
          "unit_cost": "1.25"
        }
      ],
      "notes": "Bulk order"
    }
  ]
}
```

## Import into Main App (April 1)

The JSON structure matches the database schema exactly:
- Temporary IDs will be replaced with real UUIDs during import
- Categories imported first
- Products imported second
- Recipes linked to products
- Invoices imported last

## User Experience Notes

### Preventing Confusion
- **Summary panel** on the right shows everything entered
- **Click to edit** any section from the summary
- **Visual connections** - when adding invoices, dropdowns show categories already created
- **Progress indicators** - "You've created 5 categories, 3 products..."

### Draft Saving
- Auto-saves to localStorage every time data changes
- Users can close the browser and come back later
- Works across multiple sessions (same browser, same device)
- "Last saved" timestamp in header

### Mobile Friendly
- Responsive design works on phones/tablets
- Summary panel moves to top on mobile
- Touch-friendly buttons and inputs

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS Modules + Custom Properties
- **State**: React useState + useEffect
- **Storage**: localStorage
- **Export**: JSON download

## Security Notes

- No server-side code (static files only)
- No external API calls
- All data stored locally in browser
- JSON export is client-side only
- No sensitive data transmission

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

**Issue**: Draft not saving
- **Solution**: Check browser allows localStorage, not in private mode

**Issue**: Can't download JSON file
- **Solution**: Check browser allows downloads, popup blocker not blocking

**Issue**: Categories not showing in product dropdown
- **Solution**: Go back to Categories step and add categories first

## Timeline

- **March 5**: Worksheet available to users
- **March 5 - April 1**: Users fill out worksheet at their own pace
- **April 1**: Software presentation, users import JSON file

## Support

For issues or questions, contact the Audacious Money team.

## License

Private - Audacious Money © 2026
