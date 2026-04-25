/**
 * Kiểm tra fields trả về từ API list auction-notice
 * Dùng fetch trực tiếp (không qua Puppeteer)
 */

async function main() {
  const baseUrl = 'https://dgts.moj.gov.vn';
  
  console.log('=== TEST 1: API list /portal/search/auction-notice ===');
  try {
    const res = await fetch(`${baseUrl}/portal/search/auction-notice?p=1&numberPerPage=2`, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!res.ok) {
      console.log(`HTTP Error: ${res.status}`);
      const text = await res.text();
      console.log('Body:', text.substring(0, 500));
      return;
    }
    
    const listRes = await res.json();
    
    if (listRes && listRes.items && listRes.items.length > 0) {
      console.log(`Total items: ${listRes.rowCount}, pages: ${listRes.pageCount}`);
      
      for (let idx = 0; idx < listRes.items.length; idx++) {
        console.log(`\n--- Item #${idx + 1} - ALL FIELDS ---`);
        const item = listRes.items[idx];
        for (const [key, value] of Object.entries(item)) {
          const display = typeof value === 'string' ? value.substring(0, 150) : value;
          console.log(`  ${key}: ${JSON.stringify(display)}`);
        }
        
        console.log('\n--- Candidate "name" fields ---');
        const nameFields = ['propertyName', 'subPropertyName', 'titleName', 'name', 'assetName', 'nameAsset'];
        for (const f of nameFields) {
          console.log(`  ${f}: ${item[f] !== undefined ? JSON.stringify(item[f]).substring(0, 200) : '<<UNDEFINED>>'}`);
        }
      }

      // Test detail API
      const sourceId = listRes.items[0].id;
      console.log(`\n=== TEST 2: API propertyInfo for sourceId ${sourceId} ===`);
      try {
        const propRes = await fetch(`${baseUrl}/portal/propertyInfo?auctionInfoId=${sourceId}`, {
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0',
          }
        });
        if (propRes.ok) {
          const propData = await propRes.json();
          if (propData && propData.items && propData.items.length > 0) {
            console.log('\n--- PropertyInfo Item #1 - ALL FIELDS ---');
            for (const [key, value] of Object.entries(propData.items[0])) {
              const display = typeof value === 'string' ? value.substring(0, 150) : value;
              console.log(`  ${key}: ${JSON.stringify(display)}`);
            }
          }
        } else {
          console.log(`propertyInfo HTTP ${propRes.status}`);
        }
      } catch (e) {
        console.log('propertyInfo error:', e.message);
      }

      console.log('\n=== TEST 3: API viewDetailAuctionInfo ===');
      try {
        const viewRes = await fetch(`${baseUrl}/portal/viewDetailAuctionInfo?auctionInfoId=${sourceId}`, {
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0',
          }
        });
        if (viewRes.ok) {
          const viewData = await viewRes.json();
          if (viewData) {
            console.log('\n--- viewDetailAuctionInfo - ALL FIELDS ---');
            for (const [key, value] of Object.entries(viewData)) {
              if (typeof value === 'object' && value !== null) {
                console.log(`  ${key}: [object - ${Array.isArray(value) ? value.length + ' items' : 'object'}]`);
              } else {
                const display = typeof value === 'string' ? value.substring(0, 150) : value;
                console.log(`  ${key}: ${JSON.stringify(display)}`);
              }
            }
          }
        } else {
          console.log(`viewDetail HTTP ${viewRes.status}`);
        }
      } catch (e) {
        console.log('viewDetail error:', e.message);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
