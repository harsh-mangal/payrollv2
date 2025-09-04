// controllers/client.controller.js
import Client from '../models/Client.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { generateLedgerPDF } from '../utils/pdf.js';
import path from 'path';

/* ------------------------------- helpers ------------------------------- */

// Mask password for any credential object (defense-in-depth; password is select:false anyway)
function maskCredential(c) {
  if (!c) return c;
  const obj = typeof c.toObject === 'function' ? c.toObject() : { ...c };
  if (obj.password) obj.password = '••••••••';
  return obj;
}

function maskCredentialsList(creds = []) {
  return (creds || []).map(maskCredential);
}

// Build safe client projection (never return password)
const CLIENT_SAFE_PROJECTION = {
  // explicitly exclude credential password if it were selected by someone by mistake
  'credentials.password': 0,
};

/* ------------------------------ Clients CRUD ------------------------------ */

export const createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);

    // Opening balance entry (if any)
    if (client.openingBalance && client.openingBalance !== 0) {
      await LedgerEntry.create({
        clientId: client._id,
        date: new Date(),
        type: client.openingBalance > 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(client.openingBalance),
        balanceAfter: client.openingBalance,
        refType: 'OPENING',
      });
    }

    // Re-fetch with safe projection so we don’t leak anything (and to apply schema toJSON transform)
    const fresh = await Client.findById(client._id, CLIENT_SAFE_PROJECTION);
    res.json({ ok: true, client: fresh });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// Add q (name/email/phone/gstin/panelName/projectName) + pagination ?page=&limit=
export const listClients = async (req, res) => {
  try {
    const {
      q: qRaw,
      page: pageRaw,
      limit: limitRaw,
    } = req.query;

    const q = (qRaw || '').trim();
    const page = Math.max(parseInt(pageRaw ?? '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '25', 10) || 25, 1), 200);
    const skip = (page - 1) * limit;

    const where = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
            { gstin: { $regex: q, $options: 'i' } },
            { 'credentials.panelName': { $regex: q, $options: 'i' } },
            { 'credentials.projectName': { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    const [list, total] = await Promise.all([
      Client.find(where, CLIENT_SAFE_PROJECTION).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(where),
    ]);

    res.json({
      ok: true,
      list,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const getLedger = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId, CLIENT_SAFE_PROJECTION);
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    const entries = await LedgerEntry.find({ clientId }).sort({ date: 1, createdAt: 1 });
    res.json({ ok: true, client, entries });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const getLedgerPdf = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId, CLIENT_SAFE_PROJECTION);
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    const entries = await LedgerEntry.find({ clientId }).sort({ date: 1, createdAt: 1 });
    const outPath = path.resolve('uploads', `ledger-${clientId}.pdf`); // ✅ fixed backtick/quote

    await generateLedgerPDF({ client, entries }, outPath);

    res.json({ ok: true, url: `${process.env.BASE_URL}/uploads/${path.basename(outPath)}` });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const getAllClientsLedger = async (_req, res) => {
  try {
    const clients = await Client.find({}, CLIENT_SAFE_PROJECTION).sort({ createdAt: 1 });
    const allLedgers = [];

    for (const client of clients) {
      const entries = await LedgerEntry.find({ clientId: client._id }).sort({ date: 1, createdAt: 1 });
      allLedgers.push({ client, entries });
    }

    res.json({ ok: true, ledgers: allLedgers });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

/* ------------------------------ Credentials ------------------------------ */
// POST /api/clients/:clientId/credentials
export const addClientCredential = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      panelName,
      projectName,
      environment = 'PROD',
      url,
      username,
      password,
      tags = [],
      notes,
      lastRotatedAt,
    } = req.body;

    if (!panelName || !username || !password) {
      return res.status(400).json({ ok: false, error: 'PANELNAME_USERNAME_PASSWORD_REQUIRED' });
    }

    const client = await Client.findByIdAndUpdate(
      clientId,
      {
        $push: {
          credentials: {
            panelName,
            projectName,
            environment,
            url,
            username,
            password, // stored; select:false; never returned
            tags,
            notes,
            lastRotatedAt: lastRotatedAt || new Date(),
          },
        },
      },
      { new: true, projection: CLIENT_SAFE_PROJECTION }
    );

    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    // Mask all credentials in response (belt & suspenders)
    const safe = client.toObject();
    safe.credentials = maskCredentialsList(safe.credentials);
    res.json({ ok: true, client: safe });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// GET /api/clients/:clientId/credentials
export const listClientCredentials = async (req, res) => {
  try {
    const { clientId } = req.params;

    // ✅ force password to be selected
    const client = await Client.findById(clientId).select("credentials");
    if (!client) {
      return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });
    }

    const safe = client.toObject();

    safe.credentials = (safe.credentials || []).map((cred) => ({
      ...cred,
      password: cred.password, // return stored password directly
    }));

    return res.json({ ok: true, credentials: safe.credentials });
  } catch (e) {
    console.error("listClientCredentials error:", e);
    return res.status(400).json({ ok: false, error: e.message });
  }
};

// PATCH /api/clients/:clientId/credentials/:credId
export const updateClientCredential = async (req, res) => {
  try {
    const { clientId, credId } = req.params;

    const up = {};
    for (const k of [
      'panelName',
      'projectName',
      'environment',
      'url',
      'username',
      'password',
      'tags',
      'notes',
      'lastRotatedAt',
    ]) {
      if (k in req.body) up[`credentials.$.${k}`] = req.body[k];
    }
    if (up['credentials.$.password'] && !up['credentials.$.lastRotatedAt']) {
      up['credentials.$.lastRotatedAt'] = new Date();
    }

    const client = await Client.findOneAndUpdate(
      { _id: clientId, 'credentials._id': credId },
      { $set: up },
      { new: true, projection: CLIENT_SAFE_PROJECTION }
    );

    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_OR_CREDENTIAL_NOT_FOUND' });

    const safe = client.toObject();
    safe.credentials = maskCredentialsList(safe.credentials);
    res.json({ ok: true, client: safe });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// DELETE /api/clients/:clientId/credentials/:credId
export const deleteClientCredential = async (req, res) => {
  try {
    const { clientId, credId } = req.params;

    const client = await Client.findByIdAndUpdate(
      clientId,
      { $pull: { credentials: { _id: credId } } },
      { new: true, projection: CLIENT_SAFE_PROJECTION }
    );

    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_OR_CREDENTIAL_NOT_FOUND' });

    const safe = client.toObject();
    safe.credentials = maskCredentialsList(safe.credentials);
    res.json({ ok: true, client: safe });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

/* -------------------------------- Meetings -------------------------------- */
// POST /api/clients/:clientId/meetings
export const addClientMeeting = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      meetingDate = new Date(),
      title,
      attendees = [],
      remarks,
      summary,
      actionItems = [], // [{description, owner, dueDate, status}]
      nextFollowUp,
    } = req.body;

    const client = await Client.findByIdAndUpdate(
      clientId,
      {
        $push: {
          meetings: {
            meetingDate,
            title,
            attendees,
            remarks,
            summary,
            actionItems,
            nextFollowUp,
          },
        },
      },
      { new: true, projection: CLIENT_SAFE_PROJECTION }
    );

    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// GET /api/clients/:clientId/meetings?from=&to=&q=
export const listClientMeetings = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { from, to, q: qRaw } = req.query;
    const q = (qRaw || '').trim();

    const client = await Client.findById(clientId, CLIENT_SAFE_PROJECTION);
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    let meetings = (client.meetings || []).slice();

    if (from) {
      const fromD = new Date(from);
      if (!isNaN(fromD)) meetings = meetings.filter(m => new Date(m.meetingDate) >= fromD);
    }
    if (to) {
      const toD = new Date(to);
      if (!isNaN(toD)) meetings = meetings.filter(m => new Date(m.meetingDate) <= toD);
    }
    if (q) {
      const rx = new RegExp(q, 'i');
      meetings = meetings.filter(m =>
        rx.test(m.title || '') ||
        rx.test(m.remarks || '') ||
        rx.test(m.summary || '') ||
        (m.attendees || []).some(a => rx.test(a))
      );
    }

    // latest first
    meetings.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

    res.json({ ok: true, meetings });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// PATCH /api/clients/:clientId/meetings/:meetingId/action-items/:index
// body: { status?: 'OPEN'|'IN_PROGRESS'|'DONE'|'BLOCKED', description?, owner?, dueDate? }
export const updateMeetingActionItem = async (req, res) => {
  try {
    const { clientId, meetingId, index } = req.params;

    const idx = parseInt(index, 10);
    if (Number.isNaN(idx)) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACTION_INDEX' });
    }

    const client = await Client.findOne({ _id: clientId, 'meetings._id': meetingId }, CLIENT_SAFE_PROJECTION);
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_OR_MEETING_NOT_FOUND' });

    const meeting = client.meetings.id(meetingId);
    if (!meeting) return res.status(404).json({ ok: false, error: 'MEETING_NOT_FOUND' });
    if (!meeting.actionItems || !meeting.actionItems[idx]) {
      return res.status(404).json({ ok: false, error: 'ACTION_ITEM_NOT_FOUND' });
    }

    // apply updates
    const patch = req.body || {};
    const ai = meeting.actionItems[idx];
    for (const k of ['description', 'owner', 'dueDate', 'status']) {
      if (k in patch) ai[k] = patch[k];
    }

    await client.save();
    res.json({ ok: true, meeting });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
// GET /clients/:clientId  -> basic fetch (safe projection)
export const getClientById = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId, { 'credentials.password': 0 });
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });
    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// POST /clients/:clientId/services  -> push a service
export const addClientService = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      kind, amountMonthly = 0, amountOneTime = 0,
      billingType, startDate, expiryDate, notes
    } = req.body;

    if (!kind || !billingType || !startDate) {
      return res.status(400).json({ ok: false, error: 'KIND_BILLINGTYPE_STARTDATE_REQUIRED' });
    }

    const service = {
      kind,
      amountMonthly: Number(amountMonthly || 0),
      amountOneTime: Number(amountOneTime || 0),
      billingType,
      startDate: new Date(startDate),
      ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
      ...(notes ? { notes } : {}),
    };

    const client = await Client.findByIdAndUpdate(
      clientId,
      { $push: { services: service } },
      { new: true, projection: { 'credentials.password': 0 } }
    );
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
