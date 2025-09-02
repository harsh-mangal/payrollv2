import mongoose from 'mongoose';

/* ---------------------- Existing: Services ---------------------- */
const ServiceSchema = new mongoose.Schema({
  kind: { type: String, enum: ['HOSTING','DIGITAL_MARKETING','OTHER'], required: true },
  amountMonthly: { type: Number, default: 0 }, // GST-exclusive
  amountOneTime: { type: Number, default: 0 }, // GST-exclusive
  billingType: { type: String, enum: ['MONTHLY','ONE_TIME'], required: true },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date }, // for hosting/DM with validity
  notes: String
}, { _id: false });

/* ---------------------- New: Credentials ------------------------ */
/** Stores per-panel / per-project credentials for the client */
const CredentialSchema = new mongoose.Schema({
  panelName: { type: String, required: true },        // e.g., "Admin Panel", "Client Portal"
  projectName: { type: String },                      // e.g., "KStock"
  environment: { type: String, enum: ['PROD','STAGING','DEV','OTHER'], default: 'PROD' },
  url: { type: String },                              // https://...
  username: { type: String, required: true },
  password: { type: String, required: true, select: false }, // hidden by default
  tags: [{ type: String }],                           // e.g., ["frontend","api","panel"]
  notes: { type: String },                            // any extra notes (OTP flow, recovery email, etc.)
  lastRotatedAt: { type: Date },                      // when password last changed
}, { timestamps: true });

/* Optional helper to mask password when converting to JSON (if ever selected) */
CredentialSchema.methods.toMaskedJSON = function () {
  const obj = this.toObject({ getters: true, virtuals: true });
  if (obj.password) obj.password = '••••••••';
  return obj;
};

/* ---------------------- New: Meetings --------------------------- */
/** Lightweight meeting log with remarks and action items */
const ActionItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  owner: { type: String },                            // name or email/role
  dueDate: { type: Date },
  status: { type: String, enum: ['OPEN','IN_PROGRESS','DONE','BLOCKED'], default: 'OPEN' },
}, { _id: false });

const MeetingSchema = new mongoose.Schema({
  meetingDate: { type: Date, default: Date.now },
  title: { type: String },                            // optional subject
  attendees: [{ type: String }],                      // names/emails
  remarks: { type: String },                          // your free-form notes
  summary: { type: String },                          // optional concise recap
  actionItems: [ActionItemSchema],
  nextFollowUp: { type: Date },
}, { timestamps: true });

/* ---------------------- Client --------------------------- */
const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  address: String,
  gstin: String,

  services: [ServiceSchema],

  // New: credentials for the client's various panels/projects
  credentials: [CredentialSchema],

  // New: meeting logs with remarks
  meetings: [MeetingSchema],

  openingBalance: { type: Number, default: 0 }, // +ve means client owes you
}, { timestamps: true });

/* Useful indexes */
ClientSchema.index({ name: 1 });
ClientSchema.index({ 'credentials.panelName': 1, 'credentials.environment': 1 });
ClientSchema.index({ 'meetings.meetingDate': -1 });

/* Optional: ensure passwords never leak via toJSON */
ClientSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (Array.isArray(ret.credentials)) {
      ret.credentials = ret.credentials.map(c => {
        if (c && typeof c === 'object') {
          const copy = { ...c };
          if (copy.password) copy.password = '••••••••';
          return copy;
        }
        return c;
      });
    }
    return ret;
  }
});

/* ---------------------- Export --------------------------- */
export default mongoose.model('Client', ClientSchema);
