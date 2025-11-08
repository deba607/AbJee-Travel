import { db, admin } from '../config/database.js';

const COLLECTION_NAME = 'travelPartnerRequests';

const createTravelRequestData = (data) => ({
  requester: data.requester || null,

  destination: {
    country: data.destination?.country || '',
    city: data.destination?.city || '',
    region: data.destination?.region || '',
    coordinates: data.destination?.coordinates || null,
  },

  startDate: data.startDate || null,
  endDate: data.endDate || null,

  budget: {
    min: typeof data.budget?.min === 'number' ? data.budget.min : 0,
    max: typeof data.budget?.max === 'number' ? data.budget.max : 0,
    currency: data.budget?.currency || 'USD',
    isFlexible: typeof data.budget?.isFlexible === 'boolean' ? data.budget.isFlexible : true,
  },

  groupSize: {
    preferred: typeof data.groupSize?.preferred === 'number' ? data.groupSize.preferred : 2,
    maximum: typeof data.groupSize?.maximum === 'number' ? data.groupSize.maximum : 4,
  },

  travelStyle: data.travelStyle || 'budget',
  accommodation: Array.isArray(data.accommodation) ? data.accommodation : ['hotel', 'airbnb'],
  transportation: Array.isArray(data.transportation) ? data.transportation : ['flight', 'local_transport'],
  interests: Array.isArray(data.interests) ? data.interests : [],

  title: (data.title || '').slice(0, 100),
  description: (data.description || '').slice(0, 1000),

  partnerRequirements: {
    ageRange: {
      min: typeof data.partnerRequirements?.ageRange?.min === 'number' ? data.partnerRequirements.ageRange.min : 18,
      max: typeof data.partnerRequirements?.ageRange?.max === 'number' ? data.partnerRequirements.ageRange.max : 100,
    },
    gender: data.partnerRequirements?.gender || 'any',
    languages: Array.isArray(data.partnerRequirements?.languages) ? data.partnerRequirements.languages : [],
    experience: data.partnerRequirements?.experience || 'any',
  },

  status: data.status || 'active',
  responses: Array.isArray(data.responses) ? data.responses : [],
  matchedPartners: Array.isArray(data.matchedPartners) ? data.matchedPartners : [],
  isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : true,
  allowDirectContact: typeof data.allowDirectContact === 'boolean' ? data.allowDirectContact : true,

  expiresAt: data.expiresAt || null,
  views: typeof data.views === 'number' ? data.views : 0,
  responseCount: typeof data.responseCount === 'number' ? data.responseCount : 0,

  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

class TravelPartnerRequestService {
  constructor() {
    this.collection = db.collection(COLLECTION_NAME);
  }

  async create(data) {
    const ref = this.collection.doc();
    const payload = createTravelRequestData({ ...data, id: ref.id });
    await ref.set(payload);
    return { id: ref.id, ...payload };
  }

  async findById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async update(id, updates) {
    const ref = this.collection.doc(id);
    await ref.update({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(id);
  }

  async delete(id) {
    await this.collection.doc(id).delete();
    return true;
  }

  async addResponse(requestId, userId, message) {
    const ref = this.collection.doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Request not found');
    const data = doc.data();

    const responses = data.responses || [];
    if (responses.find(r => r.user === userId)) {
      throw new Error('User has already responded to this request');
    }

    responses.push({ user: userId, message, status: 'pending', respondedAt: Date.now() });
    await ref.update({ responses, responseCount: responses.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(requestId);
  }

  async updateResponseStatus(requestId, userId, status) {
    const ref = this.collection.doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Request not found');
    const data = doc.data();

    const responses = (data.responses || []).map(r => r.user === userId ? { ...r, status } : r);
    let matchedPartners = data.matchedPartners || [];
    if (status === 'accepted' && !matchedPartners.includes(userId)) {
      matchedPartners.push(userId);
    }

    await ref.update({ responses, matchedPartners, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(requestId);
  }

  async incrementViews(requestId) {
    const ref = this.collection.doc(requestId);
    await ref.update({ views: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(requestId);
  }

  isExpired(request) {
    const now = Date.now();
    const expiresAt = request.expiresAt ? new Date(request.expiresAt).getTime() : 0;
    const startDate = request.startDate ? new Date(request.startDate).getTime() : 0;
    return (expiresAt && expiresAt < now) || (startDate && startDate < now);
  }

  async findMatching(criteria = {}) {
    let query = this.collection
      .where('status', '==', 'active')
      .where('isPublic', '==', true);

    if (criteria.destination?.country) {
      query = query.where('destination.country', '==', criteria.destination.country);
    }
    if (criteria.destination?.city) {
      query = query.where('destination.city', '==', criteria.destination.city);
    }
    if (criteria.travelStyle) {
      query = query.where('travelStyle', '==', criteria.travelStyle);
    }
    if (criteria.interests && criteria.interests.length) {
      // Firestore does not support $in on arrays arbitrarily; use array-contains-any for up to 10
      const limited = criteria.interests.slice(0, 10);
      query = query.where('interests', 'array-contains-any', limited);
    }

    // Date range
    if (criteria.dateRange?.start && criteria.dateRange?.end) {
      query = query.where('startDate', '>=', criteria.dateRange.start);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async cleanupExpired() {
    // This would typically run in a scheduled job; here we query and update
    const now = new Date();
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .where('expiresAt', '<', now)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { status: 'expired' }));
    await batch.commit();
    return true;
  }
}

const travelPartnerRequestService = new TravelPartnerRequestService();
export default travelPartnerRequestService;
