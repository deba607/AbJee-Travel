import { db, admin } from '../config/database.js';

const COLLECTION_NAME = 'chatRooms';

const createChatRoomData = (data) => ({
  name: data.name || '',
  description: data.description || '',
  type: data.type || 'public',
  destination: {
    country: data.destination?.country || null,
    city: data.destination?.city || null,
    region: data.destination?.region || null,
  },
  isActive: data.isActive !== undefined ? data.isActive : true,
  maxMembers: data.maxMembers || 1000,
  members: data.members || [],
  createdBy: data.createdBy || null,
  subscriptionRequired: data.subscriptionRequired || false,
  messageCount: data.messageCount || 0,
  lastActivity: data.lastActivity || admin.firestore.FieldValue.serverTimestamp(),
  lastMessage: data.lastMessage || null,
  avatar: data.avatar || null,
  tags: data.tags || [],
  rules: data.rules || [],
  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

class ChatRoomService {
  constructor() {
    this.collection = db.collection(COLLECTION_NAME);
  }

  async create(roomData) {
    const roomRef = this.collection.doc();
    const room = createChatRoomData({ ...roomData, id: roomRef.id });
    await roomRef.set(room);
    return { id: roomRef.id, ...room };
  }

  async findById(roomId) {
    const doc = await this.collection.doc(roomId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async update(roomId, updateData) {
    const roomRef = this.collection.doc(roomId);
    const updates = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await roomRef.update(updates);
    return this.findById(roomId);
  }

  async delete(roomId) {
    await this.collection.doc(roomId).delete();
    return true;
  }

  async findByType(type, options = {}) {
    const { limit = 50, offset = 0 } = options;
    let query = this.collection
      .where('type', '==', type)
      .where('isActive', '==', true)
      .orderBy('lastActivity', 'desc');
    
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async findByDestination(country, city = null) {
    let query = this.collection
      .where('type', '==', 'public')
      .where('isActive', '==', true);
    
    if (country) {
      query = query.where('destination.country', '==', country);
    }
    if (city) {
      query = query.where('destination.city', '==', city);
    }
    
    const snapshot = await query.orderBy('lastActivity', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async findPopular(limit = 10) {
    const snapshot = await this.collection
      .where('type', '==', 'public')
      .where('isActive', '==', true)
      .orderBy('messageCount', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async addMember(roomId, userId, role = 'member') {
    const room = await this.findById(roomId);
    if (!room) throw new Error('Chat room not found');
    
    const existingMember = room.members.find(m => m.user === userId);
    if (existingMember) return room;
    
    if (room.members.length >= room.maxMembers) {
      throw new Error('Chat room is full');
    }
    
    const roomRef = this.collection.doc(roomId);
    await roomRef.update({
      members: admin.firestore.FieldValue.arrayUnion({
        user: userId,
        role: role,
        joinedAt: admin.firestore.Timestamp.now(),
        lastReadAt: admin.firestore.Timestamp.now()
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return this.findById(roomId);
  }

  async removeMember(roomId, userId) {
    const room = await this.findById(roomId);
    if (!room) throw new Error('Chat room not found');
    
    const updatedMembers = room.members.filter(m => m.user !== userId);
    await this.update(roomId, { members: updatedMembers });
    return this.findById(roomId);
  }

  async updateMemberLastRead(roomId, userId) {
    const room = await this.findById(roomId);
    if (!room) return false;
    
    const updatedMembers = room.members.map(m => {
      if (m.user === userId) {
        return { ...m, lastReadAt: admin.firestore.Timestamp.now() };
      }
      return m;
    });
    
    await this.update(roomId, { members: updatedMembers });
    return true;
  }

  isMember(room, userId) {
    return room.members.some(m => m.user === userId);
  }

  getMemberRole(room, userId) {
    const member = room.members.find(m => m.user === userId);
    return member ? member.role : null;
  }

  async incrementMessageCount(roomId) {
    const roomRef = this.collection.doc(roomId);
    await roomRef.update({
      messageCount: admin.firestore.FieldValue.increment(1),
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  getMemberCount(room) {
    return room.members.length;
  }
}

const chatRoomService = new ChatRoomService();
export default chatRoomService;
