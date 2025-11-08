import { db, admin } from '../config/database.js';

const COLLECTION_NAME = 'messages';

const createMessageData = (data) => ({
  content: data.content || '',
  type: data.type || 'text',
  sender: data.sender || null,
  chatRoom: data.chatRoom || null,
  attachments: data.attachments || [],
  travelRequest: data.travelRequest || null,
  isEdited: data.isEdited || false,
  editedAt: data.editedAt || null,
  editedBy: data.editedBy || null,
  isDeleted: data.isDeleted || false,
  deletedAt: data.deletedAt || null,
  deletedBy: data.deletedBy || null,
  isModerated: data.isModerated || false,
  moderatedAt: data.moderatedAt || null,
  moderatedBy: data.moderatedBy || null,
  moderationReason: data.moderationReason || null,
  reports: data.reports || [],
  reactions: data.reactions || [],
  replyTo: data.replyTo || null,
  readBy: data.readBy || [],
  systemData: data.systemData || null,
  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

class MessageService {
  constructor() {
    this.collection = db.collection(COLLECTION_NAME);
  }

  async create(messageData) {
    const ref = this.collection.doc();
    const data = createMessageData({ ...messageData, id: ref.id });
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  async findById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async findByChatRoom(chatRoomId, page = 1, limit = 50) {
    // Use a single equality filter + orderBy to avoid composite index errors
    const snapshot = await this.collection
      .where('chatRoom', '==', chatRoomId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const items = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => !m.isDeleted);
    return items; // For real pagination, use cursors with startAfter
  }

  async update(id, updates) {
    const ref = this.collection.doc(id);
    const data = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await ref.update(data);
    return this.findById(id);
  }

  async softDelete(id) {
    return this.update(id, {
      isDeleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      content: '[Message deleted]'
    });
  }

  async editContent(id, newContent) {
    return this.update(id, {
      content: newContent,
      isEdited: true,
      editedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async addReaction(id, userId, emoji) {
    const ref = this.collection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const reactions = (data.reactions || []).filter(r => r.user !== userId);
    reactions.push({ user: userId, emoji, createdAt: Date.now() });
    await ref.update({ reactions, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(id);
  }

  async removeReaction(id, userId, emoji = null) {
    const ref = this.collection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data();
    let reactions = data.reactions || [];
    if (emoji) {
      reactions = reactions.filter(r => !(r.user === userId && r.emoji === emoji));
    } else {
      reactions = reactions.filter(r => r.user !== userId);
    }
    await ref.update({ reactions, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(id);
  }

  async markAsRead(id, userId) {
    const ref = this.collection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const readBy = data.readBy || [];
    if (!readBy.find(r => r.user === userId)) {
      readBy.push({ user: userId, readAt: Date.now() });
      await ref.update({ readBy, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return this.findById(id);
  }

  async findTravelRequests(filters = {}) {
    let query = this.collection.where('type', '==', 'travel_request').where('isDeleted', '==', false);
    if (filters.country) query = query.where('travelRequest.destination.country', '==', filters.country);
    if (filters.startDate) query = query.where('travelRequest.startDate', '>=', filters.startDate);
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

const messageService = new MessageService();
export default messageService;
