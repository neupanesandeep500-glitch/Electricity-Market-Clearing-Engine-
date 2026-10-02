/**
 * Nepal Electricity Market Clearing Engine - Gmail relay (Google Apps Script)
 *
 * Use this when the server is on Render's FREE plan, which blocks SMTP ports (465/587).
 * It sends from your own Gmail over HTTPS, so no App Password is needed for this route.
 *
 * SETUP (about 3 minutes)
 *  1. Sign in to the Gmail account that should send the mail, open https://script.google.com
 *     and click "New project". Paste this whole file into Code.gs.
 *  2. Change SHARED_SECRET below to a long random string (e.g. 32+ characters).
 *  3. Deploy -> New deployment -> type "Web app".
 *       Execute as: Me          Who has access: Anyone
 *  4. Authorize when prompted, then copy the Web app URL (ends in /exec).
 *  5. In Render -> Environment add:
 *       GOOGLE_APPS_SCRIPT_URL = <the /exec URL>
 *       GAS_SHARED_SECRET      = <the same secret as SHARED_SECRET below>
 *
 * After editing this script later, use Deploy -> Manage deployments -> Edit -> New version.
 *
 * Limits: consumer Gmail ~100 recipients/day via Apps Script, Google Workspace ~1,500/day.
 */
var SHARED_SECRET = 'CHANGE-ME-TO-A-LONG-RANDOM-STRING';
var FROM_NAME = 'Nepal Electricity Market Clearing Engine';

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sendOne_(job) {
  if (!job.to || String(job.to).indexOf('@') === -1) throw new Error('Invalid recipient');
  MailApp.sendEmail({
    to: String(job.to).trim(),
    subject: String(job.subject || '').replace(/[\r\n]+/g, ' '),
    htmlBody: job.html || '',
    body: job.text || '',
    name: FROM_NAME
  });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (SHARED_SECRET && data.secret !== SHARED_SECRET) {
      return json_({ success: false, error: 'Unauthorized: GAS_SHARED_SECRET does not match SHARED_SECRET in the script.' });
    }

    if (data.action === 'ping') {
      var account = '';
      try { account = Session.getEffectiveUser().getEmail(); } catch (ignore) {}
      return json_({ success: true, message: 'Relay OK', account: account, remainingQuota: MailApp.getRemainingDailyQuota() });
    }

    if (data.action === 'send_batch' && Array.isArray(data.jobs)) {
      // One result per job, so a single bad address never aborts (or silently duplicates) the rest.
      var results = [];
      for (var i = 0; i < data.jobs.length; i++) {
        try { sendOne_(data.jobs[i]); results.push({ ok: true }); }
        catch (err) { results.push({ ok: false, error: String(err) }); }
      }
      return json_({ success: true, results: results });
    }

    if (data.to) {
      sendOne_(data);
      return json_({ success: true, messageId: 'gas-' + new Date().getTime() });
    }

    return json_({ success: false, error: 'Unknown request' });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  }
}
