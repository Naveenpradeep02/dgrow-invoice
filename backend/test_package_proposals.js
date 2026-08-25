const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=================================================');
  console.log('   3-TIER PACKAGE PROPOSALS & PUBLIC LINK TEST   ');
  console.log('=================================================');

  try {
    // 1. Admin Login
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'info@dgrowmarketing.com',
      password: 'admin' // or Srija@345
    });

    let adminToken = loginRes.data?.token;
    if (!adminToken) {
      const retryLogin = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        email: 'info@dgrowmarketing.com',
        password: 'Srija@345'
      });
      adminToken = retryLogin.data?.token;
    }

    if (!adminToken) {
      throw new Error('Admin login failed');
    }
    console.log('✓ PASS: Admin logged in successfully');

    // 2. Create 3-Tier Package Proposal
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/proposals',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      client_name: 'Baby Steps Fertility Center',
      contact_person: 'Dr. Manjula Gynaecologist',
      mobile: '+91 9840627333',
      email: 'manjula2000srmc@gmail.com',
      title: 'Digital Marketing Growth Strategy Plan',
      billing_cycle: 'Monthly',
      packages: [
        {
          name: 'Starter Boost',
          subtitle: 'Foundation Growth Plan',
          price: 29999,
          badge_type: 'STARTER',
          badge_text: 'STARTER',
          is_recommended: false,
          services: [
            {
              title: '1. Social Media Management & Marketing',
              sub_items: ['Manage 4 platforms (Facebook, Instagram, Pinterest, YouTube)', 'Create and schedule 5 posts + 7 Videos per month']
            }
          ]
        },
        {
          name: 'Pro Accelerator',
          subtitle: '+ Starter Boost',
          price: 37999,
          badge_type: 'MOST_POPULAR',
          badge_text: 'MOST POPULAR',
          is_recommended: false,
          services: [
            {
              title: '1. Keyword Rankings & GMB Listing',
              sub_items: ['8 - 12 Main Keywords for your business', 'Setup and optimization of GMB listing']
            }
          ]
        },
        {
          name: 'Growth Plan',
          subtitle: 'Starter Boost + Pro Accelerator (All In One)',
          price: 44999,
          badge_type: 'RECOMMENDED',
          badge_text: 'RECOMMENDED',
          is_recommended: true,
          services: [
            {
              title: '1. Complete Omnichannel Growth Suite',
              sub_items: ['Unlimited Keywords', 'Local SEO & 26 GMB Posts/month', 'Google Tags & Conversion Tracking']
            }
          ]
        }
      ]
    });

    if (createRes.status !== 201 || !createRes.data.success) {
      throw new Error(`Create proposal failed: ${JSON.stringify(createRes.data)}`);
    }

    const proposalId = createRes.data.proposalId;
    const shareToken = createRes.data.shareToken;
    const proposalCode = createRes.data.proposalCode;
    console.log(`✓ PASS: Created 3-Tier Proposal #${proposalCode} (ID: ${proposalId}) with Share Token: ${shareToken}`);

    // 3. Public Client Access (NO AUTH TOKEN)
    const publicRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/proposals/public/${shareToken}`,
      method: 'GET'
    });

    if (publicRes.status !== 200 || !publicRes.data.success) {
      throw new Error(`Public proposal fetch failed: ${JSON.stringify(publicRes.data)}`);
    }

    const fetchedPackages = publicRes.data.proposal.packages;
    if (fetchedPackages.length !== 3) {
      throw new Error(`Expected 3 packages, got ${fetchedPackages.length}`);
    }
    console.log(`✓ PASS: Public Client View loaded 3 package tiers without auth headers`);
    console.log(`  - Tier 1: ${fetchedPackages[0].name} (Rs.${fetchedPackages[0].price})`);
    console.log(`  - Tier 2: ${fetchedPackages[1].name} (Rs.${fetchedPackages[1].price})`);
    console.log(`  - Tier 3: ${fetchedPackages[2].name} (Rs.${fetchedPackages[2].price} - RECOMMENDED)`);

    // 4. Client Confirms Chosen Package (e.g. Growth Plan - Tier Index 2)
    const confirmRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/proposals/public/${shareToken}/confirm`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      package_index: 2,
      package_name: 'Growth Plan',
      notes: 'Please start from next Monday.'
    });

    if (confirmRes.status !== 200 || !confirmRes.data.success) {
      throw new Error(`Client confirm failed: ${JSON.stringify(confirmRes.data)}`);
    }
    console.log(`✓ PASS: Client confirmed "${confirmRes.data.proposal.selected_package_name}" online`);

    // 5. Verify Admin list shows proposal in ACCEPTED status
    const listRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/proposals',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const propInList = (listRes.data.proposals || []).find(p => p.id === proposalId);
    if (!propInList || propInList.status !== 'ACCEPTED') {
      throw new Error(`Expected proposal status ACCEPTED, found: ${propInList?.status}`);
    }
    console.log(`✓ PASS: Proposal status confirmed as ACCEPTED (${propInList.selected_package_name}) in CRM`);

    // 6. Convert Confirmed Proposal to Official Quotation
    const convertRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/proposals/${proposalId}/convert-quotation`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (convertRes.status !== 200 || !convertRes.data.success) {
      throw new Error(`Convert to quotation failed: ${JSON.stringify(convertRes.data)}`);
    }
    console.log(`✓ PASS: Converted Proposal to Official Quotation #${convertRes.data.quoteNumber} (Quotation ID: ${convertRes.data.quotationId})`);

    console.log('=================================================');
    console.log(' ALL 3-TIER PACKAGE PROPOSAL TESTS PASSED! 🚀    ');
    console.log('=================================================');
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
  }
}

runTests();
