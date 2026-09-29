/**
 * Built-in Realistic Demo Data for Nepal Electricity Market Simulation
 * Formatted identically to Google Form responses.
 */

export function generateDemoCSV(nSlots = 4): string {
  const sellers = [
    { name: 'Upper Tamakoshi HPP', email: 'tamakoshi.dispatch@nea.org.np' },
    { name: 'Chilime HPP', email: 'chilime.energy@gmail.com' },
    { name: 'Marsyangdi HPP', email: 'marsyangdi.ops@nea.org.np' },
    { name: 'Kulekhani HPP', email: 'kulekhani.peaking@gmail.com' },
    { name: 'Middle Marsyangdi HPP', email: 'mm.hydropower@nea.org.np' },
  ];

  const buyers = [
    { name: 'NEA Distribution Kathmandu', email: 'kathmandu.dcs@nea.org.np' },
    { name: 'NEA Distribution Pokhara', email: 'pokhara.dcs@nea.org.np' },
    { name: 'Industrial Zone Hetauda', email: 'hetauda.power@industry.np' },
    { name: 'Butwal Industrial Corp', email: 'butwal.energy@bic.np' },
    { name: 'NEA Birgunj DCS', email: 'birgunj.dcs@nea.org.np' },
  ];

  // Build Google Form style split headers:
  // Timestamp, I am a, Name, Email,
  // For T1: Select Rate (NRs/kWh), For T1: Select Power (MW), ... (Sellers)
  // For T1: Select Rate (NRs/kWh), For T1: Select Power (MW), ... (Buyers)
  const headers = ['Timestamp', 'I am a', 'Enter your ID', 'Email Address'];
  for (let s = 1; s <= nSlots; s++) {
    headers.push(`For T${s}: Select Rate (NRs/kWh)`);
    headers.push(`For T${s}: Select Power (MW)`);
  }
  for (let s = 1; s <= nSlots; s++) {
    headers.push(`For T${s}: Select Rate (NRs/kWh)`);
    headers.push(`For T${s}: Select Power (MW)`);
  }

  const rows: string[] = [headers.join(',')];

  // Base generator seed curves
  // Sellers offer at lower prices (4.5 - 7.5 NRs/kWh)
  const sellerBaseProfiles = [
    { basePrice: 4.8, baseQty: 180 },
    { basePrice: 5.2, baseQty: 90 },
    { basePrice: 5.7, baseQty: 140 },
    { basePrice: 6.8, baseQty: 85 },
    { basePrice: 6.2, baseQty: 110 },
  ];

  // Buyers bid at higher prices (7.0 - 11.5 NRs/kWh)
  const buyerBaseProfiles = [
    { basePrice: 10.5, baseQty: 170 },
    { basePrice: 9.8, baseQty: 110 },
    { basePrice: 8.6, baseQty: 95 },
    { basePrice: 8.2, baseQty: 130 },
    { basePrice: 7.6, baseQty: 100 },
  ];

  const now = new Date();

  // Add seller rows (seller slots are in the first slot block, buyer slots blank)
  sellers.forEach((s, idx) => {
    const profile = sellerBaseProfiles[idx];
    const ts = new Date(now.getTime() - (sellers.length - idx) * 120000).toISOString();
    const row = [
      `"${ts}"`,
      `"Seller"`,
      `"${s.name}"`,
      `"${s.email}"`,
    ];

    // Seller columns
    for (let slot = 1; slot <= nSlots; slot++) {
      const priceVariation = (Math.sin(slot + idx) * 0.4);
      const qtyVariation = (Math.cos(slot * 2 + idx) * 15);
      const price = Math.max(4.2, profile.basePrice + priceVariation).toFixed(2);
      const qty = Math.max(20, profile.baseQty + qtyVariation).toFixed(1);
      row.push(price);
      row.push(qty);
    }

    // Buyer columns empty
    for (let slot = 1; slot <= nSlots; slot++) {
      row.push('""');
      row.push('""');
    }

    rows.push(row.join(','));
  });

  // Add buyer rows (seller slots empty, buyer slots in second block)
  buyers.forEach((b, idx) => {
    const profile = buyerBaseProfiles[idx];
    const ts = new Date(now.getTime() - (buyers.length - idx) * 90000).toISOString();
    const row = [
      `"${ts}"`,
      `"Buyer"`,
      `"${b.name}"`,
      `"${b.email}"`,
    ];

    // Seller columns empty
    for (let slot = 1; slot <= nSlots; slot++) {
      row.push('""');
      row.push('""');
    }

    // Buyer columns
    for (let slot = 1; slot <= nSlots; slot++) {
      const priceVariation = (Math.cos(slot + idx) * 0.5);
      const qtyVariation = (Math.sin(slot * 3 + idx) * 20);
      const price = Math.max(6.0, profile.basePrice + priceVariation).toFixed(2);
      const qty = Math.max(30, profile.baseQty + qtyVariation).toFixed(1);
      row.push(price);
      row.push(qty);
    }

    rows.push(row.join(','));
  });

  return rows.join('\n');
}
