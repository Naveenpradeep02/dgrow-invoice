// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('EMI & Loan Management Flow Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API routes to prevent 401 session expiration
    await page.route('**/api/**', async route => {
      const url = route.request().url();
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, user: { id: 1, name: 'Admin User', role: 'ADMIN', status: 'ACTIVE' } })
        });
      } else if (url.includes('/clients')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, clients: [] })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    // Seed admin auth before page navigation to satisfy checkAuthGuard
    await page.addInitScript(() => {
      localStorage.setItem('dgrow_token', 'test_admin_token_pw');
      localStorage.setItem('dgrow_user', JSON.stringify({
        id: 1,
        name: 'Admin User',
        email: 'admin@dgrow.com',
        role: 'ADMIN',
        status: 'ACTIVE'
      }));
    });

    await page.goto('/admin/miscellaneous.html');
    await page.evaluate(() => {
      localStorage.removeItem('dgrow_misc_records_v8');
      localStorage.removeItem('dgrow_emi_presets_v2');
      localStorage.removeItem('dgrow_deleted_emi_keys_v1');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('Complete EMI lifecycle: Create, Cascade Update, Final Month Pay & Close, No Next-Month Leak, Delete', async ({ page }) => {
    // 1. Switch to EMI & Loans subview
    const emiTab = page.locator('#viewToggleEmiLoans');
    await emiTab.click();
    await page.waitForTimeout(500);

    // Verify initial active loans are loaded and pending dues rendered
    const rows = page.locator('#miscTableBody tr');
    expect(await rows.count()).toBeGreaterThan(0);

    // Initial KPI numbers
    const initialPaidText = await page.locator('#statAdFundsMisc').innerText();
    console.log('Initial Paid EMI Total:', initialPaidText);

    // 2. Open "Manage Loan Accounts" Modal and Register a new 2-Month Loan Account
    const manageLoansBtn = page.locator('button:has-text("Manage Loan Accounts")');
    await manageLoansBtn.click();
    const modal = page.locator('#manageLoansModal');
    await expect(modal).toBeVisible();

    // Fill form: Test loan ending in current month (2026-09)
    await page.fill('#loanProviderInput', 'Axis Bank');
    await page.fill('#loanTitleInput', 'Server Infrastructure Loan');
    await page.fill('#loanAmountInput', '8500');
    await page.selectOption('#loanDueDaySelect', '5');
    await page.fill('#loanStartDateInput', '2026-08-01');
    await page.fill('#loanEndDateInput', '2026-09-30');
    await page.selectOption('#loanModeSelect', 'Bank Transfer / Auto-Debit');
    await page.selectOption('#loanStatusSelect', 'ACTIVE');

    // Save Loan Account
    await page.click('#loanSaveBtn');
    await page.waitForTimeout(600);

    // Verify new loan appears in loan accounts table
    const loanListText = await page.locator('#loanAccountsTableBody').innerText();
    expect(loanListText).toContain('Axis Bank');
    expect(loanListText).toContain('Server Infrastructure Loan');
    expect(loanListText).toContain('₹8,500');

    // Close modal
    await page.click('#manageLoansModal .modal-close');
    await page.waitForTimeout(500);

    // 3. Verify the pending installment is visible in current month (September 2026)
    const axisRow = page.locator('#miscTableBody tr:has-text("Server Infrastructure Loan")');
    await expect(axisRow).toBeVisible();
    expect(await axisRow.innerText()).toContain('₹8,500');
    expect(await axisRow.innerText()).toContain('PENDING');
    expect(await axisRow.innerText()).toContain('FINAL MONTH');

    // 4. Test UPDATE: Edit the master loan amount from 8500 to 9200 and verify cascade update
    await manageLoansBtn.click();
    await page.waitForTimeout(400);
    // Find edit button for Axis Bank loan
    const editBtn = page.locator('#loanAccountsTableBody tr:has-text("Axis Bank") button[title="Edit Loan Account"]');
    await editBtn.click();
    await page.waitForTimeout(400);

    // Verify form populated and update amount
    expect(await page.inputValue('#loanTitleInput')).toBe('Server Infrastructure Loan');
    await page.fill('#loanAmountInput', '9200');
    await page.click('#loanSaveBtn');
    await page.waitForTimeout(600);

    // Close modal and verify cascade update reflected in monthly pending table
    await page.click('#manageLoansModal .modal-close');
    await page.waitForTimeout(500);

    const updatedAxisRow = page.locator('#miscTableBody tr:has-text("Server Infrastructure Loan")');
    await expect(updatedAxisRow).toBeVisible();
    expect(await updatedAxisRow.innerText()).toContain('₹9,200');
    console.log('Cascade Update Verified: Amount updated to ₹9,200');

    // 5. Pay Final Installment: Click "Pay" button
    const payBtn = updatedAxisRow.locator('button:has-text("Pay")');
    await payBtn.click();

    const payModal = page.locator('#payEmiModal');
    await expect(payModal).toBeVisible();

    // Verify Notice indicates final installment
    const notice = page.locator('#payEmiFinalNotice');
    await expect(notice).toBeVisible();
    expect(await notice.innerText()).toContain('Final Installment');

    // Submit payment
    await page.click('#savePayEmiBtn');
    await page.waitForTimeout(800);

    // 6. Verify Payment is Recorded in Current Month (Amount counted, Status = PAID (CLOSED))
    const paidAxisRow = page.locator('#miscTableBody tr:has-text("Server Infrastructure Loan")');
    await expect(paidAxisRow).toBeVisible();
    const paidRowText = await paidAxisRow.innerText();
    expect(paidRowText).toContain('PAID');
    expect(paidRowText).toContain('₹9,200');

    // Verify Completed Payments (Paid) KPI reflects the payment
    const updatedPaidKpi = await page.locator('#statAdFundsMisc').innerText();
    console.log('Updated Paid KPI after paying final month:', updatedPaidKpi);
    expect(updatedPaidKpi).not.toBe('₹0');

    // Verify Master Loan Preset is now marked CLOSED
    await manageLoansBtn.click();
    await page.waitForTimeout(400);
    const axisMasterRow = page.locator('#loanAccountsTableBody tr:has-text("Axis Bank")');
    expect(await axisMasterRow.innerText()).toContain('CLOSED');
    await page.click('#manageLoansModal .modal-close');
    await page.waitForTimeout(400);

    // 7. CRITICAL TEST: Switch to Next Month (October 2026) -> Closed Loan MUST NOT show!
    const billingMonthSelect = page.locator('#miscBillingMonth');
    // Set to October 2026 or trigger change
    await page.evaluate(() => {
      const select = document.getElementById('miscBillingMonth');
      // If October option doesn't exist, add it
      if (![...select.options].some(o => o.value === '2026-10')) {
        const opt = document.createElement('option');
        opt.value = '2026-10';
        opt.textContent = 'October 2026';
        select.insertBefore(opt, select.lastElementChild);
      }
      select.value = '2026-10';
      onBillingMonthChange('2026-10');
    });
    await page.waitForTimeout(600);

    // Check that Server Infrastructure Loan does NOT appear in October 2026
    const octAxisRow = page.locator('#miscTableBody tr:has-text("Server Infrastructure Loan")');
    expect(await octAxisRow.count()).toBe(0);
    console.log('Next Month Check Verified: Closed loan does NOT appear in October 2026!');

    // 8. Switch back to current month (September 2026)
    await page.evaluate(() => {
      document.getElementById('miscBillingMonth').value = '2026-09';
      onBillingMonthChange('2026-09');
    });
    await page.waitForTimeout(600);

    // 9. Test DELETE EMI Entry: Delete another pending loan entry (e.g. IDFC Bank)
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    const idfcRow = page.locator('#miscTableBody tr:has-text("IDFC Bank")');
    if (await idfcRow.count() > 0) {
      const deleteEmiBtn = idfcRow.locator('button[title="Delete Entry"]');
      await deleteEmiBtn.click();
      await page.waitForTimeout(600);

      // Verify IDFC Bank is deleted
      const idfcAfterDelete = page.locator('#miscTableBody tr:has-text("IDFC Bank")');
      expect(await idfcAfterDelete.count()).toBe(0);

      // Reload page to ensure it doesn't resurrect from auto-sync
      await page.reload();
      await emiTab.click();
      await page.waitForTimeout(600);
      const idfcAfterReload = page.locator('#miscTableBody tr:has-text("IDFC Bank")');
      expect(await idfcAfterReload.count()).toBe(0);
      console.log('Delete Entry Verified: Entry stayed deleted after reload!');
    }

    // 10. Test DELETE Master Loan Account
    await manageLoansBtn.click();
    await page.waitForTimeout(400);

    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    const axisDeleteMasterBtn = page.locator('#loanAccountsTableBody tr:has-text("Axis Bank") button[title="Delete Master Preset"]');
    await axisDeleteMasterBtn.click();
    await page.waitForTimeout(600);

    // Verify removed from master accounts
    const loanAccountsAfter = await page.locator('#loanAccountsTableBody').innerText();
    expect(loanAccountsAfter).not.toContain('Axis Bank');
    console.log('Master Loan Delete Verified!');
  });
});
