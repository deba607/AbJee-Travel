import { db, admin } from '../config/database.js';

const COLLECTION_NAME = 'userRoles';

class UserRoleService {
  constructor() {
    this.collection = db.collection(COLLECTION_NAME);
  }

  async create(roleData) {
    const roleRef = this.collection.doc();
    const role = {
      user: roleData.user,
      chatRoom: roleData.chatRoom,
      role: roleData.role || 'user',
      permissions: roleData.permissions || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await roleRef.set(role);
    return { id: roleRef.id, ...role };
  }

  async findByUserAndRoom(userId, chatRoomId) {
    const snapshot = await this.collection
      .where('user', '==', userId)
      .where('chatRoom', '==', chatRoomId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async update(roleId, updateData) {
    const roleRef = this.collection.doc(roleId);
    await roleRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

const userRoleService = new UserRoleService();
export default userRoleService;