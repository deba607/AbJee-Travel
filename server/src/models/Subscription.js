import { db, admin } from '../config/database.js';

const COLLECTION_NAME = 'subscriptions';

const createSubscriptionData = (data) => ({
  user: data.user || null,
  plan: {
    type: data.plan?.type || 'free',
    name: data.plan?.name || 'Free Plan',
    price: {
      amount: data.plan?.price?.amount || 0,
      currency: data.plan?.price?.currency || 'USD',
      interval: data.plan?.price?.interval || null,
    },
  },
  status: data.status || 'active',
  startDate: data.startDate || admin.firestore.Timestamp.now(),
  endDate: data.endDate || null,
  trialEndDate: data.trialEndDate || null,
  paymentMethod: data.paymentMethod || { type: 'free' },
  stripeCustomerId: data.stripeCustomerId || null,
  stripeSubscriptionId: data.stripeSubscriptionId || null,
  paypalSubscriptionId: data.paypalSubscriptionId || null,
  billingHistory: data.billingHistory || [],
  nextBillingDate: data.nextBillingDate || null,
  features: data.features || {
    privateChatAccess: false,
    maxPrivateChats: 0,
    travelPartnerRequests: 1,
    prioritySupport: false,
    advancedFilters: false,
    profileBoost: false,
    fileUploadLimit: 5,
    customDestinations: false,
  },
  usage: data.usage || {
    privateChatsUsed: 0,
    travelRequestsUsed: 0,
    lastResetDate: admin.firestore.Timestamp.now(),
  },
  cancellation: data.cancellation || null,
  autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
  promoCode: data.promoCode || null,
  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

class SubscriptionService {
  constructor() {
    this.collection = db.collection(COLLECTION_NAME);
  }

  async create(subscriptionData) {
    const subscriptionRef = this.collection.doc();
    const subscription = createSubscriptionData({ ...subscriptionData, id: subscriptionRef.id });
    subscription.features = this.getFeaturesForPlan(subscription.plan.type);
    await subscriptionRef.set(subscription);
    return { id: subscriptionRef.id, ...subscription };
  }

  async findById(subscriptionId) {
    const doc = await this.collection.doc(subscriptionId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async findByUserId(userId) {
    const snapshot = await this.collection.where('user', '==', userId).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async update(subscriptionId, updateData) {
    const subscriptionRef = this.collection.doc(subscriptionId);
    const updates = { ...updateData, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await subscriptionRef.update(updates);
    return this.findById(subscriptionId);
  }

  async delete(subscriptionId) {
    await this.collection.doc(subscriptionId).delete();
    return true;
  }

  getFeaturesForPlan(planType) {
    const features = {
      free: {
        privateChatAccess: false,
        maxPrivateChats: 0,
        travelPartnerRequests: 1,
        prioritySupport: false,
        advancedFilters: false,
        profileBoost: false,
        fileUploadLimit: 5,
        customDestinations: false,
      },
      pro: {
        privateChatAccess: true,
        maxPrivateChats: 10,
        travelPartnerRequests: 5,
        prioritySupport: true,
        advancedFilters: true,
        profileBoost: false,
        fileUploadLimit: 25,
        customDestinations: true,
      },
      premium: {
        privateChatAccess: true,
        maxPrivateChats: -1,
        travelPartnerRequests: -1,
        prioritySupport: true,
        advancedFilters: true,
        profileBoost: true,
        fileUploadLimit: 100,
        customDestinations: true,
      },
    };
    return features[planType] || features.free;
  }

  isActive(subscription) {
    return subscription.status === 'active' && (!subscription.endDate || new Date(subscription.endDate) > new Date());
  }

  canAccessFeature(subscription, featureName) {
    if (!this.isActive(subscription)) return false;
    return subscription.features[featureName] || false;
  }

  async incrementUsage(subscriptionId, featureName) {
    const subscription = await this.findById(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const updates = { usage: { ...subscription.usage } };
    switch (featureName) {
      case 'privateChats':
        updates.usage.privateChatsUsed = (subscription.usage.privateChatsUsed || 0) + 1;
        break;
      case 'travelRequests':
        updates.usage.travelRequestsUsed = (subscription.usage.travelRequestsUsed || 0) + 1;
        break;
    }
    await this.update(subscriptionId, updates);
  }

  async upgrade(subscriptionId, newPlan, endDate) {
    const features = this.getFeaturesForPlan(newPlan.type);
    await this.update(subscriptionId, { plan: newPlan, endDate, status: 'active', features });
    return this.findById(subscriptionId);
  }

  async cancel(subscriptionId, reason, cancelAtPeriodEnd = true) {
    const updates = {
      cancellation: {
        cancelledAt: admin.firestore.Timestamp.now(),
        reason,
        cancelAtPeriodEnd,
      },
      autoRenew: false,
    };

    if (!cancelAtPeriodEnd) {
      updates.status = 'cancelled';
      updates.endDate = admin.firestore.Timestamp.now();
    }

    await this.update(subscriptionId, updates);
    return this.findById(subscriptionId);
  }
}

const subscriptionService = new SubscriptionService();
export default subscriptionService;