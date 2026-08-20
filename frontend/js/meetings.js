// Client Meetings Management Controller (Vector Icons & Clean Theme)

let allMeetings = [];
let allClients = [];
let activeStatusFilter = 'ALL';
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  loadClientsList();
  loadMeetings();
});

async function loadClientsList() {
  try {
    const res = await apiFetch('/clients');
    if (res && res.clients) {
      allClients = res.clients;
      populateClientSelect(allClients);
    }
  } catch (e) {
    console.warn('Could not load clients list for meetings select:', e);
  }
}

function populateClientSelect(clients = []) {
  const select = document.getElementById('meetingClientSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Select a Client from Master...</option>' + 
    clients.map(c => `<option value="${c.id}" data-name="${escapeAttr(c.company_name)}">${escapeAttr(c.company_name)} (${escapeAttr(c.contact_person || 'Client')})</option>`).join('');
}

async function loadMeetings() {
  const container = document.getElementById('meetingsTableContainer');
  if (!container) return;

  const mode = document.getElementById('filterMeetingMode')?.value || 'ALL';
  const search = document.getElementById('meetingSearchInput')?.value || '';

  const params = new URLSearchParams();
  if (activeStatusFilter !== 'ALL') params.append('status', activeStatusFilter);
  if (mode !== 'ALL') params.append('meeting_mode', mode);
  if (search) params.append('search', search);

  try {
    container.innerHTML = `
      <div style="padding: 2.5rem; text-align:center; color:#64748b;">
        <div class="spinner" style="margin:0 auto 1rem auto; width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:#e11d48; border-radius:50%; animation: spin 0.8s linear infinite;"></div>
        Loading meetings...
      </div>
    `;

    const res = await apiFetch(`/meetings?${params.toString()}`);
    allMeetings = res.meetings || [];

    // Update KPI Metrics
    if (res.metrics) {
      document.getElementById('metricTotalMeetings').textContent = res.metrics.total || 0;
      document.getElementById('metricScheduledMeetings').textContent = res.metrics.scheduled || 0;
      document.getElementById('metricCompletedMeetings').textContent = res.metrics.completed || 0;
      document.getElementById('metricCancelledMeetings').textContent = res.metrics.cancelled || 0;
    }

    renderMeetingsTable(allMeetings);
  } catch (err) {
    container.innerHTML = `
      <div class="text-danger" style="padding:2rem; text-align:center;">
        Error loading meetings: ${escapeAttr(err.message)}
      </div>
    `;
  }
}

function renderMeetingsTable(meetings = []) {
  const container = document.getElementById('meetingsTableContainer');
  if (!container) return;

  if (meetings.length === 0) {
    container.innerHTML = `
      <div style="padding: 3.5rem 1rem; text-align:center; color:#94a3b8;">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.75rem; opacity:0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <div style="font-size:1rem; font-weight:700; color:#475569;">No meetings found matching your criteria.</div>
        <p style="font-size:0.82rem; color:#64748b; margin-top:0.25rem;">Schedule a strategy call or log in-person meeting minutes.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="openNewMeetingModal()" style="margin-top:0.85rem; font-weight:700;">+ Note / Schedule Meeting</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <th style="padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:700; color:#475569;">DATE & TIME</th>
            <th style="padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:700; color:#475569;">MEETING & AGENDA</th>
            <th style="padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:700; color:#475569;">CLIENT / COMPANY</th>
            <th style="padding:0.75rem 1rem; text-align:left; font-size:0.75rem; font-weight:700; color:#475569;">MODE & VENUE</th>
            <th style="padding:0.75rem 1rem; text-align:center; font-size:0.75rem; font-weight:700; color:#475569;">STATUS</th>
            <th style="padding:0.75rem 1rem; text-align:right; font-size:0.75rem; font-weight:700; color:#475569;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          ${meetings.map(m => {
            const isOnline = m.meeting_mode === 'ONLINE';
            let statusBadge = '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem;">SCHEDULED</span>';
            if (m.status === 'DONE') {
              statusBadge = '<span class="badge badge-paid" style="font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem;">✓ COMPLETED</span>';
            } else if (m.status === 'CANCELLED') {
              statusBadge = '<span class="badge badge-cancelled" style="font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem;">CANCELLED</span>';
            } else if (m.status === 'RESCHEDULED') {
              statusBadge = '<span class="badge badge-partial" style="font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem;">RESCHEDULED</span>';
            }

            const clientLink = m.client_id 
              ? `<a href="client-view.html?id=${m.client_id}" style="font-weight:700; color:var(--text-main, #0f172a); font-size:0.9rem; text-decoration:none;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-main)'">${escapeHtml(m.client_company || m.client_name || 'Client')}</a>`
              : `<strong style="font-size:0.9rem; color:#0f172a;">${escapeHtml(m.client_name || 'Prospect')}</strong>`;

            return `
              <tr style="border-bottom:1px solid #f1f5f9; transition: background 0.15s ease;">
                <td style="padding:0.85rem 1rem; vertical-align:middle; white-space:nowrap;">
                  <div style="font-weight:800; color:var(--text-main, #0f172a); font-size:0.9rem;">${formatDate(m.meeting_date)}</div>
                  <span style="font-size:0.76rem; color:#64748b; font-weight:600; display:inline-flex; align-items:center; gap:0.25rem; margin-top:2px;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${escapeHtml(m.meeting_time || '11:00 AM')}
                  </span>
                </td>
                <td style="padding:0.85rem 1rem; vertical-align:middle; max-width:260px;">
                  <div style="font-weight:700; color:var(--text-main, #0f172a); font-size:0.92rem; line-height:1.35;">${escapeHtml(m.title)}</div>
                  ${m.agenda ? `
                    <div style="font-size:0.77rem; color:#64748b; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeAttr(m.agenda)}">
                      ${escapeHtml(m.agenda)}
                    </div>
                  ` : ''}
                  ${m.minutes_notes ? `
                    <div style="margin-top:4px;">
                      <span class="badge" style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; font-size:0.7rem; font-weight:700; padding:0.1rem 0.45rem;">
                        ✓ Minutes Recorded
                      </span>
                    </div>
                  ` : ''}
                </td>
                <td style="padding:0.85rem 1rem; vertical-align:middle;">
                  ${clientLink}
                  ${m.contact_person ? `<div style="font-size:0.77rem; color:#64748b; margin-top:2px;">${escapeHtml(m.contact_person)}</div>` : ''}
                </td>
                <td style="padding:0.85rem 1rem; vertical-align:middle;">
                  <div style="margin-bottom:3px;">
                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:700; font-size:0.72rem;">
                      ${isOnline ? '🌐 Online Meet' : '🏢 Offline'}
                    </span>
                  </div>
                  ${m.location ? `
                    <div style="font-size:0.75rem;">
                      ${isOnline ? `<a href="${escapeAttr(m.location)}" target="_blank" style="color:#0284c7; font-weight:700; text-decoration:underline;">Join Link ↗</a>` : `<span style="color:#64748b;" title="${escapeAttr(m.location)}">${escapeHtml(truncateStr(m.location, 26))}</span>`}
                    </div>
                  ` : ''}
                </td>
                <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:center;">
                  ${statusBadge}
                </td>
                <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:right;">
                  <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end;">
                    <!-- 1. VIEW MEETING & MINUTES DETAILS ICON -->
                    <button type="button" class="icon-action-btn" onclick="openViewMeetingModal(${m.id})" style="color:#0284c7;" title="View Meeting Details, Agenda & Decision Minutes">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>

                    <!-- 2. QUICK UPDATE MINUTES ICON -->
                    <button type="button" class="icon-action-btn" onclick="openPostMinutesModal(${m.id}, '${escapeAttr(m.title)}', '${formatDate(m.meeting_date)} ${escapeAttr(m.meeting_time)}')" style="color:#16a34a;" title="Update Post-Meeting Decision Minutes">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </button>

                    <!-- 3. MARK AS COMPLETED (DONE) -->
                    ${m.status !== 'DONE' ? `
                      <button type="button" class="icon-action-btn" onclick="handleMarkMeetingDone(${m.id})" style="color:#15803d;" title="Mark Meeting as Completed (Done)">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    ` : ''}

                    <!-- 4. EDIT / RESCHEDULE MEETING -->
                    <button type="button" class="icon-action-btn" onclick="editMeeting(${m.id})" style="color:#475569;" title="Edit / Reschedule Meeting">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>

                    <!-- 5. DELETE MEETING -->
                    <button type="button" class="icon-action-btn" onclick="deleteMeeting(${m.id})" style="color:#dc2626;" title="Delete Meeting Record">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- VIEW MEETING DETAILS MODAL ---
function openViewMeetingModal(id) {
  const m = allMeetings.find(item => item.id === id);
  if (!m) return;

  const isOnline = m.meeting_mode === 'ONLINE';
  
  // Status Badge
  let statusBadgeHtml = '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:800; font-size:0.75rem; padding:0.25rem 0.6rem;">SCHEDULED</span>';
  if (m.status === 'DONE') {
    statusBadgeHtml = '<span class="badge badge-paid" style="font-weight:800; font-size:0.75rem; padding:0.25rem 0.6rem;">✓ COMPLETED</span>';
  } else if (m.status === 'CANCELLED') {
    statusBadgeHtml = '<span class="badge badge-cancelled" style="font-weight:800; font-size:0.75rem; padding:0.25rem 0.6rem;">CANCELLED</span>';
  } else if (m.status === 'RESCHEDULED') {
    statusBadgeHtml = '<span class="badge badge-partial" style="font-weight:800; font-size:0.75rem; padding:0.25rem 0.6rem;">RESCHEDULED</span>';
  }
  document.getElementById('viewModalStatusBadge').innerHTML = statusBadgeHtml;

  document.getElementById('viewModalModeBadge').innerHTML = isOnline 
    ? '<span class="badge" style="background:#f1f5f9; color:#0369a1; border:1px solid #cbd5e1; font-weight:700; font-size:0.72rem; padding:0.25rem 0.55rem;">🌐 Online Meeting</span>'
    : '<span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:700; font-size:0.72rem; padding:0.25rem 0.55rem;">🏢 Offline / In-Person</span>';

  document.getElementById('viewModalTitle').textContent = m.title || 'Client Meeting';
  document.getElementById('viewModalClient').textContent = m.client_company || m.client_name || 'Client';
  document.getElementById('viewModalContactPerson').textContent = m.contact_person ? `Contact: ${m.contact_person}` : '';
  
  document.getElementById('viewModalDateTime').textContent = `${formatDate(m.meeting_date)} at ${m.meeting_time || ''}`;
  document.getElementById('viewModalTimeRel').textContent = `Current Status: ${m.status}`;

  // Location / Link
  if (m.location) {
    document.getElementById('viewModalLocation').innerHTML = isOnline
      ? `<a href="${escapeAttr(m.location)}" target="_blank" style="color:#0284c7; font-weight:700; text-decoration:underline;">Join Online Meeting (${escapeHtml(m.location)}) ↗</a>`
      : `<span>📍 ${escapeHtml(m.location)}</span>`;
  } else {
    document.getElementById('viewModalLocation').innerHTML = `<span style="color:#94a3b8; font-style:italic;">No specific venue/link specified</span>`;
  }

  // Agenda
  document.getElementById('viewModalAgenda').textContent = m.agenda || 'No agenda discussion scope was documented.';

  // Minutes
  const minDiv = document.getElementById('viewModalMinutes');
  if (m.minutes_notes) {
    minDiv.textContent = m.minutes_notes;
    minDiv.style.fontStyle = 'normal';
    minDiv.style.color = '#14532d';
  } else {
    minDiv.textContent = 'No post-meeting minutes or decision notes recorded yet. Click "Edit Minutes" above to document agreed action items.';
    minDiv.style.fontStyle = 'italic';
    minDiv.style.color = '#64748b';
  }

  // Bind Buttons inside view modal
  const btnEditMin = document.getElementById('btnEditMinutesFromView');
  if (btnEditMin) {
    btnEditMin.onclick = () => {
      closeViewMeetingModal();
      openPostMinutesModal(m.id, m.title, `${formatDate(m.meeting_date)} ${m.meeting_time || ''}`);
    };
  }

  const btnEditMeeting = document.getElementById('btnEditMeetingFromView');
  if (btnEditMeeting) {
    btnEditMeeting.onclick = () => {
      closeViewMeetingModal();
      editMeeting(m.id);
    };
  }

  const btnMarkDone = document.getElementById('btnMarkDoneFromView');
  if (btnMarkDone) {
    if (m.status === 'DONE') {
      btnMarkDone.style.display = 'none';
    } else {
      btnMarkDone.style.display = 'inline-block';
      btnMarkDone.onclick = async () => {
        await handleMarkMeetingDone(m.id);
        closeViewMeetingModal();
      };
    }
  }

  document.getElementById('viewMeetingModal').classList.add('active');
}

function closeViewMeetingModal() {
  document.getElementById('viewMeetingModal').classList.remove('active');
}

function setMeetingStatusFilter(status) {
  activeStatusFilter = status;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  loadMeetings();
}

function applyMeetingFilters() {
  loadMeetings();
}

function debounceMeetingSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadMeetings();
  }, 300);
}

// --- MODAL ACTIONS ---

function openNewMeetingModal() {
  const form = document.getElementById('meetingForm');
  if (form) form.reset();

  document.getElementById('meetingId').value = '';
  document.getElementById('meetingModalTitle').textContent = 'Note / Schedule Meeting';
  document.getElementById('meetingDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('meetingTime').value = '11:30 AM';
  document.getElementById('meetingLocation').value = 'https://meet.google.com/dgr-app';

  document.getElementById('meetingModal').classList.add('active');
}

function closeMeetingModal() {
  document.getElementById('meetingModal').classList.remove('active');
}

function handleMeetingModeChange(mode) {
  const label = document.getElementById('meetingLocationLabel');
  const input = document.getElementById('meetingLocation');
  if (mode === 'ONLINE') {
    label.textContent = 'Google Meet / Zoom Link';
    input.placeholder = 'https://meet.google.com/xyz-abc';
  } else {
    label.textContent = 'Location Venue / Physical Address';
    input.placeholder = 'D-GROW Office / Client HQ, Chennai';
  }
}

function editMeeting(id) {
  const m = allMeetings.find(item => item.id === id);
  if (!m) return;

  document.getElementById('meetingId').value = m.id;
  document.getElementById('meetingModalTitle').textContent = 'Edit / Reschedule Meeting';
  document.getElementById('meetingClientSelect').value = m.client_id || '';
  document.getElementById('meetingTitle').value = m.title;
  document.getElementById('meetingMode').value = m.meeting_mode || 'ONLINE';
  document.getElementById('meetingStatus').value = m.status || 'SCHEDULED';
  document.getElementById('meetingDate').value = m.meeting_date ? m.meeting_date.split('T')[0] : '';
  document.getElementById('meetingTime').value = m.meeting_time || '';
  document.getElementById('meetingLocation').value = m.location || '';
  document.getElementById('meetingAgenda').value = m.agenda || '';
  document.getElementById('meetingMinutesNotes').value = m.minutes_notes || '';

  handleMeetingModeChange(m.meeting_mode || 'ONLINE');
  document.getElementById('meetingModal').classList.add('active');
}

async function submitMeetingForm(e) {
  e.preventDefault();

  const id = document.getElementById('meetingId').value;
  const select = document.getElementById('meetingClientSelect');
  const client_id = select.value || null;
  const client_name = select.options[select.selectedIndex]?.dataset.name || '';
  const title = document.getElementById('meetingTitle').value.trim();
  const meeting_mode = document.getElementById('meetingMode').value;
  const status = document.getElementById('meetingStatus').value;
  const meeting_date = document.getElementById('meetingDate').value;
  const meeting_time = document.getElementById('meetingTime').value.trim();
  const location = document.getElementById('meetingLocation').value.trim();
  const agenda = document.getElementById('meetingAgenda').value.trim();
  const minutes_notes = document.getElementById('meetingMinutesNotes').value.trim();

  const btn = document.getElementById('btnSubmitMeeting');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      await apiFetch(`/meetings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          client_id, client_name, title, meeting_mode, status, meeting_date, meeting_time, location, agenda, minutes_notes
        })
      });
      showToast('✓ Meeting updated successfully!', 'success');
    } else {
      await apiFetch('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          client_id, client_name, title, meeting_mode, status, meeting_date, meeting_time, location, agenda, minutes_notes
        })
      });
      showToast('✓ Meeting scheduled successfully!', 'success');
    }

    closeMeetingModal();
    loadMeetings();
  } catch (err) {
    showToast('Failed to save meeting: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Meeting';
  }
}

// Post-Meeting Minutes Modal
function openPostMinutesModal(id, title, meta) {
  document.getElementById('postMinutesMeetingId').value = id;
  document.getElementById('postMinutesMeetingTitle').textContent = title;
  document.getElementById('postMinutesMeetingMeta').textContent = meta;
  document.getElementById('postMinutesText').value = '';

  const meeting = allMeetings.find(m => m.id === id);
  if (meeting && meeting.minutes_notes) {
    document.getElementById('postMinutesText').value = meeting.minutes_notes;
  }

  document.getElementById('postMinutesModal').classList.add('active');
}

function closePostMinutesModal() {
  document.getElementById('postMinutesModal').classList.remove('active');
}

async function submitPostMinutes(e) {
  e.preventDefault();
  const id = document.getElementById('postMinutesMeetingId').value;
  const minutes_notes = document.getElementById('postMinutesText').value.trim();
  const mark_done = document.getElementById('postMinutesMarkDone').checked;

  const btn = document.getElementById('btnSubmitMinutes');
  btn.disabled = true;
  btn.textContent = 'Saving Minutes...';

  try {
    await apiFetch(`/meetings/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ minutes_notes, mark_done })
    });

    showToast('✓ Meeting minutes & decision notes recorded!', 'success');
    closePostMinutesModal();
    loadMeetings();
  } catch (err) {
    showToast('Failed to update minutes: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Meeting Minutes';
  }
}

async function handleMarkMeetingDone(id) {
  try {
    await apiFetch(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'DONE' })
    });
    showToast('✓ Meeting marked as Completed (Done)!', 'success');
    loadMeetings();
  } catch (err) {
    showToast('Failed to update meeting status: ' + err.message, 'error');
  }
}

async function deleteMeeting(id) {
  if (!confirm('Are you sure you want to delete this meeting record?')) return;

  try {
    await apiFetch(`/meetings/${id}`, { method: 'DELETE' });
    showToast('✓ Meeting deleted successfully', 'success');
    loadMeetings();
  } catch (err) {
    showToast('Failed to delete meeting: ' + err.message, 'error');
  }
}

function truncateStr(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}
